export type KnowledgeBaseTabKey = "faq" | "troubleshoot";

export interface KnowledgeBaseArticle {
  id: string;
  question: string;
  /** May contain literal "\n" step breaks; rendered with `whitespace-pre-line`. */
  answer: string;
}

export interface KnowledgeBaseSection {
  section: string;
  items: KnowledgeBaseArticle[];
}

export interface KnowledgeBaseStatus {
  lastUpdatedAt: string | null;
  faqCount: number;
  troubleshootCount: number;
}

export interface KnowledgeBaseData {
  faq: KnowledgeBaseSection[];
  troubleshoot: KnowledgeBaseSection[];
  status?: KnowledgeBaseStatus;
}
