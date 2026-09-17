import { HomeLayout } from "fumadocs-ui/layouts/home";
import { getBaseOptions } from "@/lib/layout.config";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Navigation");
  const options = getBaseOptions({
    documentation: t("documentation"),
    title: t("title")
  });

  return <HomeLayout {...options}>{children}</HomeLayout>;
}
