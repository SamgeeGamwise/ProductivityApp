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
        "relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-[0_18px_50px_rgba(2,8,20,0.32)] backdrop-blur-xl",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-[0.01em] text-white">{title}</h2>
        </div>
        {actions}
      </div>
      <div className={clsx("flex flex-1 rounded-[1.35rem] bg-gradient-to-br", accent)}>
        <div
          className={clsx(
            "flex h-full min-h-0 w-full flex-col rounded-[1.35rem] border border-white/12 bg-[linear-gradient(180deg,rgba(3,6,14,0.94),rgba(2,4,10,0.98))] p-4",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
