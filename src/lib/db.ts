// SQLite（better-sqlite3）によるローカルDB。
// 配信NGリスト・固定NGリスト・配信停止ID管理を保持する。

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { normalizeEmail, generateUnsubscribeId } from "./normalize";
import type { Candidate } from "./types";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // テスト等で MAILWISE_DB_PATH を指定可能。未指定なら data/mailwise.db。
  const dbPath = process.env.MAILWISE_DB_PATH || path.join(process.cwd(), "data", "mailwise.db");
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
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

  _db = db;
  return db;
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

// ---------- 配信NGリスト ----------

/** 配信NG + 固定NG を合わせた除外用メールアドレス集合 */
export function getAllNgEmailSet(): Set<string> {
  const db = getDb();
  const ng = db.prepare("SELECT email FROM ng_list").all() as { email: string }[];
  const fixed = db.prepare("SELECT email FROM fixed_ng").all() as { email: string }[];
  const set = new Set<string>();
  for (const r of ng) set.add(normalizeEmail(r.email));
  for (const r of fixed) set.add(normalizeEmail(r.email));
  return set;
}

export function listNg(search?: string): NgRow[] {
  const db = getDb();
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    return db
      .prepare(
        "SELECT * FROM ng_list WHERE email LIKE ? OR address_name LIKE ? OR clinic LIKE ? OR source LIKE ? ORDER BY id DESC"
      )
      .all(like, like, like, like) as NgRow[];
  }
  return db.prepare("SELECT * FROM ng_list ORDER BY id DESC").all() as NgRow[];
}

/**
 * 配信NGリストに登録する。既に同じメールがあれば二重登録しない。
 * @returns true=新規登録 / false=既存のためスキップ
 */
export function addNg(input: {
  email: string;
  addressName?: string;
  unsubscribeId?: string;
  route: StopRoute;
  source?: string;
  clinic?: string;
  stoppedAt?: string;
}): boolean {
  const db = getDb();
  const email = normalizeEmail(input.email);
  if (!email) return false;

  const exists = db.prepare("SELECT 1 FROM ng_list WHERE email = ?").get(email);
  if (exists) return false;

  db.prepare(
    `INSERT INTO ng_list (email, address_name, unsubscribe_id, stopped_at, route, source, clinic)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    email,
    input.addressName ?? "",
    input.unsubscribeId ?? "",
    input.stoppedAt ?? new Date().toISOString(),
    input.route,
    input.source ?? "",
    input.clinic ?? ""
  );
  return true;
}

export function isEmailInNg(email: string): boolean {
  const db = getDb();
  const e = normalizeEmail(email);
  return !!db.prepare("SELECT 1 FROM ng_list WHERE email = ?").get(e);
}

export function deleteNg(id: number): void {
  getDb().prepare("DELETE FROM ng_list WHERE id = ?").run(id);
}

// ---------- 固定NGリスト ----------

export function listFixedNg(): FixedNgRow[] {
  return getDb().prepare("SELECT * FROM fixed_ng ORDER BY id DESC").all() as FixedNgRow[];
}

/** 固定NGに追加。既存なら二重登録しない。 */
export function addFixedNg(email: string): boolean {
  const db = getDb();
  const e = normalizeEmail(email);
  if (!e) return false;
  const exists = db.prepare("SELECT 1 FROM fixed_ng WHERE email = ?").get(e);
  if (exists) return false;
  db.prepare("INSERT INTO fixed_ng (email, created_at) VALUES (?, ?)").run(
    e,
    new Date().toISOString()
  );
  return true;
}

export function deleteFixedNg(id: number): void {
  getDb().prepare("DELETE FROM fixed_ng WHERE id = ?").run(id);
}

// ---------- 配信停止ID管理 ----------

/**
 * メールアドレスごとに配信停止IDを取得（なければ新規発行）。
 * 既存のメールアドレスなら既存IDを再利用する。
 */
export function getOrIssueUnsubscribeId(item: Candidate): UnsubscribeIdRow {
  const db = getDb();
  const email = normalizeEmail(item.email);
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT * FROM unsubscribe_id WHERE email = ?")
    .get(email) as UnsubscribeIdRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE unsubscribe_id
       SET updated_at = ?, address_name = ?, source = ?, clinic = ?
       WHERE email = ?`
    ).run(
      now,
      item.addressName || existing.address_name || "",
      item.source || existing.source || "",
      item.clinic || existing.clinic || "",
      email
    );
    return {
      ...existing,
      updated_at: now,
      address_name: item.addressName || existing.address_name || "",
      source: item.source || existing.source || "",
      clinic: item.clinic || existing.clinic || "",
    };
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
  db.prepare(
    `INSERT INTO unsubscribe_id (email, unsubscribe_id, created_at, updated_at, address_name, source, clinic)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.email,
    row.unsubscribe_id,
    row.created_at,
    row.updated_at,
    row.address_name,
    row.source,
    row.clinic
  );
  return row;
}

/** 配信停止IDからレコードを引く */
export function findByUnsubscribeId(unsubscribeId: string): UnsubscribeIdRow | undefined {
  return getDb()
    .prepare("SELECT * FROM unsubscribe_id WHERE unsubscribe_id = ?")
    .get(unsubscribeId) as UnsubscribeIdRow | undefined;
}
