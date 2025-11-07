import { ReactNode } from "react";
import clsx from "clsx";

interface ModuleCardProps {
  title: string;
  accent?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ModuleCard({
  title,
  actions,
  children,
  accent = "from-sky-500/30 to-cyan-500/10",
  className,
  contentClassName,
}: ModuleCardProps) {
  return (
    <section
      className={clsx(
        "flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/40",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        {actions}
      </div>
      <div className={clsx("flex flex-1 rounded-xl bg-gradient-to-b", accent)}>
        <div className={clsx("flex h-full min-h-0 w-full flex-col rounded-xl bg-slate-950/70 p-4", contentClassName)}>
          {children}
        </div>
      </div>
    </section>
  );
}
