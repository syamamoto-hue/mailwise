// アプリのベースURL（配信停止URL生成に使用）。
// 環境変数 APP_BASE_URL があれば優先、なければ既定値。
export function getAppBaseUrl(): string {
  const env = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (env || "http://localhost:3000").replace(/\/+$/, "");
}

export function buildUnsubscribeUrl(unsubscribeId: string): string {
  return `${getAppBaseUrl()}/unsubscribe?id=${encodeURIComponent(unsubscribeId)}`;
}
