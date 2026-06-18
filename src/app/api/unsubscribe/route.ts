// 配信停止受付API。idから該当メールを特定し、配信NGリストへ登録する。
import { NextRequest, NextResponse } from "next/server";
import { processUnsubscribe } from "@/lib/unsubscribe";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  return NextResponse.json({ status: processUnsubscribe(id) });
}
