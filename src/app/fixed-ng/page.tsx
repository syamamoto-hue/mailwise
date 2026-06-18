"use client";

import { useEffect, useState } from "react";

interface FixedNgRow {
  id: number;
  email: string;
  created_at: string;
}

export default function FixedNgPage() {
  const [items, setItems] = useState<FixedNgRow[]>([]);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const res = await fetch("/api/fixed-ng");
    const data = await res.json();
    setItems(data.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!email.trim()) return;
    const res = await fetch("/api/fixed-ng", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setNotice(data.added ? "追加しました" : "すでに登録済みです");
    setEmail("");
    load();
  }

  async function remove(id: number) {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/fixed-ng?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="container">
      <h1>固定NGリスト管理</h1>
      <p className="muted">
        ここに登録したメールアドレスは、統合処理時に必ず除外されます（コード直書きはしません）。
      </p>

      <div className="card">
        <h2>手動追加</h2>
        <div className="row">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: 300 }}
          />
          <button onClick={add}>追加</button>
        </div>
        {notice && <div className="notice ok">{notice}</div>}
      </div>

      <div className="card">
        <h2>一覧（{items.length}件）</h2>
        <table>
          <thead>
            <tr>
              <th>メールアドレス</th>
              <th>登録日時</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.email}</td>
                <td>{r.created_at}</td>
                <td>
                  <button className="danger" onClick={() => remove(r.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
