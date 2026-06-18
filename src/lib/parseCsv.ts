// CSV文字列 → string[][] へのパース（papaparse使用）。BOM除去込み。
import Papa from "papaparse";

export function parseCsvToMatrix(text: string): string[][] {
  const cleaned = text.replace(/^﻿/, "");
  const result = Papa.parse<string[]>(cleaned, {
    skipEmptyLines: "greedy",
  });
  return (result.data as string[][]).map((row) =>
    Array.isArray(row) ? row.map((c) => String(c ?? "")) : []
  );
}
