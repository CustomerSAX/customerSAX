"use client";

import { useState } from "react";
import { Accordion, Card, CardContent, Tabs } from "@csa/ui";
import { FAQ_ARTICLES, TROUBLESHOOTING_ARTICLES } from "../hooks/use-knowledge-base";
import type { KnowledgeBaseTabKey } from "../types/knowledge-base-types";

export function KnowledgeBasePanel() {
  const [activeTab, setActiveTab] = useState<KnowledgeBaseTabKey>("faq");
  const activeArticles = activeTab === "faq" ? FAQ_ARTICLES : TROUBLESHOOTING_ARTICLES;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as KnowledgeBaseTabKey)}
          variant="pill"
        >
          <Tabs.List>
            <Tabs.Trigger value="faq">Frequently Asked Questions</Tabs.Trigger>
            <Tabs.Trigger value="troubleshoot">Troubleshooting Guides</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
        <p className="text-xs font-medium text-m-text-muted">
          Showing {activeArticles.length} {activeTab === "faq" ? "articles" : "guides"}
        </p>
      </div>

      <Card variant="default">
        <CardContent className="p-6">
          <Accordion type="multiple" className="space-y-3 divide-y-0 rounded-none border-none bg-transparent">
            {activeArticles.map((article) => (
              <Accordion.Item
                key={article.id}
                value={article.id}
                className="overflow-hidden rounded-m-xl border border-m-border bg-m-surface"
              >
                <Accordion.Trigger>{article.question}</Accordion.Trigger>
                <Accordion.Content className="whitespace-pre-line">{article.answer}</Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion>

          {activeTab === "faq" && (
            <p className="mt-4 border-t border-m-border pt-4 text-xs text-m-text-muted">
              <strong className="text-m-text">Question not on the list?</strong> Contact your team administrator or
              escalate to helpdesk.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
