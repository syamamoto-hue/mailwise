// 配信停止完了ページ。メール内リンク（GET）でアクセスされる。
import { processUnsubscribe } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

const MESSAGES = {
  accepted: {
    title: "配信停止を受け付けました",
    body: "今後のご案内メールは配信対象から除外いたします。",
  },
  already: {
    title: "配信停止済みです",
    body: "すでに配信停止を受け付けております。今後のご案内メールは配信対象から除外いたします。",
  },
  invalid: {
    title: "配信停止を受け付けできませんでした",
    body: "URLが正しくないか、該当する配信情報が見つかりませんでした。お手数ですが、メールに返信にて配信停止希望の旨をご連絡ください。",
  },
} as const;

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const status = processUnsubscribe(searchParams.id ?? "");
  const msg = MESSAGES[status];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 80,
        background: "#f7f7f7",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "90%",
          padding: 32,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>{msg.title}</h1>
        <p style={{ fontSize: 15 }}>{msg.body}</p>
      </div>
    </div>
  );
}
