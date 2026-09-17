import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { getBaseOptions } from "@/lib/layout.config";
import { source } from "@/lib/source";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Navigation");
  const options = getBaseOptions({
    documentation: t("documentation"),
    title: t("title")
  });

  return (
    <DocsLayout tree={source.pageTree} {...options}>
      {children}
    </DocsLayout>
  );
}
