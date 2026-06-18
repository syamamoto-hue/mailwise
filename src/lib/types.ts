// リスト種別
export type ListType =
  | "WeSmile"
  | "30Under30"
  | "1D"
  | "ウェビナー参加者"
  | "歯科抽出リスト"
  | "その他";

export const LIST_TYPES: ListType[] = [
  "WeSmile",
  "30Under30",
  "1D",
  "ウェビナー参加者",
  "歯科抽出リスト",
  "その他",
];

// 読み込んだ候補1件
export interface Candidate {
  source: string; // 元リスト名（種別 or ユーザー指定ラベル）
  email: string;
  name: string;
  addressName: string; // 宛名
  clinic: string; // 所属/医院名
}

// 除外ログ1行（出力CSVの列順に対応）
export interface ExclusionLog {
  reason: string; // 除外理由
  source: string; // 元リスト
  email: string; // メールアドレス
  addressName: string; // 宛名
  name: string; // 名前
  clinic: string; // 所属/医院名
  keptSource: string; // 残したリスト
  keptAddressName: string; // 残した宛名
  keptClinic: string; // 残した所属/医院名
}

// 出力1行
export interface OutputRow {
  email: string;
  addressName: string;
  unsubscribeId: string;
  unsubscribeUrl: string;
  source: string;
  clinic: string;
  group: string; // 配信グループ group_01 ...
}

// アップロードされた1ファイル分（パース済み）
export interface UploadedList {
  type: ListType;
  label: string; // 元リスト名として出力に使う
  rows: string[][]; // ヘッダ行を含む2次元配列
}

// 処理結果サマリ
export interface ProcessSummary {
  targetCount: number; // 送信対象件数
  exclusionCount: number; // 除外件数（全ログ件数）
  duplicateExclusionCount: number; // 重複除外件数
  ngExclusionCount: number; // 配信NG/固定NG除外件数
  groupCount: number; // 分割グループ数
  reasonCounts: Record<string, number>; // 除外理由別件数
}

export interface ProcessResult {
  summary: ProcessSummary;
  rows: OutputRow[];
  logs: ExclusionLog[];
}
