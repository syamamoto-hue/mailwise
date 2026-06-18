// 配信NGリストの移行用CSVインポート。新形式・旧形式の両方からメールアドレスを抽出する。
//
// 新形式: A:メールアドレス B:宛名 C:配信停止ID D:停止日時 E:停止経路 F:元リスト G:所属/医院名
// 旧形式: A:除外理由 B:元リスト C:メールアドレス D:宛名 E:名前 F:所属/医院名 G:残したリスト H:残した宛名 I:残した所属/医院名

import { normalizeEmail, normalizeHeader, findHeaderIndex } from "./normalize";

export interface ImportedNg {
  email: string;
  addressName: string;
  unsubscribeId: string;
  stoppedAt: string;
  source: string;
  clinic: string;
}

/**
 * CSV（string[][]）を解析してNG登録用レコードを返す。
 * ヘッダ行があれば列名で判定し、なければ列数・内容から形式を推測する。
 */
export function parseNgImport(data: string[][]): ImportedNg[] {
  if (data.length === 0) return [];

  const header = data[0].map((h) => normalizeHeader(h));
  const hasHeader =
    header.includes("メールアドレス") ||
    header.includes("除外理由") ||
    header.some((h) => ["email", "mail", "メール"].includes(h));

  // 列インデックスの決定
  let emailIdx = -1;
  let addressIdx = -1;
  let unsubscribeIdIdx = -1;
  let stoppedAtIdx = -1;
  let sourceIdx = -1;
  let clinicIdx = -1;

  const isOldFormat =
    header.includes("除外理由") ||
    // ヘッダなしで C列にメールがありそうな旧形式の簡易判定
    (!hasHeader && looksLikeEmail(data[0]?.[2]) && !looksLikeEmail(data[0]?.[0]));

  if (hasHeader) {
    const rawHeader = data[0];
    emailIdx = findHeaderIndex(rawHeader, [
      "メールアドレス",
      "メール",
      "Email",
      "email",
      "mail",
      "Mail",
      "E-mail",
      "e-mail",
    ]);
    addressIdx = findHeaderIndex(rawHeader, ["宛名"]);
    unsubscribeIdIdx = findHeaderIndex(rawHeader, ["配信停止ID"]);
    stoppedAtIdx = findHeaderIndex(rawHeader, ["停止日時"]);
    sourceIdx = findHeaderIndex(rawHeader, ["元リスト"]);
    clinicIdx = findHeaderIndex(rawHeader, ["所属/医院名", "所属", "医院名"]);
  } else if (isOldFormat) {
    // 旧形式の固定配置
    emailIdx = 2;
    addressIdx = 3;
    sourceIdx = 1;
    clinicIdx = 5;
  } else {
    // 新形式の固定配置
    emailIdx = 0;
    addressIdx = 1;
    unsubscribeIdIdx = 2;
    stoppedAtIdx = 3;
    sourceIdx = 5;
    clinicIdx = 6;
  }

  // ヘッダなしの旧形式でメール列が見つからない場合のフォールバック
  if (emailIdx === -1) emailIdx = isOldFormat ? 2 : 0;

  const startRow = hasHeader ? 1 : 0;
  const result: ImportedNg[] = [];
  const seen = new Set<string>();

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const email = normalizeEmail(row[emailIdx]);
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    result.push({
      email,
      addressName: addressIdx >= 0 ? String(row[addressIdx] ?? "").trim() : "",
      unsubscribeId: unsubscribeIdIdx >= 0 ? String(row[unsubscribeIdIdx] ?? "").trim() : "",
      stoppedAt: stoppedAtIdx >= 0 ? String(row[stoppedAtIdx] ?? "").trim() : "",
      source: sourceIdx >= 0 ? String(row[sourceIdx] ?? "").trim() : "",
      clinic: clinicIdx >= 0 ? String(row[clinicIdx] ?? "").trim() : "",
    });
  }

  return result;
}

function looksLikeEmail(value: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}
