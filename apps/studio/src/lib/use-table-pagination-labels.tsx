"use client";

import { useTranslations } from "next-intl";

export function useTablePaginationLabels() {
  const t = useTranslations("Common.pagination");

  return {
    summary: (start: number, end: number, total: number) =>
      t("summary", { start, end, total }),
    perPage: t("perPage"),
    page: (page: number, totalPages: number) =>
      t("page", { page, totalPages }),
    previousPage: t("previous"),
    nextPage: t("next"),
  };
}
