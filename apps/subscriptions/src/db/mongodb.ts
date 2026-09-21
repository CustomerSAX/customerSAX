import { env, getMongoCollection } from "@csa/mongodb";
import { createLogger } from "@csa/logger";

const log = createLogger("subscriptions").child({ module: "db/mongodb" });
let indexPromise: Promise<void> | undefined;

export async function getSubscriptionsCollection() {
  const dbName = env("MONGO_DB_NAME") || "csa";
  const collection = await getMongoCollection(env("MONGO_SUBSCRIPTIONS_COLLECTION") || "subscriptions", { dbName });
  await ensureIndexes(collection);
  return collection;
}

async function ensureIndexes(collection: { createIndex: (...args: any[]) => Promise<unknown> }) {
  if (!indexPromise) {
    indexPromise = Promise.all([
      collection.createIndex({ projectKey: 1, subscriptionNumber: 1 }, { unique: true, name: "uniq_project_subscription_number" }),
      collection.createIndex({ projectKey: 1, customerId: 1, updatedAt: -1 }, { name: "by_project_customer" }),
      collection.createIndex({ projectKey: 1, status: 1, nextDeliveryDate: 1 }, { name: "by_project_status_delivery" })
    ])
      .then(() => undefined)
      .catch((error: Error) => {
        indexPromise = undefined;
        log.warn("could not create subscription indexes (non-fatal)", { reason: error.message });
      });
  }
  return indexPromise;
}
