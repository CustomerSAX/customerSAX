export type KnowledgeBaseTabKey = "faq" | "troubleshoot";

export interface KnowledgeBaseArticle {
  id: string;
  question: string;
  /** May contain literal "\n" step breaks; rendered with `whitespace-pre-line`. */
  answer: string;
}
