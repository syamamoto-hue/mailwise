// CSV生成ヘルパー。Excel互換のためBOM付きUTF-8で出力する。

import type { ExclusionLog, OutputRow } from "./types";

const BOM = "﻿";

function escapeCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return BOM + lines.join("\r\n");
}

// 出力CSVのヘッダ（先頭4列の順番が重要）
export const OUTPUT_HEADER = [
  "メールアドレス",
  "宛名",
  "配信停止ID",
  "配信停止URL",
  "元リスト",
  "所属/医院名",
  "配信グループ",
];

export function outputRowsToMatrix(rows: OutputRow[]): string[][] {
  return rows.map((r) => [
    r.email,
    r.addressName,
    r.unsubscribeId,
    r.unsubscribeUrl,
    r.source,
    r.clinic,
    r.group,
  ]);
}

/** 統合送信用CSV */
export function buildUnifiedCsv(rows: OutputRow[]): string {
  return toCsv(OUTPUT_HEADER, outputRowsToMatrix(rows));
}

/** グループごとに分割したCSV（{ name, content }[]） */
export function buildSplitCsvs(rows: OutputRow[]): { name: string; content: string }[] {
  const groups = new Map<string, OutputRow[]>();
  for (const r of rows) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group)!.push(r);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, groupRows]) => ({
      name: `統合_送信用_${group}.csv`,
      content: toCsv(OUTPUT_HEADER, outputRowsToMatrix(groupRows)),
    }));
}

// 除外ログCSVのヘッダ
export const LOG_HEADER = [
  "除外理由",
  "元リスト",
  "メールアドレス",
  "宛名",
  "名前",
  "所属/医院名",
  "残したリスト",
  "残した宛名",
  "残した所属/医院名",
];

export function buildLogCsv(logs: ExclusionLog[]): string {
  const rows = logs.map((l) => [
    l.reason,
    l.source,
    l.email,
    l.addressName,
    l.name,
    l.clinic,
    l.keptSource,
    l.keptAddressName,
    l.keptClinic,
  ]);
  return toCsv(LOG_HEADER, rows);
}
