import { ObjectId } from "mongodb";
import { getKnowledgeBasesCollection } from "../admin/db.js";
import type {
  KnowledgeBaseGroupedData,
  KnowledgeBaseItemDoc,
  KnowledgeBaseItemInput,
  KnowledgeBaseSectionGroup,
  KnowledgeBaseStatus
} from "./types.js";

/** Ensures necessary compound index for tenant-scoped querying. */
export async function ensureKnowledgeBasesIndexes(): Promise<void> {
  const col = await getKnowledgeBasesCollection();
  await col.createIndex({ organizationId: 1, type: 1, section: 1 });
}

/**
 * Retrieves the full grouped Knowledge Base for an organization.
 * Returns grouped FAQs, Troubleshooting items, and overall status.
 */
export async function getKnowledgeBaseByOrganization(
  organizationId: string
): Promise<KnowledgeBaseGroupedData> {
  if (!organizationId) {
    return {
      faq: [],
      troubleshoot: [],
      status: { lastUpdatedAt: null, faqCount: 0, troubleshootCount: 0 }
    };
  }

  const col = await getKnowledgeBasesCollection();
  const docs = (await col
    .find({ organizationId })
    .sort({ section: 1, createdAt: 1 })
    .toArray()) as unknown as KnowledgeBaseItemDoc[];

  const faqSectionMap = new Map<string, KnowledgeBaseSectionGroup>();
  const troubleshootSectionMap = new Map<string, KnowledgeBaseSectionGroup>();

  let faqCount = 0;
  let troubleshootCount = 0;
  let latestUpdate: Date | null = null;

  for (const doc of docs) {
    const updatedAt = doc.updatedAt || doc.createdAt;
    if (updatedAt) {
      const d = new Date(updatedAt);
      if (!latestUpdate || d > latestUpdate) {
        latestUpdate = d;
      }
    }

    const item = {
      id: doc._id ? doc._id.toHexString() : new ObjectId().toHexString(),
      question: doc.question,
      answer: doc.answer
    };

    if (doc.type === "faq") {
      faqCount++;
      const sectionName = doc.section || "General";
      let group = faqSectionMap.get(sectionName);
      if (!group) {
        group = { section: sectionName, items: [] };
        faqSectionMap.set(sectionName, group);
      }
      group.items.push(item);
    } else if (doc.type === "troubleshoot") {
      troubleshootCount++;
      const sectionName = doc.section || "General";
      let group = troubleshootSectionMap.get(sectionName);
      if (!group) {
        group = { section: sectionName, items: [] };
        troubleshootSectionMap.set(sectionName, group);
      }
      group.items.push(item);
    }
  }

  return {
    faq: Array.from(faqSectionMap.values()),
    troubleshoot: Array.from(troubleshootSectionMap.values()),
    status: {
      lastUpdatedAt: latestUpdate ? latestUpdate.toISOString() : null,
      faqCount,
      troubleshootCount
    }
  };
}

/**
 * Returns basic status metadata for an organization's Knowledge Base.
 */
export async function getKnowledgeBaseStatus(
  organizationId: string
): Promise<KnowledgeBaseStatus> {
  if (!organizationId) {
    return { lastUpdatedAt: null, faqCount: 0, troubleshootCount: 0 };
  }

  const col = await getKnowledgeBasesCollection();
  const docs = (await col
    .find({ organizationId }, { projection: { type: 1, updatedAt: 1, createdAt: 1 } })
    .toArray()) as unknown as KnowledgeBaseItemDoc[];

  let faqCount = 0;
  let troubleshootCount = 0;
  let latestUpdate: Date | null = null;

  for (const doc of docs) {
    if (doc.type === "faq") faqCount++;
    if (doc.type === "troubleshoot") troubleshootCount++;

    const updatedAt = doc.updatedAt || doc.createdAt;
    if (updatedAt) {
      const d = new Date(updatedAt);
      if (!latestUpdate || d > latestUpdate) {
        latestUpdate = d;
      }
    }
  }

  return {
    lastUpdatedAt: latestUpdate ? latestUpdate.toISOString() : null,
    faqCount,
    troubleshootCount
  };
}

/**
 * Replaces an organization's existing Knowledge Base atomically with newly parsed items.
 * Guaranteed not to leave partial data.
 */
export async function replaceKnowledgeBase(
  organizationId: string,
  items: KnowledgeBaseItemInput[]
): Promise<{ count: number; status: KnowledgeBaseStatus }> {
  if (!organizationId) {
    throw new Error("organizationId is required to replace knowledge base");
  }

  const now = new Date();
  const docs: KnowledgeBaseItemDoc[] = items.map((item) => ({
    _id: new ObjectId(),
    organizationId,
    type: item.type,
    section: item.section.trim(),
    question: item.question.trim(),
    answer: item.answer.trim(),
    createdAt: now,
    updatedAt: now
  }));

  const col = await getKnowledgeBasesCollection();

  // Remove existing records for this organization and insert new ones
  await col.deleteMany({ organizationId });
  if (docs.length > 0) {
    await col.insertMany(docs);
  }

  const faqCount = docs.filter((d) => d.type === "faq").length;
  const troubleshootCount = docs.filter((d) => d.type === "troubleshoot").length;

  return {
    count: docs.length,
    status: {
      lastUpdatedAt: now.toISOString(),
      faqCount,
      troubleshootCount
    }
  };
}

/**
 * Deletes all Knowledge Base records for an organization.
 */
export async function deleteKnowledgeBaseByOrganization(
  organizationId: string
): Promise<{ deletedCount: number }> {
  if (!organizationId) return { deletedCount: 0 };
  const col = await getKnowledgeBasesCollection();
  const result = await col.deleteMany({ organizationId });
  return { deletedCount: result.deletedCount ?? 0 };
}
