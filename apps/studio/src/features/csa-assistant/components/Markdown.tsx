"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders chat message text as formatted Markdown (headings, lists, tables,
 * bold/italic, inline/block code, links) instead of raw text. Without this,
 * the AI's `**bold**` / `- bullet` / `### heading` syntax printed literally
 * as asterisks and dashes — technical-looking and confusing for a non-technical
 * support rep reading the chat.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-[15px] font-semibold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-m-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" && src.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt || ""} className="mt-2 max-w-full rounded-m-md border border-m-border" />
            ) : null,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2.5 border-l-2 border-m-border pl-3 opacity-80 last:mb-0">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-m-border" />,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className || "");
            return isBlock ? (
              <code className="font-mono">{children}</code>
            ) : (
              <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2.5 overflow-x-auto rounded-m-md bg-black/80 p-3 text-xs leading-relaxed text-white last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-2.5 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-m-border bg-black/5 px-2.5 py-1.5 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-m-border px-2.5 py-1.5 align-top">{children}</td>
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
