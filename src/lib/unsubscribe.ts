// 配信停止受付ロジック。idから該当メールを特定し、配信NGリストへ登録する。
import { findByUnsubscribeId, isEmailInNg, addNg } from "./db";

export type UnsubscribeStatus = "accepted" | "already" | "invalid";

export function processUnsubscribe(id: string): UnsubscribeStatus {
  const cleanedId = String(id ?? "").trim();
  if (!cleanedId) return "invalid";

  const info = findByUnsubscribeId(cleanedId);
  if (!info || !info.email) return "invalid";

  if (isEmailInNg(info.email)) return "already";

  addNg({
    email: info.email,
    addressName: info.address_name,
    unsubscribeId: info.unsubscribe_id,
    route: "メールリンク",
    source: info.source,
    clinic: info.clinic,
  });
  return "accepted";
}
