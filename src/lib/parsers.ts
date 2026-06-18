// リスト種別ごとの読み込みロジック。
// 入力は string[][]（1行目=ヘッダ）。GASのreadWeSmile/readDelete/readGeneric相当。

import {
  cleanText,
  cleanName,
  normalizeEmail,
  normalizeHeader,
  findHeaderIndex,
  isSamePersonOrSameFamilyName,
  isCorporateName,
  isDentalBusiness,
} from "./normalize";
import type { Candidate, ExclusionLog } from "./types";

// 共通の列名候補
const EMAIL_CANDIDATES = [
  "メールアドレス",
  "メール",
  "Email",
  "email",
  "mail",
  "Mail",
  "E-mail",
  "e-mail",
];

function emptyLog(reason: string, source: string, extra: Partial<ExclusionLog> = {}): ExclusionLog {
  return {
    reason,
    source,
    email: extra.email ?? "",
    addressName: extra.addressName ?? "",
    name: extra.name ?? "",
    clinic: extra.clinic ?? "",
    keptSource: extra.keptSource ?? "",
    keptAddressName: extra.keptAddressName ?? "",
    keptClinic: extra.keptClinic ?? "",
  };
}

// -----------------------------
// WeSmile：代表者・担当者を分けて処理
// -----------------------------
export function readWeSmile(
  data: string[][],
  sourceName: string,
  logs: ExclusionLog[]
): Candidate[] {
  const result: Candidate[] = [];
  if (data.length <= 1) return result;

  const headers = data[0].map((h) => cleanText(h));

  const clinicIndex = findHeaderIndex(headers, [
    "クリニック名",
    "医院名",
    "医院",
    "クリニック",
    "会社名",
    "法人名",
    "医院・法人名",
  ]);

  const representativeNameIndex = findHeaderIndex(headers, [
    "代表者名",
    "代表者",
    "院長名",
    "理事長名",
    "名前",
    "氏名",
    "お名前",
  ]);

  const representativeEmailIndex = findHeaderIndex(headers, [
    "代表者メールアドレス",
    "代表者メール",
    "代表メールアドレス",
    "代表メール",
    ...EMAIL_CANDIDATES,
  ]);

  const companyEmailIndex = findHeaderIndex(headers, [
    "会社メールアドレス",
    "会社メール",
    "医院メールアドレス",
    "医院メール",
    "クリニックメールアドレス",
    "クリニックメール",
  ]);

  const contactNameIndex = findHeaderIndex(headers, [
    "先方担当者",
    "先方担当者名",
    "担当者",
    "担当者名",
    "連絡担当者",
    "窓口担当者",
  ]);

  const contactEmailIndex = findHeaderIndex(headers, [
    "担当者メールアドレス",
    "担当者メール",
    "先方担当者メールアドレス",
    "先方担当者メール",
    "連絡担当者メールアドレス",
    "窓口担当者メールアドレス",
  ]);

  if (representativeNameIndex === -1 && contactNameIndex === -1) {
    logs.push(emptyLog(`${sourceName}：代表者名列・先方担当者列が見つからないため除外`, sourceName));
    return result;
  }

  if (representativeEmailIndex === -1 && companyEmailIndex === -1 && contactEmailIndex === -1) {
    logs.push(emptyLog(`${sourceName}：メールアドレス列が見つからないため除外`, sourceName));
    return result;
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const clinicName = clinicIndex >= 0 ? cleanText(row[clinicIndex]) : "";
    const representativeName =
      representativeNameIndex >= 0 ? cleanName(row[representativeNameIndex]) : "";
    const representativeEmail =
      representativeEmailIndex >= 0 ? normalizeEmail(row[representativeEmailIndex]) : "";
    const companyEmail = companyEmailIndex >= 0 ? normalizeEmail(row[companyEmailIndex]) : "";
    const contactName = contactNameIndex >= 0 ? cleanName(row[contactNameIndex]) : "";
    const contactEmail = contactEmailIndex >= 0 ? normalizeEmail(row[contactEmailIndex]) : "";

    const representativeSendEmail = representativeEmail || companyEmail;

    const isEmptyRow =
      !clinicName &&
      !representativeName &&
      !representativeEmail &&
      !companyEmail &&
      !contactName &&
      !contactEmail;
    if (isEmptyRow) continue;

    if (representativeName) {
      result.push({
        source: sourceName,
        email: representativeSendEmail,
        name: representativeName,
        addressName: representativeName + "先生",
        clinic: clinicName,
      });
    }

    if (contactName) {
      if (isSamePersonOrSameFamilyName(representativeName, contactName)) {
        logs.push(
          emptyLog(`代表者と担当者が同一または同姓のため担当者側を除外`, sourceName, {
            email: contactEmail,
            addressName: contactName + "様",
            name: contactName,
            clinic: clinicName,
            keptSource: sourceName,
            keptAddressName: representativeName ? representativeName + "先生" : "",
            keptClinic: clinicName,
          })
        );
        continue;
      }

      result.push({
        source: sourceName,
        email: contactEmail,
        name: contactName,
        addressName: contactName + "様",
        clinic: clinicName,
      });
    }

    if (!representativeName && !contactName) {
      logs.push(
        emptyLog(`${sourceName}：代表者名も担当者名も不足のため除外`, sourceName, {
          email: representativeSendEmail || contactEmail,
          clinic: clinicName,
        })
      );
    }
  }

  return result;
}

