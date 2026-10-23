import { reviewCollection } from "../ticket-review/store.js";
import type { QuoteReview, QuoteReviewStore } from "./types.js";

const collection = () => reviewCollection<QuoteReview>("csa_quote_ai_reviews");

// No memory fallback: the approval and execution claim must survive restarts.
export const quoteReviewStore: QuoteReviewStore = {
  async get(id) {
    return (await collection()).findOne({ _id: id });
  },
  async insert(review) {
    try {
      await (await collection()).insertOne(review);
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }
  },
  async change(id, revision, statuses, patch, event) {
    const values = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );
    const removed = Object.fromEntries(
      Object.entries(patch)
        .filter(([, value]) => value === undefined)
        .map(([key]) => [key, "" as const])
    );
    return (await collection()).findOneAndUpdate(
      { _id: id, revision, status: { $in: statuses } },
      {
        $set: values,
        ...(Object.keys(removed).length ? { $unset: removed } : {}),
        $push: { audit: event }
      },
      { returnDocument: "after" }
    );
  }
};

/** One scoped read for the quote list; never runs analysis. */
export async function getQuoteReviewsByIds(ids: string[], clientId: string, projectKey: string) {
  return (await collection()).find({ _id: { $in: ids }, clientId, projectKey }).toArray();
}
