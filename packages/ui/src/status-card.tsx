import { CardMetric } from "./components/data-display/Card";
import { cn } from "./utils";

type Tone = "blue" | "green" | "purple" | "slate";

const toneStyles: Record<Tone, string> = {
  blue: "border-m-primary-200 bg-m-primary-50",
  green: "border-m-success-border bg-m-success-light",
  purple: "border-m-info-border bg-m-info-light",
  slate: "border-m-border bg-m-surface"
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
  return <CardMetric title={title} value={value} className={cn("min-h-[116px]", toneStyles[tone])} />;
}
