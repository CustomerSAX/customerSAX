"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Client-only Mermaid renderer.
 *
 * `mermaid` is imported dynamically inside the effect so it never runs during
 * SSR / the Next.js build (it touches the DOM), keeping the production build
 * deterministic. Diagram theming is driven by the CSA palette tokens read off
 * the document root, so diagrams match the rest of the portal in light + dark.
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[:]/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      const root = getComputedStyle(document.documentElement);
      const isDark = document.documentElement.classList.contains("dark");
      const token = (name: string, fallback: string) =>
        root.getPropertyValue(name).trim() || fallback;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: token("--font-family", "Inter Variable, sans-serif"),
        themeVariables: {
          primaryColor: isDark
            ? token("--csa-navy-800", "#0B1650")
            : token("--csa-blue-50", "#EFF6FF"),
          primaryBorderColor: token("--csa-blue-500", "#2563EB"),
          primaryTextColor: isDark
            ? token("--csa-gray-100", "#EEF2F7")
            : token("--csa-gray-900", "#101828"),
          lineColor: token("--csa-blue-400", "#60A5FA"),
          tertiaryColor: token("--csa-yellow-500", "#F5A624")
        }
      });

      try {
        const { svg: out } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled) setSvg(out);
      } catch (err) {
        if (!cancelled)
          setSvg(
            `<pre style="white-space:pre-wrap">${String(err)}</pre>`
          );
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="diagram"
      style={{ display: "flex", justifyContent: "center", margin: "1.25rem 0" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
