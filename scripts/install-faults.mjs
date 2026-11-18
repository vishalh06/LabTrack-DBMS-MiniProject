import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

// Applies database/migrations/001_fault_management.sql.
// Idempotent: safe to run on a fresh or an already populated database.
let db;
try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  const [tables] = await db.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fault_reports'`,
  );
  if (!tables.length) {
    throw new Error("fault_reports does not exist. Run npm run db:setup first.");
  }

  // Add the new columns only if they are missing. No data is touched.
  for (const column of ["assigned_date", "resolved_date"]) {
    const [found] = await db.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fault_reports'
         AND COLUMN_NAME = ?`,
      [column],
    );
    if (!found.length) {
      await db.query(`ALTER TABLE fault_reports ADD COLUMN \`${column}\` date DEFAULT NULL`);
      console.log(`Added column fault_reports.${column}`);
    }
  }

  const file = await readFile(
    new URL("../database/migrations/001_fault_management.sql", import.meta.url),
    "utf8",
  );
  const sections = file.split(/^-- @@.*$/m)
    .map((part) => part.replace(/^--.*$/gm, "").trim())
    .filter(Boolean);

  for (const statement of sections) {
    await db.query(statement.replace(/;\s*$/, ""));
  }

  const [objects] = await db.execute(
    `SELECT 'TABLE' AS kind, TABLE_NAME AS name FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fault_audit'
     UNION ALL
     SELECT 'VIEW', TABLE_NAME FROM information_schema.VIEWS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'vw\\_%'
     UNION ALL
     SELECT 'TRIGGER', TRIGGER_NAME FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME LIKE 'trg\\_fault%'`,
  );
  console.table(objects);
  console.log("Fault-management database objects installed.");
} catch (error) {
  console.error("Installation failed:", error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
