"use client";

import { useEffect, useState, useCallback } from "react";

interface NgRow {
  id: number;
  email: string;
  address_name: string;
  unsubscribe_id: string;
  stopped_at: string;
  route: string;
  source: string;
  clinic: string;
}

export default function NgPage() {
  const [items, setItems] = useState<NgRow[]>([]);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [addressName, setAddressName] = useState("");
  const [clinic, setClinic] = useState("");
  const [source, setSource] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/ng?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setItems(data.items);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!email.trim()) return;
    const res = await fetch("/api/ng", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, addressName, clinic, source }),
    });
    const data = await res.json();
    setNotice(data.added ? "追加しました" : "すでに登録済みのため追加しませんでした");
    setEmail("");
    setAddressName("");
    setClinic("");
    setSource("");
    load();
  }

  async function remove(id: number) {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/ng?id=${id}`, { method: "DELETE" });
    load();
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/ng/import", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setNotice(`インポート完了：${data.added}件追加 / ${data.skipped}件スキップ（重複）`);
    } else {
      setNotice("インポート失敗：" + data.error);
    }
    e.target.value = "";
    load();
  }

  return (
    <div className="container">
      <h1>配信NGリスト管理</h1>

      <div className="card">
        <h2>手動追加</h2>
        <div className="row">
          <input
            type="email"
            placeholder="メールアドレス（必須）"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: 240 }}
          />
          <input
            type="text"
            placeholder="宛名"
            value={addressName}
            onChange={(e) => setAddressName(e.target.value)}
          />
          <input
            type="text"
            placeholder="所属/医院名"
            value={clinic}
            onChange={(e) => setClinic(e.target.value)}
          />
          <input
            type="text"
            placeholder="元リスト"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <button onClick={add}>追加</button>
        </div>
      </div>

      <div className="card">
        <h2>CSVインポート（移行用：新形式・旧形式の両対応）</h2>
        <input type="file" accept=".csv,text/csv" onChange={importCsv} />
        <p className="muted">
          新形式（メール,宛名,配信停止ID,停止日時,停止経路,元リスト,所属/医院名）／
          旧形式（除外理由,元リスト,メール,宛名,名前,所属/医院名,…）のどちらでも取り込めます。
        </p>
      </div>

      {notice && <div className="notice ok">{notice}</div>}

      <div className="card">
        <h2>一覧（{items.length}件）</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            type="search"
            placeholder="メール・宛名・医院名・元リストで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>メールアドレス</th>
                <th>宛名</th>
                <th>配信停止ID</th>
                <th>停止日時</th>
                <th>停止経路</th>
                <th>元リスト</th>
                <th>所属/医院名</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.address_name}</td>
                  <td>{r.unsubscribe_id}</td>
                  <td>{r.stopped_at}</td>
                  <td>{r.route}</td>
                  <td>{r.source}</td>
                  <td>{r.clinic}</td>
                  <td>
                    <button className="danger" onClick={() => remove(r.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
