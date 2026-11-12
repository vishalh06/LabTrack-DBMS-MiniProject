import mysql from "mysql2/promise";
import { mkdir, writeFile } from "node:fs/promises";

let db;
try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  const tables = [
    "users", "laboratories", "equipment", "bookings", "fault_reports",
  ];
  const statements = [
    "-- LabTrack schema. Run against a new, empty labtrack database.",
    "-- Existing populated databases require reviewed migrations.",
    "CREATE DATABASE IF NOT EXISTS labtrack;",
    "USE labtrack;",
  ];

  for (const table of tables) {
    const [rows] = await db.query(`SHOW CREATE TABLE \`${table}\``);
    const ddl = rows[0]["Create Table"].replace(/ AUTO_INCREMENT=\d+/g, "");
    statements.push(`${ddl};`);
  }

  await mkdir("database", { recursive: true });
  await writeFile("database/schema.sql", statements.join("\n\n") + "\n");
  console.log("Saved database/schema.sql with all five tables and constraints.");
} catch (error) {
  console.error("Schema export failed:", error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}