import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

let db;
try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  const sql = await readFile(
    new URL("../database/validate-allocation.sql", import.meta.url), "utf8",
  );
  await db.query("DROP PROCEDURE IF EXISTS sp_validate_allocation");
  await db.query(sql);

  const [rows] = await db.execute(
    `SELECT ROUTINE_NAME, ROUTINE_TYPE
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = DATABASE()
       AND ROUTINE_NAME = 'sp_validate_allocation'`,
  );
  console.table(rows);
  console.log("Stored procedure installed.");
} catch (error) {
  console.error("Installation failed:", error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}