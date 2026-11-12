import "server-only";
import mysql, { type Pool } from "mysql2/promise";

const globalDb = globalThis as unknown as { labtrackPool?: Pool };

export function getDb(): Pool {
  if (!globalDb.labtrackPool) {
    const password = process.env.MYSQL_PASSWORD;
    if (!password || password === "REPLACE_WITH_YOUR_MYSQL_PASSWORD") {
      throw new Error("Set MYSQL_PASSWORD in .env.local.");
    }
    globalDb.labtrackPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password,
      database: process.env.MYSQL_DATABASE || "labtrack",
      waitForConnections: true,
      connectionLimit: 5,
      dateStrings: true,
      multipleStatements: false,
    });
  }
  return globalDb.labtrackPool;
}