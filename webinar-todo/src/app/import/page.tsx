import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import ImportClient from "@/components/ImportClient";
import { formatDisplay } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const webinars = await prisma.webinar.findMany({
    orderBy: { webinarDate: "desc" },
    select: { id: true, title: true, webinarDate: true },
  });

  return (
    <>
      <PageHeader title="CSV 取込 / 書出" subtitle="Googleスプレッドシートの書き出しCSVを取り込めます" />
      <div className="p-6 space-y-6">
        <ImportClient webinars={webinars} />

        <div className="card p-5">
          <h3 className="text-[14px] font-bold mb-3">CSV 書き出し</h3>
          <p className="text-[12px] text-slate-500 mb-3">
            各ウェビナーのタスクを CSV（大カテゴリ〜備考＋完了日）で書き出します。
          </p>
          <div className="divide-y divide-slate-100">
            {webinars.length === 0 && <p className="text-[12px] text-slate-400">ウェビナーがありません。</p>}
            {webinars.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{w.title}</div>
                  <div className="text-[11px] text-slate-400">{formatDisplay(w.webinarDate)}</div>
                </div>
                <a className="btn shrink-0" href={`/api/webinars/${w.id}/export`}>
                  CSV書出
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
