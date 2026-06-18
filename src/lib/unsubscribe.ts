// 配信停止受付ロジック。idから該当メールを特定し、配信NGリストへ登録する。
import { findByUnsubscribeId, isEmailInNg, addNg } from "./db";

export type UnsubscribeStatus = "accepted" | "already" | "invalid";

export async function processUnsubscribe(id: string): Promise<UnsubscribeStatus> {
  const cleanedId = String(id ?? "").trim();
  if (!cleanedId) return "invalid";

  const info = await findByUnsubscribeId(cleanedId);
  if (!info || !info.email) return "invalid";

  if (await isEmailInNg(info.email)) return "already";

  await addNg({
    email: info.email,
    addressName: info.address_name,
    unsubscribeId: info.unsubscribe_id,
    route: "メールリンク",
    source: info.source,
    clinic: info.clinic,
  });
  return "accepted";
}
