import "server-only";
import { MongoClient, type Db } from "mongodb";

const globalMongo = globalThis as unknown as {
  labtrackMongo?: Promise<MongoClient>;
};

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in .env.local.");

  if (!globalMongo.labtrackMongo) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });
    globalMongo.labtrackMongo = client.connect().catch(async (error) => {
      globalMongo.labtrackMongo = undefined;
      await client.close();
      throw error;
    });
  }

  const client = await globalMongo.labtrackMongo;
  return client.db(process.env.MONGODB_DATABASE || "labtrack");
}