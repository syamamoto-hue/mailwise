// アプリのベースURL（配信停止URL生成に使用）。
// 優先順位:
//   1. APP_BASE_URL / NEXT_PUBLIC_APP_URL（明示指定。独自ドメイン等）
//   2. VERCEL_PROJECT_PRODUCTION_URL（Vercel本番ドメイン。自動付与なので設定不要）
//   3. http://localhost:3000（ローカル）
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

export function buildUnsubscribeUrl(unsubscribeId: string): string {
  return `${getAppBaseUrl()}/unsubscribe?id=${encodeURIComponent(unsubscribeId)}`;
}
