"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Accordion, Button, Card, CardContent, Icon, Tabs } from "@csa/ui";
import { localizePathname } from "@/i18n/routing";
import type { AppLocale } from "@csa/i18n";
import { useKnowledgeBase } from "../hooks/use-knowledge-base";
import type { KnowledgeBaseTabKey } from "../types/knowledge-base-types";

export function KnowledgeBasePanel() {
  const common = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<KnowledgeBaseTabKey>("faq");

  const { data, loading, isAdmin } = useKnowledgeBase();

  const activeSections =
    activeTab === "faq" ? data?.faq ?? [] : data?.troubleshoot ?? [];

  const totalArticles = activeSections.reduce(
    (acc, section) => acc + section.items.length,
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as KnowledgeBaseTabKey)}
          variant="pill"
        >
          <Tabs.List>
            <Tabs.Trigger value="faq">{common("tabs.faq")}</Tabs.Trigger>
            <Tabs.Trigger value="troubleshoot">
              {common("tabs.troubleshooting")}
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>
        <p className="text-xs font-medium text-m-text-muted">
          Showing {loading ? "..." : totalArticles}{" "}
          {activeTab === "faq" ? "articles" : "guides"}
        </p>
      </div>

      <Card variant="default">
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-3 py-4">
              <div className="h-12 w-full animate-pulse rounded-m-xl border border-m-border bg-m-surface-bg/50" />
              <div className="h-12 w-full animate-pulse rounded-m-xl border border-m-border bg-m-surface-bg/50" />
              <div className="h-12 w-full animate-pulse rounded-m-xl border border-m-border bg-m-surface-bg/50" />
            </div>
          ) : totalArticles === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-m-surface-bg text-m-text-muted border border-m-border shadow-sm">
                <Icon name="book-open" size="md" className="text-m-primary" />
              </div>
              <h3 className="text-lg font-bold text-m-text">
                No Knowledge Base Found
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-m-text-muted">
                {isAdmin
                  ? "Please add knowledge base from Admin Settings to see this. You can download the template, add your FAQ and Troubleshooting content, and upload it in one click."
                  : "Please contact your organization administrator to add knowledge base from Admin Settings."}
              </p>
              {isAdmin && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="primary"
                    leftIcon={<Icon name="settings" size="xs" />}
                    onClick={() =>
                      router.push(
                        localizePathname("/admin/knowledge-base", locale as AppLocale)
                      )
                    }
                  >
                    Go to Admin Settings
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {activeSections.map((group, groupIdx) => (
                <div key={group.section || groupIdx} className="space-y-3">
                  {/* Section header if multiple sections or non-default name */}
                  {(activeSections.length > 1 ||
                    group.section.toLowerCase() !== "general") && (
                    <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-m-primary">
                      {group.section}
                    </h3>
                  )}

                  <Accordion
                    type="multiple"
                    className="space-y-3 divide-y-0 rounded-none border-none bg-transparent"
                  >
                    {group.items.map((article) => (
                      <Accordion.Item
                        key={article.id}
                        value={article.id}
                        className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
                      >
                        <Accordion.Trigger>{article.question}</Accordion.Trigger>
                        <Accordion.Content className="whitespace-pre-line">
                          {article.answer}
                        </Accordion.Content>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          )}

          {activeTab === "faq" && !loading && totalArticles > 0 && (
            <p className="mt-6 border-t border-m-border pt-4 text-xs text-m-text-muted">
              <strong className="text-m-text">Question not on the list?</strong>{" "}
              Contact your team administrator or escalate to helpdesk.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
