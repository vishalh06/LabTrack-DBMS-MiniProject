import mysql from "mysql2/promise";
import { hash } from "bcryptjs";

let db;
try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  await db.beginTransaction();
  const demoPassword = "LabTrack@123";
  const passwordHash = await hash(demoPassword, 12);

  const accounts = [
    ["Vishal", "student@labtrack.local", "Student"],
    ["Lab Staff", "staff@labtrack.local", "Staff"],
    ["Lab Technician", "technician@labtrack.local", "Technician"],
  ];

  for (const [name, email, role] of accounts) {
    const [existing] = await db.execute(
      "SELECT user_id FROM users WHERE email = ?", [email],
    );
    if (!existing.length) {
      await db.execute(
        "INSERT INTO users (user_name, email, password_hash, user_role) VALUES (?, ?, ?, ?)",
        [name, email, passwordHash, role],
      );
    }
  }

  const [labs] = await db.query("SELECT lab_id FROM laboratories LIMIT 1");
  if (!labs.length) {
    const [robotics] = await db.execute(
      "INSERT INTO laboratories (lab_name, location) VALUES (?, ?)",
      ["Robotics Lab", "Block A, Ground Floor"],
    );
    const [electronics] = await db.execute(
      "INSERT INTO laboratories (lab_name, location) VALUES (?, ?)",
      ["Electronics Lab", "Block B, First Floor"],
    );

    const equipment = [
      ["Arduino Uno 01", robotics.insertId],
      ["ESP32 Development Board 01", robotics.insertId],
      ["Ultrasonic Sensor Kit 01", robotics.insertId],
      ["Digital Multimeter 01", electronics.insertId],
      ["Oscilloscope 01", electronics.insertId],
    ];

    for (const [name, labId] of equipment) {
      await db.execute(
        "INSERT INTO equipment (equipment_name, lab_id) VALUES (?, ?)",
        [name, labId],
      );
    }
  }

  await db.commit();
  console.log("Seed completed. Existing accounts were not overwritten.");
  console.log("New demo accounts use password: LabTrack@123");
  for (const [, email, role] of accounts) console.log(`${role}: ${email}`);
} catch (error) {
  if (db) await db.rollback();
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}