import { MongoClient } from "mongodb";

const client = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  { serverSelectionTimeoutMS: 5000 },
);

try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE || "labtrack");
  await db.command({ ping: 1 });
  console.log("PASS: MongoDB connection");

  const positiveId = {
    bsonType: ["int", "long", "double"],
    minimum: 1,
    multipleOf: 1,
  };

  const validator = {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "event_id", "fault_id", "technician_id",
        "action", "notes", "details", "created_at",
      ],
      additionalProperties: false,
      properties: {
        _id: { bsonType: "objectId" },
        event_id: { bsonType: "string", minLength: 1 },
        fault_id: positiveId,
        technician_id: positiveId,
        action: { enum: ["Diagnosis", "Progress", "Repair"] },
        notes: { bsonType: "string", minLength: 1, maxLength: 5000 },
        details: { bsonType: "object" },
        created_at: { bsonType: "date" },
      },
    },
  };

  const exists = await db.listCollections(
    { name: "repair_updates" }, { nameOnly: true },
  ).hasNext();

  if (!exists) {
    await db.createCollection("repair_updates", {
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: "repair_updates",
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  const updates = db.collection("repair_updates");
  await updates.createIndex(
    { event_id: 1 }, { unique: true, name: "unique_repair_event" },
  );
  await updates.createIndex(
    { fault_id: 1, created_at: 1 }, { name: "fault_repair_history" },
  );
  await updates.createIndex(
    { technician_id: 1, created_at: -1 }, { name: "technician_updates" },
  );
  console.log("PASS: Repair collection validation and indexes");

  let rejected = false;
  try {
    await updates.insertOne({ notes: "Invalid validation test" });
  } catch (error) {
    if (error.code === 121) rejected = true;
    else throw error;
  }
  if (!rejected) {
    throw new Error("MongoDB accepted an invalid repair document.");
  }
  console.log("PASS: Invalid repair document rejected");

  console.log("MongoDB foundation ready. No repair records were created.");
} catch (error) {
  console.error("MongoDB setup failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}