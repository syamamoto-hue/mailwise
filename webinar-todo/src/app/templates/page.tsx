import { prisma } from "@/lib/prisma";
import { serializeTemplate } from "@/lib/serialize";
import { PageHeader } from "@/components/ui";
import TemplateManager from "@/components/TemplateManager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const rows = await prisma.taskTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  const templates = rows.map((t) => serializeTemplate(t as never));

  return (
    <>
      <PageHeader
        title="マスターテンプレート"
        subtitle="新規ウェビナー作成・複製の元になるタスク定義（開催日からのオフセット日数で管理）"
      />
      <div className="p-6">
        <TemplateManager initial={templates} />
      </div>
    </>
  );
}