// -----------------------------
// 歯科抽出リスト（旧DELETE）：歯科・デンタルのみ対象、法人名形式は除外
// -----------------------------
export function readDentalExtract(
  data: string[][],
  sourceName: string,
  logs: ExclusionLog[]
): Candidate[] {
  const result: Candidate[] = [];
  if (data.length <= 1) return result;

  const headers = data[0].map((h) => cleanText(h));

  const emailIndex = findHeaderIndex(headers, EMAIL_CANDIDATES);

  const customerNameIndex = findHeaderIndex(headers, [
    "顧客名",
    "顧客",
    "医院名",
    "歯科医院名",
    "クリニック名",
    "会社名",
    "法人名",
    "施設名",
    "店舗名",
  ]);

  const industryIndex = findHeaderIndex(headers, [
    "業種",
    "業界",
    "業種名",
    "業態",
    "カテゴリ",
    "カテゴリー",
  ]);

  const fullNameIndex = findHeaderIndex(headers, [
    "名前",
    "氏名",
    "お名前",
    "担当者",
    "担当者名",
    "代表者",
    "代表者名",
    "院長名",
    "理事長名",
  ]);

  if (emailIndex === -1) {
    logs.push(emptyLog(`${sourceName}：メールアドレス列が見つからないため除外`, sourceName));
    return result;
  }

  if (customerNameIndex === -1 && industryIndex === -1) {
    logs.push(emptyLog(`${sourceName}：顧客名列・業種列が見つからないため除外`, sourceName));
    return result;
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const email = normalizeEmail(row[emailIndex]);
    const customerName = customerNameIndex >= 0 ? cleanText(row[customerNameIndex]) : "";
    const industry = industryIndex >= 0 ? cleanText(row[industryIndex]) : "";
    const personName = fullNameIndex >= 0 ? cleanName(row[fullNameIndex]) : "";

    if (!email && !customerName && !industry && !personName) continue;

    const addressNameForLog = personName
      ? personName + "先生"
      : customerName
        ? customerName + " 御中"
        : "";

    if (isCorporateName(customerName)) {
      logs.push(
        emptyLog(`歯科抽出リストで法人名形式のため除外`, sourceName, {
          email,
          addressName: addressNameForLog,
          name: personName,
          clinic: customerName || industry,
        })
      );
      continue;
    }

    if (!isDentalBusiness(customerName, industry)) {
      logs.push(
        emptyLog(`歯科抽出リストで歯科関係以外のため除外`, sourceName, {
          email,
          addressName: addressNameForLog,
          name: personName,
          clinic: customerName || industry,
        })
      );
      continue;
    }

    const addressName = personName
      ? personName + "先生"
      : customerName
        ? customerName + " 御中"
        : "";

    result.push({
      source: sourceName,
      email,
      name: personName || customerName,
      addressName,
      clinic: customerName || industry,
    });
  }

  return result;
}

// -----------------------------
// 汎用読み込み：メール+名前、宛名は「名前 + 先生」
// -----------------------------
export function readGeneric(
  data: string[][],
  sourceName: string,
  defaultHonorific: string,
  logs: ExclusionLog[]
): Candidate[] {
  const result: Candidate[] = [];
  if (data.length <= 1) return result;

  const headers = data[0].map((h) => cleanText(h));

  const emailIndex = findHeaderIndex(headers, EMAIL_CANDIDATES);

  const fullNameIndex = findHeaderIndex(headers, [
    "名前",
    "氏名",
    "宛名",
    "氏名（漢字）",
    "お名前",
    "申込者名",
    "参加者名",
  ]);

  const lastNameIndex = findHeaderIndex(headers, ["姓", "名字", "苗字"]);
  const firstNameIndex = findHeaderIndex(headers, ["名"]);

  const clinicIndex = findHeaderIndex(headers, [
    "所属",
    "クリニック名",
    "医院名",
    "歯科医院名",
    "協賛クリニック名",
    "勤務先",
    "会社名",
    "法人名",
    "医院・法人名",
  ]);

  if (emailIndex === -1) {
    logs.push(emptyLog(`${sourceName}：メールアドレス列が見つからないため除外`, sourceName));
    return result;
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const email = normalizeEmail(row[emailIndex]);
    const clinic = clinicIndex >= 0 ? cleanText(row[clinicIndex]) : "";

    let name = "";
    if (fullNameIndex >= 0) {
      name = cleanName(row[fullNameIndex]);
    } else if (lastNameIndex >= 0 || firstNameIndex >= 0) {
      const lastName = lastNameIndex >= 0 ? cleanName(row[lastNameIndex]) : "";
      const firstName = firstNameIndex >= 0 ? cleanName(row[firstNameIndex]) : "";
      name = cleanName(`${lastName} ${firstName}`);
    }

    // 見出し行が混入した場合のスキップ
    const isRepeatedHeaderRow =
      normalizeHeader(email) === "メールアドレス" ||
      normalizeHeader(email) === "メール" ||
      normalizeHeader(name) === "名前" ||
      normalizeHeader(name) === "氏名";
    if (isRepeatedHeaderRow) continue;

    if (!email && !name && !clinic) continue;

    if (!name) {
      logs.push(
        emptyLog(`宛名不足のため除外`, sourceName, {
          email,
          clinic,
        })
      );
      continue;
    }

    result.push({
      source: sourceName,
      email,
      name,
      addressName: name + defaultHonorific,
      clinic,
    });
  }

  return result;
}
