// libSQL（Turso / ローカルSQLiteファイル）によるDB層。
// ローカル開発: file:data/mailwise.db、本番(Vercel): TURSO_DATABASE_URL に自動切替。
// SQLite互換なのでスキーマ・クエリはそのまま。接続はネットワーク経由のため全て非同期。

import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { normalizeEmail, generateUnsubscribeId } from "./normalize";
import type { Candidate } from "./types";

let _client: Client | null = null;
let _schemaReady: Promise<void> | null = null;

function createDbClient(): Client {
  // 本番: Turso（環境変数）。なければローカルのSQLiteファイル。
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  // ローカル/テスト: file: URL。MAILWISE_DB_PATH で保存先を上書き可能。
  const dbPath = process.env.MAILWISE_DB_PATH || path.join(process.cwd(), "data", "mailwise.db");
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return createClient({ url: `file:${dbPath}` });
}

async function ensureSchema(client: Client): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS ng_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      address_name TEXT DEFAULT '',
      unsubscribe_id TEXT DEFAULT '',
      stopped_at TEXT DEFAULT '',
      route TEXT DEFAULT '',
      source TEXT DEFAULT '',
      clinic TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS fixed_ng (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS unsubscribe_id (
      email TEXT PRIMARY KEY,
      unsubscribe_id TEXT NOT NULL,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      address_name TEXT DEFAULT '',
      source TEXT DEFAULT '',
      clinic TEXT DEFAULT ''
    );
  `);
}

export async function getDb(): Promise<Client> {
  if (!_client) {
    _client = createDbClient();
  }
  if (!_schemaReady) {
    _schemaReady = ensureSchema(_client);
  }
  await _schemaReady;
  return _client;
}

// ---------- 型 ----------
export interface NgRow {
  id: number;
  email: string;
  address_name: string;
  unsubscribe_id: string;
  stopped_at: string;
  route: string;
  source: string;
  clinic: string;
}

export interface FixedNgRow {
  id: number;
  email: string;
  created_at: string;
}

export interface UnsubscribeIdRow {
  email: string;
  unsubscribe_id: string;
  created_at: string;
  updated_at: string;
  address_name: string;
  source: string;
  clinic: string;
}

export type StopRoute = "メールリンク" | "手動登録" | "固定NG" | "CSVインポート";

// libSQLの行（Record<string, Value>）を任意の型へ
function rowsAs<T>(rows: unknown[]): T[] {
  return rows as unknown as T[];
}

// ---------- 配信NGリスト ----------

/** 配信NG + 固定NG を合わせた除外用メールアドレス集合 */
export async function getAllNgEmailSet(): Promise<Set<string>> {
  const db = await getDb();
  const ng = await db.execute("SELECT email FROM ng_list");
  const fixed = await db.execute("SELECT email FROM fixed_ng");
  const set = new Set<string>();
  for (const r of ng.rows) set.add(normalizeEmail((r as unknown as { email: string }).email));
  for (const r of fixed.rows) set.add(normalizeEmail((r as unknown as { email: string }).email));
  return set;
}

export async function listNg(search?: string): Promise<NgRow[]> {
  const db = await getDb();
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    const res = await db.execute({
      sql: "SELECT * FROM ng_list WHERE email LIKE ? OR address_name LIKE ? OR clinic LIKE ? OR source LIKE ? ORDER BY id DESC",
      args: [like, like, like, like],
    });
    return rowsAs<NgRow>(res.rows);
  }
  const res = await db.execute("SELECT * FROM ng_list ORDER BY id DESC");
  return rowsAs<NgRow>(res.rows);
}

/**
 * 配信NGリストに登録する。既に同じメールがあれば二重登録しない。
 * @returns true=新規登録 / false=既存のためスキップ
 */
export async function addNg(input: {
  email: string;
  addressName?: string;
  unsubscribeId?: string;
  route: StopRoute;
  source?: string;
  clinic?: string;
  stoppedAt?: string;
}): Promise<boolean> {
  const db = await getDb();
  const email = normalizeEmail(input.email);
  if (!email) return false;

  const exists = await db.execute({
    sql: "SELECT 1 FROM ng_list WHERE email = ?",
    args: [email],
  });
  if (exists.rows.length > 0) return false;

  await db.execute({
    sql: `INSERT INTO ng_list (email, address_name, unsubscribe_id, stopped_at, route, source, clinic)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      email,
      input.addressName ?? "",
      input.unsubscribeId ?? "",
      input.stoppedAt ?? new Date().toISOString(),
      input.route,
      input.source ?? "",
      input.clinic ?? "",
    ],
  });
  return true;
}

export async function isEmailInNg(email: string): Promise<boolean> {
  const db = await getDb();
  const e = normalizeEmail(email);
  const res = await db.execute({ sql: "SELECT 1 FROM ng_list WHERE email = ?", args: [e] });
  return res.rows.length > 0;
}

export async function deleteNg(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM ng_list WHERE id = ?", args: [id] });
}

