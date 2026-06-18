import { progressColor } from "@/lib/status";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 sticky top-0 z-10">
      <div className="min-w-0">
        <h1 className="text-[15px] font-bold text-slate-800 truncate">{title}</h1>
        {subtitle && <p className="text-[12px] text-slate-500 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-2 w-full rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${progressColor(pct)} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-800"}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}
