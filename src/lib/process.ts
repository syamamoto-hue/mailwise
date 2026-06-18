// 統合処理の本体。スプレッドシート依存を排除し、依存（NG集合・ID発行）を注入する純粋ロジック。

import { isValidEmail } from "./normalize";
import { readWeSmile, readDentalExtract, readGeneric } from "./parsers";
import type {
  Candidate,
  ExclusionLog,
  OutputRow,
  ProcessResult,
  UploadedList,
} from "./types";

export const MAX_ROWS_PER_GROUP = 950;

// 優先度付き候補（内部用）
interface PrioritizedCandidate extends Candidate {
  priority: number;
}

/** 種別ごとに候補を読み込む */
function readList(list: UploadedList, index: number, logs: ExclusionLog[]): PrioritizedCandidate[] {
  const source = list.label || list.type;
  // WeSmile を最優先、それ以外はアップロード順
  const priority = list.type === "WeSmile" ? 1 : 100 + index;

  let candidates: Candidate[];
  if (list.type === "WeSmile") {
    candidates = readWeSmile(list.rows, source, logs);
  } else if (list.type === "歯科抽出リスト") {
    candidates = readDentalExtract(list.rows, source, logs);
  } else {
    candidates = readGeneric(list.rows, source, "先生", logs);
  }

  return candidates.map((c) => ({ ...c, priority }));
}

export interface ProcessDeps {
  ngEmailSet: Set<string>;
  // メールアドレスごとに配信停止ID（既存なら再利用）を返す
  issueUnsubscribeId: (c: Candidate) => string;
  // 配信停止URLを生成する
  buildUnsubscribeUrl: (unsubscribeId: string) => string;
}

// 検証・重複除外まで終えた選定結果（配信停止ID付与の前段。同期・純粋）
export interface SelectionResult {
  selected: PrioritizedCandidate[];
  logs: ExclusionLog[];
  duplicateExclusionCount: number;
  ngExclusionCount: number;
}

/**
 * 種別別読み込み → 検証 → 重複除外 までを行う（同期・純粋）。
 * 配信停止IDの発行（非同期DB）はこの後段で行う。
 */
export function selectRecipients(lists: UploadedList[], ngEmailSet: Set<string>): SelectionResult {
  const logs: ExclusionLog[] = [];

  // 1) 種別別読み込み
  const candidates: PrioritizedCandidate[] = [];
  lists.forEach((list, index) => {
    candidates.push(...readList(list, index, logs));
  });

  // 2) 検証（メール不足・形式不正・宛名不足・NG該当）
  const valid: PrioritizedCandidate[] = [];
  let ngExclusionCount = 0;

  for (const item of candidates) {
    if (!item.email) {
      logs.push(makeLog("メールアドレス不足のため除外", item));
      continue;
    }
    if (!isValidEmail(item.email)) {
      logs.push(makeLog("メールアドレス形式不正のため除外", item));
      continue;
    }
    if (!item.addressName) {
      logs.push(makeLog("宛名不足のため除外", item));
      continue;
    }
    if (ngEmailSet.has(item.email)) {
      logs.push(makeLog("配信NGリスト該当のため除外", item));
      ngExclusionCount++;
      continue;
    }
    valid.push(item);
  }

  // 3) 重複除外（優先度が小さいほうを残す）
  const selectedByEmail = new Map<string, PrioritizedCandidate>();
  let duplicateExclusionCount = 0;

  for (const item of valid) {
    const current = selectedByEmail.get(item.email);
    if (!current) {
      selectedByEmail.set(item.email, item);
      continue;
    }

    duplicateExclusionCount++;
    if (item.priority < current.priority) {
      selectedByEmail.set(item.email, item);
      logs.push(makeDuplicateLog(current, item));
    } else {
      logs.push(makeDuplicateLog(item, current));
    }
  }

  return {
    selected: Array.from(selectedByEmail.values()),
    logs,
    duplicateExclusionCount,
    ngExclusionCount,
  };
}

/**
 * 選定結果に配信停止ID/URLを付与し、出力行とサマリを組み立てる。
 * getId はメールアドレス→配信停止ID（事前にバッチ発行したMapから引く）。
 */
export function buildResult(
  selection: SelectionResult,
  getId: (c: PrioritizedCandidate) => string,
  buildUnsubscribeUrl: (unsubscribeId: string) => string
): ProcessResult {
  const { selected, logs, duplicateExclusionCount, ngExclusionCount } = selection;

  const rows: OutputRow[] = selected.map((item, i) => {
    const unsubscribeId = getId(item);
    const groupNo = Math.floor(i / MAX_ROWS_PER_GROUP) + 1;
    const group = "group_" + String(groupNo).padStart(2, "0");
    return {
      email: item.email,
      addressName: item.addressName,
      unsubscribeId,
      unsubscribeUrl: buildUnsubscribeUrl(unsubscribeId),
      source: item.source,
      clinic: item.clinic,
      group,
    };
  });

  const groupCount = Math.max(1, Math.ceil(rows.length / MAX_ROWS_PER_GROUP));
  const reasonCounts: Record<string, number> = {};
  for (const log of logs) {
    reasonCounts[log.reason] = (reasonCounts[log.reason] ?? 0) + 1;
  }

  return {
    summary: {
      targetCount: rows.length,
      exclusionCount: logs.length,
      duplicateExclusionCount,
      ngExclusionCount,
      groupCount,
      reasonCounts,
    },
    rows,
    logs,
  };
}

/** 統合送信用リストを作成する（同期版・テスト/単体利用向け。依存は注入） */
export function processLists(lists: UploadedList[], deps: ProcessDeps): ProcessResult {
  const selection = selectRecipients(lists, deps.ngEmailSet);
  return buildResult(selection, (c) => deps.issueUnsubscribeId(c), deps.buildUnsubscribeUrl);
}

function makeLog(reason: string, item: Candidate): ExclusionLog {
  return {
    reason,
    source: item.source,
    email: item.email,
    addressName: item.addressName,
    name: item.name,
    clinic: item.clinic,
    keptSource: "",
    keptAddressName: "",
    keptClinic: "",
  };
}

// excluded を除外し、kept を残す重複ログ
function makeDuplicateLog(excluded: Candidate, kept: Candidate): ExclusionLog {
  return {
    reason: "メールアドレス重複のため除外",
    source: excluded.source,
    email: excluded.email,
    addressName: excluded.addressName,
    name: excluded.name,
    clinic: excluded.clinic,
    keptSource: kept.source,
    keptAddressName: kept.addressName,
    keptClinic: kept.clinic,
  };
}
