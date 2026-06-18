import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// テスト用の一時DBを使う
const tmpDb = path.join(os.tmpdir(), `mailwise-test-${Date.now()}.db`);
process.env.MAILWISE_DB_PATH = tmpDb;

let db: typeof import("../src/lib/db");
let unsub: typeof import("../src/lib/unsubscribe");
let ngImport: typeof import("../src/lib/ngImport");

before(async () => {
  db = await import("../src/lib/db");
  unsub = await import("../src/lib/unsubscribe");
  ngImport = await import("../src/lib/ngImport");
});

after(() => {
  for (const f of [tmpDb, `${tmpDb}-wal`, `${tmpDb}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
});

test("配信停止ID：同一メールには同じIDを再利用", async () => {
  const c = { source: "WeSmile", email: "reuse@example.com", name: "再利用", addressName: "再利用先生", clinic: "" };
  const first = await db.getOrIssueUnsubscribeId(c);
  const second = await db.getOrIssueUnsubscribeId(c);
  assert.equal(first.unsubscribe_id, second.unsubscribe_id);
  assert.match(first.unsubscribe_id, /^[A-Za-z0-9]{12}$/);
});

test("配信停止ID：バッチ発行でも既存IDを再利用", async () => {
  const c = { source: "WeSmile", email: "reuse@example.com", name: "再利用", addressName: "再利用先生", clinic: "" };
  const existing = await db.getOrIssueUnsubscribeId(c);
  const map = await db.getOrIssueUnsubscribeIds([
    c,
    { source: "1D", email: "batch-new@example.com", name: "新規", addressName: "新規先生", clinic: "" },
  ]);
  assert.equal(map.get("reuse@example.com"), existing.unsubscribe_id);
  assert.match(map.get("batch-new@example.com")!, /^[A-Za-z0-9]{12}$/);
});

test("5. 配信停止リンクを2回押しても二重登録されない", async () => {
  const c = { source: "1D", email: "twice@example.com", name: "二回", addressName: "二回先生", clinic: "Cクリニック" };
  const info = await db.getOrIssueUnsubscribeId(c);

  const r1 = await unsub.processUnsubscribe(info.unsubscribe_id);
  const r2 = await unsub.processUnsubscribe(info.unsubscribe_id);

  assert.equal(r1, "accepted");
  assert.equal(r2, "already");

  const found = await db.listNg("twice@example.com");
  assert.equal(found.length, 1);
});

test("不正なIDでは invalid", async () => {
  assert.equal(await unsub.processUnsubscribe("not-exist-id"), "invalid");
  assert.equal(await unsub.processUnsubscribe(""), "invalid");
});

test("NGインポート：新形式を取り込み、重複は二重登録しない", async () => {
  const matrix = [
    ["メールアドレス", "宛名", "配信停止ID", "停止日時", "停止経路", "元リスト", "所属/医院名"],
    ["new1@example.com", "新規1先生", "ABC123", "2026-01-01", "メールリンク", "WeSmile", "X歯科"],
    ["new1@example.com", "重複", "", "", "", "", ""],
  ];
  const records = ngImport.parseNgImport(matrix);
  assert.equal(records.length, 1); // インポート側でも重複排除
  let added = 0;
  for (const r of records) if (await db.addNg({ ...r, route: "CSVインポート" })) added++;
  assert.equal(added, 1);
  // 既存なので再度追加しない
  assert.equal(await db.addNg({ email: "new1@example.com", route: "手動登録" }), false);
});

test("NGインポート：旧形式（除外理由始まり）からメールを抽出", () => {
  const matrix = [
    ["除外理由", "元リスト", "メールアドレス", "宛名", "名前", "所属/医院名", "残したリスト", "残した宛名", "残した所属/医院名"],
    ["メールアドレス重複のため除外", "30Under30", "old1@example.com", "旧1先生", "旧一郎", "Y医院", "WeSmile", "", ""],
  ];
  const records = ngImport.parseNgImport(matrix);
  assert.equal(records.length, 1);
  assert.equal(records[0].email, "old1@example.com");
  assert.equal(records[0].source, "30Under30");
});

test("固定NGも配信NG集合に含まれる", async () => {
  await db.addFixedNg("fixed@example.com");
  const set = await db.getAllNgEmailSet();
  assert.ok(set.has("fixed@example.com"));
});
