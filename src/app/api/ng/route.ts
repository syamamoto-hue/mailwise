// 配信NGリストAPI。一覧取得（検索付き）・手動追加・削除。
import { NextRequest, NextResponse } from "next/server";
import { listNg, addNg, deleteNg } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  return NextResponse.json({ items: listNg(search) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  }
  const added = addNg({
    email,
    addressName: body.addressName ?? "",
    route: "手動登録",
    source: body.source ?? "",
    clinic: body.clinic ?? "",
  });
  return NextResponse.json({ added });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  deleteNg(id);
  return NextResponse.json({ ok: true });
}
