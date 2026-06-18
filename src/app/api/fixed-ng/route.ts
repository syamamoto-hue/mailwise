// 固定NGリストAPI。一覧取得・追加・削除。
import { NextRequest, NextResponse } from "next/server";
import { listFixedNg, addFixedNg, deleteFixedNg } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ items: await listFixedNg() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  }
  const added = await addFixedNg(email);
  return NextResponse.json({ added });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  await deleteFixedNg(id);
  return NextResponse.json({ ok: true });
}
