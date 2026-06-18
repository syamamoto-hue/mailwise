"use client";

import { useState } from "react";
import type { TaskTemplate } from "@/lib/types";

export default function TemplateManager({ initial }: { initial: TaskTemplate[] }) {
  const [rows, setRows] = useState<TaskTemplate[]>(initial);

  function merge(id: string, patch: Partial<TaskTemplate>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function patch(id: string, body: Record<string, unknown>) {
    merge(id, body as Partial<TaskTemplate>);
    await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function add() {
    const res = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) {
      const created = await res.json();
      setRows((prev) => [...prev, created]);
    }
  }

  async function remove(id: string) {
    if (!confirm("このテンプレート行を削除しますか？")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const text = (r: TaskTemplate, field: keyof TaskTemplate) => (
    <input
      className="cell-input"
      defaultValue={(r[field] as string) ?? ""}
      onBlur={(e) => {
        const v = e.target.value;
        if (v !== ((r[field] as string) ?? "")) patch(r.id, { [field]: v || null });
      }}
    />
  );

  const num = (r: TaskTemplate, field: "startOffsetDays" | "dueOffsetDays" | "effortDays") => (
    <input
      type="number"
      step={field === "effortDays" ? "0.5" : "1"}
      className="cell-input w-16"
      defaultValue={r[field] ?? ""}
      onBlur={(e) => {
        const v = e.target.value === "" ? null : Number(e.target.value);
        if (v !== (r[field] ?? null)) patch(r.id, { [field]: v });
      }}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12px] text-slate-500">
          {rows.length} 行 ・ オフセット日数＝開催日の「何日前」か（例：期日オフセット 7 → 開催7日前が期日）
        </p>
        <button className="btn-primary" onClick={add}>
          ＋ テンプレート行を追加
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[11px]">
              <th className="text-left font-medium px-2 py-2 w-32">大カテゴリ</th>
              <th className="text-left font-medium px-2 py-2 w-28">中カテゴリ</th>
              <th className="text-left font-medium px-2 py-2 w-56">小カテゴリ</th>
              <th className="text-left font-medium px-2 py-2 w-28">会社</th>
              <th className="text-left font-medium px-2 py-2 w-24">担当者</th>
              <th className="text-left font-medium px-2 py-2 w-20">着手前日数</th>
              <th className="text-left font-medium px-2 py-2 w-20">期日前日数</th>
              <th className="text-left font-medium px-2 py-2 w-16">工数</th>
              <th className="text-left font-medium px-2 py-2 w-48">備考</th>
              <th className="text-left font-medium px-2 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-1 py-1">{text(r, "largeCategory")}</td>
                <td className="px-1 py-1">{text(r, "middleCategory")}</td>
                <td className="px-1 py-1">{text(r, "smallCategory")}</td>
                <td className="px-1 py-1">{text(r, "company")}</td>
                <td className="px-1 py-1">{text(r, "assignee")}</td>
                <td className="px-1 py-1">{num(r, "startOffsetDays")}</td>
                <td className="px-1 py-1">{num(r, "dueOffsetDays")}</td>
                <td className="px-1 py-1">{num(r, "effortDays")}</td>
                <td className="px-1 py-1">{text(r, "note")}</td>
                <td className="px-1 py-1">
                  <button className="btn-ghost text-rose-500" onClick={() => remove(r.id)} title="削除">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-slate-400 py-10">
                  テンプレートが空です。CSV取込でマスターテンプレートとして取り込むか、行を追加してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