// ---------- 固定NGリスト ----------

export async function listFixedNg(): Promise<FixedNgRow[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM fixed_ng ORDER BY id DESC");
  return rowsAs<FixedNgRow>(res.rows);
}

/** 固定NGに追加。既存なら二重登録しない。 */
export async function addFixedNg(email: string): Promise<boolean> {
  const db = await getDb();
  const e = normalizeEmail(email);
  if (!e) return false;
  const exists = await db.execute({ sql: "SELECT 1 FROM fixed_ng WHERE email = ?", args: [e] });
  if (exists.rows.length > 0) return false;
  await db.execute({
    sql: "INSERT INTO fixed_ng (email, created_at) VALUES (?, ?)",
    args: [e, new Date().toISOString()],
  });
  return true;
}

export async function deleteFixedNg(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM fixed_ng WHERE id = ?", args: [id] });
}

// ---------- 配信停止ID管理 ----------

/**
 * メールアドレスごとに配信停止IDを取得（なければ新規発行）。
 * 既存のメールアドレスなら既存IDを再利用する。
 */
export async function getOrIssueUnsubscribeId(item: Candidate): Promise<UnsubscribeIdRow> {
  const db = await getDb();
  const email = normalizeEmail(item.email);
  const now = new Date().toISOString();

  const existingRes = await db.execute({
    sql: "SELECT * FROM unsubscribe_id WHERE email = ?",
    args: [email],
  });
  const existing = existingRes.rows[0] as unknown as UnsubscribeIdRow | undefined;

  if (existing) {
    const merged = {
      address_name: item.addressName || existing.address_name || "",
      source: item.source || existing.source || "",
      clinic: item.clinic || existing.clinic || "",
    };
    await db.execute({
      sql: `UPDATE unsubscribe_id SET updated_at = ?, address_name = ?, source = ?, clinic = ? WHERE email = ?`,
      args: [now, merged.address_name, merged.source, merged.clinic, email],
    });
    return { ...existing, updated_at: now, ...merged };
  }

  const row: UnsubscribeIdRow = {
    email,
    unsubscribe_id: generateUnsubscribeId(),
    created_at: now,
    updated_at: now,
    address_name: item.addressName || "",
    source: item.source || "",
    clinic: item.clinic || "",
  };
  await db.execute({
    sql: `INSERT INTO unsubscribe_id (email, unsubscribe_id, created_at, updated_at, address_name, source, clinic)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.email,
      row.unsubscribe_id,
      row.created_at,
      row.updated_at,
      row.address_name,
      row.source,
      row.clinic,
    ],
  });
  return row;
}

/**
 * 複数候補の配信停止IDをまとめて取得/発行する（メールごとに既存IDを再利用）。
 * ネットワークDBのラウンドトリップを抑えるためバッチ処理する。
 * @returns email -> unsubscribeId のMap
 */
export async function getOrIssueUnsubscribeIds(items: Candidate[]): Promise<Map<string, string>> {
  const db = await getDb();
  const now = new Date().toISOString();

  // 候補のうち代表メタ情報（最初に現れたもの）を保持
  const meta = new Map<string, Candidate>();
  for (const it of items) {
    const email = normalizeEmail(it.email);
    if (!email) continue;
    if (!meta.has(email)) meta.set(email, it);
  }
  const emails = Array.from(meta.keys());
  const idMap = new Map<string, string>();
  if (emails.length === 0) return idMap;

  // 既存IDを取得（変数上限を考慮してチャンク分割）
  const CHUNK = 400;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const res = await db.execute({
      sql: `SELECT email, unsubscribe_id FROM unsubscribe_id WHERE email IN (${placeholders})`,
      args: chunk,
    });
    for (const r of res.rows) {
      const row = r as unknown as { email: string; unsubscribe_id: string };
      idMap.set(String(row.email), String(row.unsubscribe_id));
    }
  }

  // 未発行のメールに新規IDを採番し、バッチINSERT
  const inserts: { sql: string; args: (string | number)[] }[] = [];
  for (const email of emails) {
    if (idMap.has(email)) continue;
    const it = meta.get(email)!;
    const newId = generateUnsubscribeId();
    idMap.set(email, newId);
    inserts.push({
      sql: `INSERT INTO unsubscribe_id (email, unsubscribe_id, created_at, updated_at, address_name, source, clinic)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [email, newId, now, now, it.addressName || "", it.source || "", it.clinic || ""],
    });
  }

  for (let i = 0; i < inserts.length; i += CHUNK) {
    await db.batch(inserts.slice(i, i + CHUNK), "write");
  }

  return idMap;
}

/** 配信停止IDからレコードを引く */
export async function findByUnsubscribeId(
  unsubscribeId: string
): Promise<UnsubscribeIdRow | undefined> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM unsubscribe_id WHERE unsubscribe_id = ?",
    args: [unsubscribeId],
  });
  return res.rows[0] as unknown as UnsubscribeIdRow | undefined;
}
