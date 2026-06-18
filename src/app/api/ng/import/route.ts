// 配信NGリストの移行用CSVインポートAPI（新形式・旧形式の両対応）。
import { NextRequest, NextResponse } from "next/server";
import { parseCsvToMatrix, decodeCsvBuffer } from "@/lib/parseCsv";
import { parseNgImport } from "@/lib/ngImport";
import { addNg } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "CSVファイルがありません" }, { status: 400 });
    }

    const text = decodeCsvBuffer(await file.arrayBuffer());
    const matrix = parseCsvToMatrix(text);
    const records = parseNgImport(matrix);

    let added = 0;
    let skipped = 0;
    for (const r of records) {
      const ok = await addNg({
        email: r.email,
        addressName: r.addressName,
        unsubscribeId: r.unsubscribeId,
        stoppedAt: r.stoppedAt,
        route: "CSVインポート",
        source: r.source,
        clinic: r.clinic,
      });
      if (ok) added++;
      else skipped++;
    }

    return NextResponse.json({ total: records.length, added, skipped });
  } catch (err) {
    return NextResponse.json(
      { error: "インポート中にエラーが発生しました: " + (err as Error).message },
      { status: 500 }
    );
  }
}
