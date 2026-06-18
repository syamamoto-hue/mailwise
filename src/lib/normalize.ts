// 正規化・列マッチング系のユーティリティ
// GASの cleanText / cleanName / normalizeEmail / isValidEmail / findHeaderIndex 相当を
// スプレッドシート依存を排除して純粋関数として再実装したもの。

/** テキストの基本クリーニング（全角スペース→半角、連続スペース統合、前後トリム） */
export function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/　/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 名前から取り除く肩書（長いものを先に並べる）
const TITLES = [
  "代表取締役",
  "取締役",
  "理事長",
  "副理事長",
  "院長",
  "副院長",
  "事務長",
  "部長",
  "課長",
  "主任",
  "マネージャー",
  "採用担当",
  "ご担当者",
  "担当者",
  "ご担当",
  "担当",
  "Dr",
  "Ｄｒ",
  "先生",
  "様",
  "さん",
];

/** 名前の正規化（カッコ内除去・肩書除去など） */
export function cleanName(value: unknown): string {
  let name = String(value ?? "");

  name = name
    .replace(/　/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // カッコ内（全角・半角）を削除
  name = name
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();

  // 肩書を削除
  for (const title of TITLES) {
    name = name.split(title).join("");
  }

  // 区切り文字をスペースに寄せて整える
  name = name
    .replace(/[／/｜|・]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return name;
}

/** メールアドレスの正規化（不可視文字除去・mailto除去・小文字化など） */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .replace(/﻿/g, "") // BOM
    .replace(/[​-‍﻿]/g, "") // ゼロ幅スペース等
    .replace(/　/g, "") // 全角スペース
    .replace(/\s+/g, "") // 通常スペース・改行
    .replace(/^mailto:/i, "")
    .replace(/[<>]/g, "")
    .trim()
    .toLowerCase();
}

/** メールアドレスの最低限の形式チェック（xxx@xxx.xxx） */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** ヘッダ名の正規化（空白・コロン除去、小文字化） */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/　/g, " ")
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .trim()
    .toLowerCase();
}

/** 候補列名のいずれかに一致する列インデックスを返す（見つからなければ -1） */
export function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));
  for (const candidate of candidates) {
    const nc = normalizeHeader(candidate);
    const idx = normalizedHeaders.indexOf(nc);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** 姓（フルネームの先頭トークン）を取り出す */
export function getFamilyName(fullName: string): string {
  const name = cleanName(fullName);
  if (!name) return "";
  const parts = name.split(" ");
  return parts[0] || name;
}

/** 代表者と担当者が同一人物または同姓かどうか */
export function isSamePersonOrSameFamilyName(
  representativeName: string,
  contactName: string
): boolean {
  const rep = cleanName(representativeName);
  const contact = cleanName(contactName);

  if (!rep || !contact) return false;
  if (rep === contact) return true;

  const repFamily = getFamilyName(rep);
  const contactFamily = getFamilyName(contact);

  if (repFamily && contactFamily && repFamily === contactFamily) return true;
  if (repFamily && repFamily === contact) return true;

  return false;
}

/** 法人名形式かどうか（株式会社・一般社団法人 など） */
export function isCorporateName(name: string): boolean {
  const text = cleanText(name);
  if (!text) return false;

  const corporatePrefixes = [
    "株式会社",
    "有限会社",
    "合同会社",
    "合資会社",
    "合名会社",
    "一般社団法人",
    "一般財団法人",
    "公益社団法人",
    "公益財団法人",
    "学校法人",
    "社会福祉法人",
    "NPO法人",
    "特定非営利活動法人",
  ];

  return corporatePrefixes.some((p) => text.startsWith(p));
}

/** 歯科・デンタル関連かどうか */
export function isDentalBusiness(customerName: string, industry: string): boolean {
  const target = `${cleanText(customerName)} ${cleanText(industry)}`;
  return ["歯科", "デンタル"].some((k) => target.includes(k));
}

/** 配信停止IDを生成（英大小文字+数字 12文字） */
export function generateUnsubscribeId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
