import { env, getMongoCollection } from "@csa/mongodb";

export async function getTicketsCollection() {
  const dbName = env("MONGO_DB_NAME") || env("MONGO_TICKETS_DB") || "csa";
  const collectionName = env("MONGO_TICKETS_COLLECTION") || "Tickets";

  return getMongoCollection(collectionName, { dbName });
}
