import { defineConfig, defineDocs } from "fumadocs-mdx/config";

// The documentation content tree lives in ./content/docs (MDX + meta.json).
export const docs = defineDocs({
  dir: "content/docs"
});

export default defineConfig({
  mdxOptions: {
    // Defaults are fine; syntax highlighting (Shiki) ships with fumadocs-ui.
  }
});
