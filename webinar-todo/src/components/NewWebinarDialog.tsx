"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "template" | "duplicate" | "blank";

export default function NewWebinarDialog({
  existing,
}: {
  existing: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("template");
  const [title, setTitle] = useState("");
  const [webinarDate, setWebinarDate] = useState("");
  const [leadStartDate, setLeadStartDate] = useState("");
  const [firstMaterialShareDate, setFirst] = useState("");
  const [slideFixDate, setSlideFix] = useState("");
  const [sourceId, setSourceId] = useState(existing[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setMode("template");
    setTitle("");
    setWebinarDate("");
    setLeadStartDate("");
    setFirst("");
    setSlideFix("");
    setError("");
  }

  async function submit() {
    setError("");
    if (!webinarDate) return setError("開催日を入力してください");
    if (mode !== "duplicate" && !title) return setError("タイトルを入力してください");
    if (mode === "duplicate" && !sourceId) return setError("複製元を選択してください");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { mode, title, webinarDate };
      if (mode === "blank" || mode === "template") {
        payload.leadStartDate = leadStartDate || null;
        payload.firstMaterialShareDate = firstMaterialShareDate || null;
        payload.slideFixDate = slideFixDate || null;
      }
      if (mode === "duplicate") {
        payload.sourceId = sourceId;
        payload.title = title || `${existing.find((e) => e.id === sourceId)?.title ?? ""}（複製）`;
      }
      const res = await fetch("/api/webinars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "作成に失敗しました");
      setOpen(false);
      reset();
      router.push(`/webinars/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        ＋ 新規ウェビナー
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-6 overflow-y-auto">
      <div className="card w-full max-w-lg p-6 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">新規ウェビナー作成</h2>
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(
            [
              ["template", "テンプレートから"],
              ["duplicate", "既存を複製"],
              ["blank", "空で作成"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md border px-2 py-2 text-[12px] font-medium ${
                mode === m
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === "duplicate" && (
            <div>
              <label className="label">複製元ウェビナー（前月など）</label>
              <select className="field" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                {existing.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                オフセット日数を引き継ぎ、新しい開催日で全タスクの日付を再計算します。
              </p>
            </div>
          )}

          <div>
            <label className="label">ウェビナータイトル{mode === "duplicate" && "（空欄なら自動）"}</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：8月 矯正ウェビナー" />
          </div>

          <div>
            <label className="label">開催日 *</label>
            <input type="date" className="field" value={webinarDate} onChange={(e) => setWebinarDate(e.target.value)} />
          </div>

          {(mode === "blank" || mode === "template") && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">集客開始日</label>
                <input type="date" className="field" value={leadStartDate} onChange={(e) => setLeadStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">一次資料共有日</label>
                <input type="date" className="field" value={firstMaterialShareDate} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div>
                <label className="label">資料FIX日</label>
                <input type="date" className="field" value={slideFixDate} onChange={(e) => setSlideFix(e.target.value)} />
              </div>
            </div>
          )}

          {mode === "template" && (
            <p className="text-[11px] text-slate-400">
              マスターテンプレートの全タスクを、開催日からの逆算で生成します。
            </p>
          )}

          {error && <p className="text-[12px] text-rose-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
            キャンセル
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "作成中…" : "作成する"}
          </button>
        </div>
      </div>
    </div>
  );
}
