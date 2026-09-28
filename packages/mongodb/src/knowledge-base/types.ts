import type { ObjectId } from "mongodb";

export type KnowledgeBaseType = "faq" | "troubleshoot";

export interface KnowledgeBaseItemDoc {
  _id?: ObjectId;
  organizationId: string;
  type: KnowledgeBaseType;
  section: string;
  question: string;
  answer: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBaseItemInput {
  type: KnowledgeBaseType;
  section: string;
  question: string;
  answer: string;
}

export interface KnowledgeBaseArticleItem {
  id: string;
  question: string;
  answer: string;
}

export interface KnowledgeBaseSectionGroup {
  section: string;
  items: KnowledgeBaseArticleItem[];
}

export interface KnowledgeBaseStatus {
  lastUpdatedAt: string | null;
  faqCount: number;
  troubleshootCount: number;
}

export interface KnowledgeBaseGroupedData {
  faq: KnowledgeBaseSectionGroup[];
  troubleshoot: KnowledgeBaseSectionGroup[];
  status: KnowledgeBaseStatus;
}
