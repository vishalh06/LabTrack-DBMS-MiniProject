import mysql from "mysql2/promise";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const results = [];
const userIds = [];
let db;
let labId;
let equipmentId;
let cleanupPassed = false;

function check(name, condition) {
  results.push({ name, passed: Boolean(condition) });
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

async function request(path, method = "GET", body, cookie) {
  const headers = {};
  if (method !== "GET") {
    headers.Origin = origin;
    headers["Content-Type"] = "application/json";
  }
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${origin}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { response, data, status: response.status };
}

async function login(email, password) {
  const result = await request("/api/auth/login", "POST", { email, password });
  if (result.status !== 200) throw new Error(`Test login failed: ${result.status}`);
  const cookie = result.response.headers.get("set-cookie");
  if (!cookie) throw new Error("Login did not set a cookie.");
  return cookie.split(";")[0];
}

try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  const tag = randomUUID().slice(0, 8);
  const password = randomUUID();
  const passwordHash = await hash(password, 12);
  const accounts = [];

  for (const [label, role] of [
    ["student1", "Student"],
    ["student2", "Student"],
    ["staff", "Staff"],
    ["technician", "Technician"],
  ]) {
    const email = `${label}-${tag}@labtrack.test`;
    const [result] = await db.execute(
      "INSERT INTO users (user_name, email, password_hash, user_role) VALUES (?, ?, ?, ?)",
      [`Test ${label}`, email, passwordHash, role],
    );
    userIds.push(result.insertId);
    accounts.push({ email, password, id: result.insertId });
  }

  const [lab] = await db.execute(
    "INSERT INTO laboratories (lab_name, location) VALUES (?, ?)",
    [`Automated Test ${tag}`, "Temporary test location"],
  );
  labId = lab.insertId;
  const [item] = await db.execute(
    "INSERT INTO equipment (equipment_name, lab_id) VALUES (?, ?)",
    [`Automated Equipment ${tag}`, labId],
  );
  equipmentId = item.insertId;

  const [dateRows] = await db.query(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
            DATE_FORMAT(CURDATE() + INTERVAL 1 DAY, '%Y-%m-%d') AS tomorrow`,
  );
  const { today, tomorrow } = dateRows[0];

  const cookies = [];
  for (const account of accounts) {
    cookies.push(await login(account.email, account.password));
  }
  const [student1, student2, staff, technician] = cookies;

  check("Unauthenticated catalogue access rejected",
    (await request("/api/catalog")).status === 401);

  check("Technician cannot access booking management",
    (await request("/api/bookings", "GET", undefined, technician)).status === 403);

  check("Student cannot manage equipment",
    (await request("/api/manage", "POST", {
      entity: "equipment", operation: "delete", id: equipmentId,
    }, student1)).status === 403);

  check("Student cannot approve bookings",
    (await request("/api/bookings", "PATCH", {
      booking_id: 1, action: "approve",
    }, student1)).status === 403);

  check("Reversed dates rejected",
    (await request("/api/bookings", "POST", {
      equipment_id: equipmentId,
      booking_date: tomorrow,
      due_date: today,
    }, student1)).status === 400);

  const body = {
    equipment_id: equipmentId,
    booking_date: today,
    due_date: tomorrow,
  };

  check("First student can request equipment",
    (await request("/api/bookings", "POST", body, student1)).status === 201);

  check("Duplicate overlapping student request rejected",
    (await request("/api/bookings", "POST", body, student1)).status === 409);

  check("Second student can submit a competing pending request",
    (await request("/api/bookings", "POST", body, student2)).status === 201);

  const own = await request("/api/bookings", "GET", undefined, student1);
  check("Student sees only their own booking",
    own.status === 200 && own.data.bookings.length === 1
    && own.data.bookings.every((booking) => booking.user_id === accounts[0].id));

  const [pending] = await db.execute(
    "SELECT booking_id FROM bookings WHERE equipment_id = ? ORDER BY booking_id",
    [equipmentId],
  );

  const approvals = await Promise.all(pending.map((booking) =>
    request("/api/bookings", "PATCH", {
      booking_id: booking.booking_id, action: "approve",
    }, staff),
  ));

  check("Concurrent conflicting approvals allow exactly one success",
    approvals.filter((result) => result.status === 200).length === 1
    && approvals.filter((result) => result.status === 409).length === 1);

  const winner = pending[approvals.findIndex((result) => result.status === 200)].booking_id;

  check("Staff can issue approved equipment",
    (await request("/api/bookings", "PATCH", {
      booking_id: winner, action: "issue",
    }, staff)).status === 200);

  const [issued] = await db.execute(
    "SELECT equipment_status FROM equipment WHERE equipment_id = ?",
    [equipmentId],
  );
  check("Issue updates equipment status", issued[0].equipment_status === "Issued");

  check("Staff can record return",
    (await request("/api/bookings", "PATCH", {
      booking_id: winner, action: "return",
    }, staff)).status === 200);

  const [returned] = await db.execute(
    `SELECT b.booking_status, b.return_date, e.equipment_status
     FROM bookings b JOIN equipment e ON e.equipment_id = b.equipment_id
     WHERE b.booking_id = ?`,
    [winner],
  );
  check("Return keeps booking and equipment consistent",
    returned[0].booking_status === "Returned"
    && returned[0].return_date !== null
    && returned[0].equipment_status === "Available");

  await db.execute(
    `INSERT INTO fault_reports
     (equipment_id, reported_by, fault_description, reported_date)
     VALUES (?, ?, ?, CURDATE())`,
    [equipmentId, accounts[0].id, "Temporary automated-test fault"],
  );

  check("Equipment with an unresolved fault cannot be requested",
    (await request("/api/bookings", "POST", body, student1)).status === 409);

  check("Referenced equipment cannot be deleted",
    (await request("/api/manage", "POST", {
      entity: "equipment", operation: "delete", id: equipmentId,
    }, staff)).status === 409);

  check("Logout succeeds",
    (await request("/api/auth/logout", "POST", undefined, student1)).status === 200);

} catch (error) {
  console.error(error.message);
  results.push({ name: error.message, passed: false });
  process.exitCode = 1;
} finally {
  if (db) {
    try {
      await db.beginTransaction();
      if (equipmentId) {
        await db.execute("DELETE FROM fault_reports WHERE equipment_id = ?", [equipmentId]);
        await db.execute("DELETE FROM bookings WHERE equipment_id = ?", [equipmentId]);
        await db.execute("DELETE FROM equipment WHERE equipment_id = ?", [equipmentId]);
      }
      if (labId) await db.execute("DELETE FROM laboratories WHERE lab_id = ?", [labId]);
      for (const id of userIds) {
        await db.execute("DELETE FROM users WHERE user_id = ?", [id]);
      }
      await db.commit();
      cleanupPassed = true;
      console.log("Temporary test data removed.");
    } catch (error) {
      await db.rollback();
      console.error("Test cleanup failed:", error.message);
      process.exitCode = 1;
    } finally {
      await db.end();
    }
  }

  await writeFile("docs/automated-test-results.json", JSON.stringify({
    runAt: new Date().toISOString(),
    cleanupPassed,
    results,
  }, null, 2));

  console.log("Results saved to docs/automated-test-results.json");
}