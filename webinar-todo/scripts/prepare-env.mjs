// Runs before the Prisma CLI during deployment (vercel-build).
// Cloud providers expose the Postgres connection string under different names,
// so we normalize them into a local .env with DATABASE_URL (pooled) and
// DIRECT_URL (non-pooled, used by `prisma db push` for DDL).
import { writeFileSync } from "node:fs";

const pooled =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

const direct =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  pooled;

if (!pooled) {
  console.warn(
    "[prepare-env] データベースの接続情報が見つかりません。\n" +
      "  Vercel の Storage で Postgres(Neon) を作成し、プロジェクトに接続してください。"
  );
  process.exit(0);
}

writeFileSync(".env", `DATABASE_URL="${pooled}"\nDIRECT_URL="${direct}"\n`, "utf8");
console.log("[prepare-env] .env を書き出しました (DATABASE_URL / DIRECT_URL)。");
