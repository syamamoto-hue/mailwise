"use client";

import { useState } from "react";
import { LIST_TYPES, type ListType, type ProcessResult } from "@/lib/types";

interface FileEntry {
  file: File;
  type: ListType;
  label: string;
}

export default function UploadPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onSelectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newEntries = files.map((file) => ({
      file,
      type: "その他" as ListType,
      label: "",
    }));
    setEntries((prev) => [...prev, ...newEntries]);
    e.target.value = "";
  }

  function updateEntry(index: number, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((en, i) => (i === index ? { ...en, ...patch } : en)));
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setEntries((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function runProcess() {
    if (entries.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      for (const en of entries) {
        form.append("files", en.file);
        form.append("types", en.type);
        form.append("labels", en.label);
      }
      const res = await fetch("/api/process", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "処理に失敗しました");
      setResult(data as ProcessResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function download(format: "unified" | "log" | "zip") {
    if (!result) return;
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, rows: result.rows, logs: result.logs }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      format === "unified"
        ? "統合_送信用リスト.csv"
        : format === "log"
          ? "統合_除外ログ.csv"
          : "mailwise_出力一式.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container">
      <h1>CSVアップロード / 統合処理</h1>

      <div className="card">
        <h2>1. CSVを選択</h2>
        <input type="file" accept=".csv,text/csv" multiple onChange={onSelectFiles} />
        <p className="muted">
          複数選択できます。アップロード順（上から）が重複時の優先順位になります（WeSmileは常に最優先）。
        </p>

        {entries.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {entries.map((en, i) => (
              <div className="file-item" key={i}>
                <span className="order">{i + 1}</span>
                <span className="name">{en.file.name}</span>
                <select
                  value={en.type}
                  onChange={(e) => updateEntry(i, { type: e.target.value as ListType })}
                >
                  {LIST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="元リスト名（任意・既定は種別名）"
                  value={en.label}
                  onChange={(e) => updateEntry(i, { label: e.target.value })}
                  style={{ width: 200 }}
                />
                <button className="secondary" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button
                  className="secondary"
                  onClick={() => move(i, 1)}
                  disabled={i === entries.length - 1}
                >
                  ↓
                </button>
                <button className="danger" onClick={() => removeEntry(i)}>
                  削除
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button onClick={runProcess} disabled={loading || entries.length === 0}>
            {loading ? "処理中…" : "統合処理を実行"}
          </button>
        </div>
        {error && <div className="notice err">{error}</div>}
      </div>

      {result && <ResultView result={result} onDownload={download} />}
    </div>
  );
}

function ResultView({
  result,
  onDownload,
}: {
  result: ProcessResult;
  onDownload: (format: "unified" | "log" | "zip") => void;
}) {
  const s = result.summary;
  const reasons = Object.entries(s.reasonCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card">
      <h2>2. 処理結果</h2>
      <div className="stat-grid">
        <Stat label="送信対象件数" value={s.targetCount} />
        <Stat label="除外件数（合計）" value={s.exclusionCount} />
        <Stat label="重複除外件数" value={s.duplicateExclusionCount} />
        <Stat label="配信NG除外件数" value={s.ngExclusionCount} />
        <Stat label="分割グループ数" value={s.groupCount} />
      </div>

      <h2 style={{ marginTop: 20 }}>除外理由別件数</h2>
      {reasons.length === 0 ? (
        <p className="muted">除外はありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>除外理由</th>
              <th style={{ width: 100 }}>件数</th>
            </tr>
          </thead>
          <tbody>
            {reasons.map(([reason, count]) => (
              <tr key={reason}>
                <td>{reason}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 20 }}>ダウンロード</h2>
      <div className="row">
        <button onClick={() => onDownload("unified")}>統合CSV</button>
        <button onClick={() => onDownload("zip")}>統合+分割+ログ（ZIP一括）</button>
        <button className="secondary" onClick={() => onDownload("log")}>
          除外ログCSV
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value.toLocaleString()}</div>
    </div>
  );
}
