// CSV文字列 → string[][] へのパース（papaparse使用）。BOM除去込み。
import Papa from "papaparse";

/**
 * アップロードされたCSVのバイト列を文字列にデコードする。
 * 日本語CSVはUTF-8とShift-JIS(CP932)が混在するため自動判定する。
 *   1. UTF-8 BOM があれば UTF-8
 *   2. 厳密UTF-8でデコードできれば UTF-8
 *   3. 失敗したら Shift-JIS とみなす
 */
export function decodeCsvBuffer(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  try {
    // 不正なバイトがあれば例外 → UTF-8ではないと判断
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("shift_jis").decode(bytes);
    } catch {
      // 最後の手段：寛容なUTF-8
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

export function parseCsvToMatrix(text: string): string[][] {
  const cleaned = text.replace(/^﻿/, "");
  const result = Papa.parse<string[]>(cleaned, {
    skipEmptyLines: "greedy",
  });
  return (result.data as string[][]).map((row) =>
    Array.isArray(row) ? row.map((c) => String(c ?? "")) : []
  );
}
