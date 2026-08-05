import type { ReactNode } from "react";

export function PageHeader({
  actions,
  eyebrow,
  title,
  description
}: {
  actions?: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-csa-muted">
          {eyebrow}
        </p>
        <h1 className="text-[clamp(24px,2vw,30px)] font-bold leading-tight text-csa-navy">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] font-medium leading-6 text-csa-muted">
          {description}
        </p>
      </div>
      {actions}
    </section>
  );
}
