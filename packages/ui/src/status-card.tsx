type Tone = "blue" | "green" | "purple" | "slate";

const tones: Record<Tone, string> = {
  blue: "border-primary-100 bg-primary-50 text-primary-700",
  green: "border-m-success-border bg-m-success-light text-m-success-dark",
  purple: "border-m-info-border bg-m-info-light text-m-info-dark",
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
