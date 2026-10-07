import { MongoClient } from "mongodb";
import { setupDnsFallback } from "@csa/mongodb";
import type { Review, ReviewStore } from "./types.js";

let connection: Promise<MongoClient> | undefined;
async function collection() {
  const uri = process.env.MONGO_URI?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri)
    throw new Error(
      "Ticket approvals require MongoDB. Configure MONGO_URI for AI Assist."
    );
  if (!connection) {
    setupDnsFallback();
    connection = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
      .connect()
      .catch((error) => {
        connection = undefined;
        throw error;
      });
  }
  const client = await connection;
  return client
    .db(
      process.env.MONGO_DB_NAME?.trim() || process.env.MONGO_TICKETS_DB?.trim() || "csa"
    )
    .collection<Review>("csa_ticket_ai_reviews", { writeConcern: { w: "majority" } });
}

// No memory fallback: the approval and execution claim must survive restarts.
export const reviewStore: ReviewStore = {
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
