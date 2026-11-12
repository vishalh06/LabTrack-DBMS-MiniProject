import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

let db;
try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true,
  });

  const [existing] = await db.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = 'labtrack'`,
  );
  if (existing.length) {
    throw new Error(
      "labtrack already contains tables. Setup stopped without changing them.",
    );
  }

  const sql = await readFile(
    new URL("../database/schema.sql", import.meta.url), "utf8",
  );
  await db.query(sql);
  console.log("LabTrack schema created. Next run db:procedure, then db:seed.");
} catch (error) {
  console.error("Setup stopped:", error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}