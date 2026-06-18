// 統合処理API。FormDataで複数CSVファイルと種別を受け取り、処理結果（JSON）を返す。
import { NextRequest, NextResponse } from "next/server";
import { parseCsvToMatrix } from "@/lib/parseCsv";
import { selectRecipients, buildResult } from "@/lib/process";
import { getAllNgEmailSet, getOrIssueUnsubscribeIds } from "@/lib/db";
import { buildUnsubscribeUrl } from "@/lib/config";
import { LIST_TYPES, type ListType, type UploadedList } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const types = form.getAll("types").map((t) => String(t)) as ListType[];
    const labels = form.getAll("labels").map((l) => String(l));

    if (!files.length) {
      return NextResponse.json({ error: "CSVファイルがありません" }, { status: 400 });
    }

    const lists: UploadedList[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = LIST_TYPES.includes(types[i]) ? types[i] : "その他";
      const label = (labels[i] || "").trim() || type;
      const text = await file.text();
      const rows = parseCsvToMatrix(text);
      lists.push({ type, label, rows });
    }

    const ngEmailSet = await getAllNgEmailSet();

    // 検証・重複除外（同期）→ 配信停止IDをバッチ発行（非同期）→ 出力組み立て
    const selection = selectRecipients(lists, ngEmailSet);
    const idMap = await getOrIssueUnsubscribeIds(selection.selected);
    const result = buildResult(
      selection,
      (c) => idMap.get(c.email) ?? "",
      buildUnsubscribeUrl
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "処理中にエラーが発生しました: " + (err as Error).message },
      { status: 500 }
    );
  }
}
