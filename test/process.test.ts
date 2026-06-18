import { test } from "node:test";
import assert from "node:assert/strict";
import { processLists, type ProcessDeps } from "../src/lib/process";
import type { Candidate, UploadedList } from "../src/lib/types";

// テスト用の依存（DB不要・メモリ内で配信停止IDを発行）
function makeDeps(ngEmails: string[] = []): ProcessDeps {
  const idMap = new Map<string, string>();
  let counter = 0;
  return {
    ngEmailSet: new Set(ngEmails),
    issueUnsubscribeId: (c: Candidate) => {
      if (!idMap.has(c.email)) idMap.set(c.email, "id" + ++counter);
      return idMap.get(c.email)!;
    },
    buildUnsubscribeUrl: (id: string) => `https://example.com/unsubscribe?id=${id}`,
  };
}

function generic(type: UploadedList["type"], rows: string[][]): UploadedList {
  return { type, label: type, rows };
}

test("1. WeSmileと30Under30で同一メール → WeSmileを残す", () => {
  const wesmile = generic("WeSmile", [
    ["クリニック名", "代表者名", "代表者メールアドレス"],
    ["A歯科", "山田太郎", "dup@example.com"],
  ]);
  const u30 = generic("30Under30", [
    ["メールアドレス", "名前"],
    ["dup@example.com", "佐藤花子"],
  ]);
  const res = processLists([u30, wesmile], makeDeps());
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].source, "WeSmile");
  assert.equal(res.summary.duplicateExclusionCount, 1);
});

test("2. 30Under30と1Dで同一メール → アップロード順が早い方を残す", () => {
  const u30 = generic("30Under30", [
    ["メールアドレス", "名前"],
    ["dup@example.com", "佐藤花子"],
  ]);
  const d1 = generic("1D", [
    ["メールアドレス", "名前"],
    ["dup@example.com", "鈴木一郎"],
  ]);
  const res = processLists([u30, d1], makeDeps());
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].source, "30Under30");
});

test("3. 配信NGリスト該当は除外される", () => {
  const list = generic("30Under30", [
    ["メールアドレス", "名前"],
    ["ng@example.com", "対象外"],
    ["ok@example.com", "対象"],
  ]);
  const res = processLists([list], makeDeps(["ng@example.com"]));
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].email, "ok@example.com");
  assert.equal(res.summary.ngExclusionCount, 1);
});

test("4. メールリンクで停止した人（NG集合に含まれる）は次回除外される", () => {
  // 配信停止後はNG集合に入っている前提
  const list = generic("1D", [
    ["メールアドレス", "名前"],
    ["stopped@example.com", "停止済み"],
  ]);
  const res = processLists([list], makeDeps(["stopped@example.com"]));
  assert.equal(res.rows.length, 0);
});

test("6. WeSmileで代表者と担当者が同姓 → 担当者側を除外", () => {
  const wesmile = generic("WeSmile", [
    ["クリニック名", "代表者名", "代表者メールアドレス", "担当者名", "担当者メールアドレス"],
    ["B歯科", "田中 一郎", "rep@example.com", "田中 花子", "contact@example.com"],
  ]);
  const res = processLists([wesmile], makeDeps());
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].addressName, "田中 一郎先生");
  const log = res.logs.find((l) => l.reason.includes("同一または同姓"));
  assert.ok(log, "同姓除外ログがあること");
});

test("6b. WeSmileで代表者と担当者が別姓 → 両方残る", () => {
  const wesmile = generic("WeSmile", [
    ["クリニック名", "代表者名", "代表者メールアドレス", "担当者名", "担当者メールアドレス"],
    ["C歯科", "田中 一郎", "rep@example.com", "佐藤 花子", "contact@example.com"],
  ]);
  const res = processLists([wesmile], makeDeps());
  assert.equal(res.rows.length, 2);
  const contact = res.rows.find((r) => r.email === "contact@example.com");
  assert.equal(contact?.addressName, "佐藤 花子様");
});

test("7. メールアドレスが空 → 除外", () => {
  const list = generic("30Under30", [
    ["メールアドレス", "名前"],
    ["", "名前あり"],
  ]);
  const res = processLists([list], makeDeps());
  assert.equal(res.rows.length, 0);
  assert.ok(res.logs.some((l) => l.reason === "メールアドレス不足のため除外"));
});

test("8. メールアドレス形式が不正 → 除外", () => {
  const list = generic("30Under30", [
    ["メールアドレス", "名前"],
    ["invalid-email", "名前あり"],
  ]);
  const res = processLists([list], makeDeps());
  assert.equal(res.rows.length, 0);
  assert.ok(res.logs.some((l) => l.reason === "メールアドレス形式不正のため除外"));
});

test("9. 名前がない → 宛名不足として除外", () => {
  const list = generic("30Under30", [
    ["メールアドレス", "名前"],
    ["noname@example.com", ""],
  ]);
  const res = processLists([list], makeDeps());
  assert.equal(res.rows.length, 0);
  assert.ok(res.logs.some((l) => l.reason === "宛名不足のため除外"));
});

test("10. 951件 → group_01 と group_02 に分割", () => {
  const rows: string[][] = [["メールアドレス", "名前"]];
  for (let i = 0; i < 951; i++) {
    rows.push([`user${i}@example.com`, `名前${i}`]);
  }
  const res = processLists([generic("30Under30", rows)], makeDeps());
  assert.equal(res.rows.length, 951);
  assert.equal(res.summary.groupCount, 2);
  assert.equal(res.rows[0].group, "group_01");
  assert.equal(res.rows[949].group, "group_01");
  assert.equal(res.rows[950].group, "group_02");
});

test("歯科抽出リスト：歯科は残し、法人名形式・非歯科は除外", () => {
  const list = generic("歯科抽出リスト", [
    ["顧客名", "業種", "メールアドレス", "名前"],
    ["さくら歯科", "歯科医院", "dental@example.com", "院長 桜井"],
    ["株式会社デンタル", "歯科", "corp@example.com", ""],
    ["山田工務店", "建設", "construction@example.com", ""],
    ["田中デンタルクリニック", "", "dental2@example.com", ""],
  ]);
  const res = processLists([list], makeDeps());
  const emails = res.rows.map((r) => r.email).sort();
  assert.deepEqual(emails, ["dental2@example.com", "dental@example.com"]);
  assert.ok(res.logs.some((l) => l.reason === "歯科抽出リストで法人名形式のため除外"));
  assert.ok(res.logs.some((l) => l.reason === "歯科抽出リストで歯科関係以外のため除外"));
  // 個人名なし＋医院名 → 御中
  const dental2 = res.rows.find((r) => r.email === "dental2@example.com");
  assert.equal(dental2?.addressName, "田中デンタルクリニック 御中");
});
