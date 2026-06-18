"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "new" | "overwrite" | "template";

export default function ImportClient({
  webinars,
}: {
  webinars: { id: string; title: string; webinarDate: string }[];
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<Mode>("new");
  const [year, setYear] = useState(new Date().getFullYear());
  const [webinarId, setWebinarId] = useState(webinars[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function onFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function run() {
    setError("");
    setResult(null);
    if (!csv.trim()) return setError("CSV を貼り付けるか、ファイルを選択してください");
    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, mode, year, webinarId: mode === "overwrite" ? webinarId : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "取込に失敗しました");

      if (mode === "template") {
        setResult(`マスターテンプレートを ${data.templateCount} 件で更新しました。`);
        router.refresh();
      } else {
        const warn = data.warnings?.length ? `\n注意: ${data.warnings.join(" / ")}` : "";
        setResult(`取込完了：「${data.title ?? ""}」 タスク ${data.taskCount} 件${warn}`);
        if (data.webinarId) {
          setTimeout(() => router.push(`/webinars/${data.webinarId}`), 800);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h3 className="text-[14px] font-bold mb-3">CSV 取り込み</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {(
          [
            ["new", "新規ウェビナーとして取込"],
            ["overwrite", "既存ウェビナーに上書き"],
            ["template", "マスターテンプレートとして取込"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md border px-3 py-2.5 text-[12.5px] font-medium ${
              mode === m ? "border-brand bg-brand/10 text-brand" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">年の補完（日付が「7月29日」形式のとき使用）</label>
          <input type="number" className="field" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        {mode === "overwrite" && (
          <div>
            <label className="label">上書き先ウェビナー</label>
            <select className="field" value={webinarId} onChange={(e) => setWebinarId(e.target.value)}>
              {webinars.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}（{w.webinarDate}）
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="label">CSVファイルを選択</label>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-[12px]"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>

      <div className="mb-3">
        <label className="label">または CSV を貼り付け</label>
        <textarea
          className="field font-mono text-[11px] h-40"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="大カテゴリ,中カテゴリ,小カテゴリ,... を含むCSVを貼り付け"
        />
      </div>

      {error && <p className="text-[12px] text-rose-600 mb-2">{error}</p>}
      {result && <p className="text-[12px] text-emerald-700 whitespace-pre-line mb-2">{result}</p>}

      <button className="btn-primary" onClick={run} disabled={busy}>
        {busy ? "取込中…" : "取り込む"}
      </button>
    </div>
  );
}
