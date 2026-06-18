// ダウンロードAPI。処理結果（rows/logs）を受け取り、指定フォーマットでファイルを返す。
// format: unified（統合CSV） / log（除外ログCSV） / zip（統合+分割+ログのZIP一括）
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { buildUnifiedCsv, buildSplitCsvs, buildLogCsv } from "@/lib/csv";
import type { OutputRow, ExclusionLog } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    format: "unified" | "log" | "zip";
    rows: OutputRow[];
    logs: ExclusionLog[];
  };

  const rows = body.rows ?? [];
  const logs = body.logs ?? [];

  if (body.format === "unified") {
    return csvResponse(buildUnifiedCsv(rows), "統合_送信用リスト.csv");
  }

  if (body.format === "log") {
    return csvResponse(buildLogCsv(logs), "統合_除外ログ.csv");
  }

  if (body.format === "zip") {
    const zip = new JSZip();
    zip.file("統合_送信用リスト.csv", buildUnifiedCsv(rows));
    for (const part of buildSplitCsvs(rows)) {
      zip.file(part.name, part.content);
    }
    zip.file("統合_除外ログ.csv", buildLogCsv(logs));
    const content = await zip.generateAsync({ type: "uint8array" });
    // Uint8Array を確実な ArrayBuffer に切り出して返す（TSの型差異回避）
    const arrayBuffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    ) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          "mailwise_出力一式.zip"
        )}`,
      },
    });
  }

  return NextResponse.json({ error: "不明なフォーマット" }, { status: 400 });
}

function csvResponse(content: string, filename: string): NextResponse {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
