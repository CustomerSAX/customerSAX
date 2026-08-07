import { CardMetric } from "@csa/ui";

type Tone = "blue" | "green" | "purple" | "slate";

export function StatusCard({
  title,
  value,
}: {
  title: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <CardMetric
      title={title}
      value={value}
    />
  );
}
