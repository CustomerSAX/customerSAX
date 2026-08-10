import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | undefined;

export async function getTicketsCollection() {
  const client = await getMongoClient();
  const dbName = process.env.MONGO_DB_NAME?.trim() || process.env.MONGO_TICKETS_DB?.trim() || "csa";
  const db = client.db(dbName);
  const collectionName = process.env.MONGO_TICKETS_COLLECTION?.trim() || "Tickets";

  return db.collection(collectionName);
}

async function getMongoClient() {
  if (!clientPromise) {
    const uri = requiredEnv("MONGO_URI");
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
