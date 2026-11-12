import mysql from "mysql2/promise";
import { writeFile } from "node:fs/promises";

let db;
try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  const rules = [
    ["users", "user_name", "chk_user_name_nonempty"],
    ["laboratories", "lab_name", "chk_lab_name_nonempty"],
    ["laboratories", "location", "chk_lab_location_nonempty"],
    ["equipment", "equipment_name", "chk_equipment_name_nonempty"],
    ["fault_reports", "fault_description", "chk_fault_description_nonempty"],
  ];
  const statements = [];

  for (const [table, column, name] of rules) {
    const [invalid] = await db.query(
      `SELECT COUNT(*) AS count FROM \`${table}\` WHERE CHAR_LENGTH(TRIM(\`${column}\`)) = 0`,
    );
    if (invalid[0].count) {
      throw new Error(`Existing blank values in ${table}.${column}; no automatic data changes made.`);
    }

    const sql = `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` CHECK (CHAR_LENGTH(TRIM(\`${column}\`)) > 0)`;
    statements.push(`${sql};`);

    const [existing] = await db.execute(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, name],
    );
    if (!existing.length) {
      await db.query(sql);
      console.log(`Added ${name}`);
    }
  }

  await writeFile("database/nonempty-constraints.sql",
    "-- Migration for an existing schema that lacks these constraints.\n"
    + "-- Fresh schema.sql already includes them after export.\n"
    + statements.join("\n\n") + "\n");

  const text = (value) => String(value ?? "-")
    .replaceAll("|", "\\|").replaceAll("\n", " ");

  const tables = ["users", "laboratories", "equipment", "bookings", "fault_reports"];
  const document = [
    "# SQL data dictionary",
    "",
    "Generated from the implemented MySQL database. Contains schema metadata only.",
    "",
  ];

  for (const table of tables) {
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [table],
    );

    document.push(`## ${table}`, "",
      "| Attribute | Type | Nullable | Default | Extra |",
      "| --- | --- | --- | --- | --- |");
    for (const column of columns) {
      document.push(`| ${[
        column.COLUMN_NAME, column.COLUMN_TYPE, column.IS_NULLABLE,
        column.COLUMN_DEFAULT, column.EXTRA,
      ].map(text).join(" | ")} |`);
    }

    const [ddl] = await db.query(`SHOW CREATE TABLE \`${table}\``);
    document.push("", "### Keys constraints and indexes", "", "```sql",
      ddl[0]["Create Table"].replace(/ AUTO_INCREMENT=\d+/g, "") + ";",
      "```", "");
  }

  await writeFile("docs/data-dictionary.md", document.join("\n"));
  console.log("Saved SQL migration and complete data dictionary.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}