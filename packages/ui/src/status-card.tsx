import type { CSSProperties } from "react";

type Tone = "blue" | "green" | "purple";

const tones: Record<Tone, CSSProperties> = {
  blue: {
    borderColor: "#b9d4ff",
    background: "#f4f8ff"
  },
  green: {
    borderColor: "#a8dfc9",
    background: "#f1fbf6"
  },
  purple: {
    borderColor: "#c8bbff",
    background: "#f7f4ff"
  }
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
    <article
      style={{
        ...tones[tone],
        borderRadius: 8,
        borderStyle: "solid",
        borderWidth: 1,
        minHeight: 116,
        padding: 20
      }}
    >
      <h3
        style={{
          color: "#102044",
          fontSize: "0.92rem",
          margin: "0 0 12px"
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "#45536f",
          lineHeight: 1.5,
          margin: 0
        }}
      >
        {value}
      </p>
    </article>
  );
}

