type Tone = "blue" | "green" | "purple" | "slate";

const tones: Record<Tone, string> = {
  blue: "border-primary-100 bg-primary-50 text-primary-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  purple: "border-violet-200 bg-violet-50 text-violet-700",
  slate: "border-csa-border bg-white text-csa-navy"
};

export function StatusCard({
  title,
  value,
  tone = "blue"
}: {
  title: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <article className={`min-h-[116px] rounded-card border p-5 shadow-card ${tones[tone]}`}>
      <h3 className="mb-3 text-[13px] font-semibold text-csa-navy">{title}</h3>
      <p className="m-0 text-[13px] leading-6 text-csa-muted">{value}</p>
    </article>
  );
}
