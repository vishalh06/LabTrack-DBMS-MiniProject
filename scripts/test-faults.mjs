import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const results = [];
const userIds = [];
const equipmentIds = [];
const faultIds = [];
let labId;
let db;
let mongo;
let mongoUp = false;
let cleanupPassed = false;

function check(name, condition) {
  results.push({ name, passed: Boolean(condition) });
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

function skip(name) {
  results.push({ name, passed: null, skipped: true });
  console.log(`SKIP: ${name} (MongoDB not reachable)`);
}

async function request(path, method = "GET", body, cookie) {
  const headers = {};
  if (method !== "GET") {
    headers.Origin = origin;
    headers["Content-Type"] = "application/json";
  }
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${origin}${path}`, {
    method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { response, data, status: response.status };
}

async function login(email, password) {
  const result = await request("/api/auth/login", "POST", { email, password });
  if (result.status !== 200) throw new Error(`Test login failed: ${result.status}`);
  return result.response.headers.get("set-cookie").split(";")[0];
}

async function sqlRejects(sql, params) {
  try {
    await db.execute(sql, params);
    return null;
  } catch (error) {
    return error.code;
  }
}

try {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "labtrack",
  });

  mongo = new MongoClient(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
    { serverSelectionTimeoutMS: 2500 },
  );
  try {
    await mongo.connect();
    await mongo.db(process.env.MONGODB_DATABASE || "labtrack").command({ ping: 1 });
    mongoUp = true;
  } catch {
    mongoUp = false;
  }
  const updates = mongoUp
    ? mongo.db(process.env.MONGODB_DATABASE || "labtrack").collection("repair_updates")
    : null;

  const tag = randomUUID().slice(0, 8);
  const password = randomUUID();
  const passwordHash = await hash(password, 12);
  const accounts = [];
  for (const [label, role] of [
    ["student1", "Student"], ["student2", "Student"], ["staff", "Staff"],
    ["tech1", "Technician"], ["tech2", "Technician"],
  ]) {
    const email = `${label}-${tag}@labtrack.test`;
    const [result] = await db.execute(
      "INSERT INTO users (user_name, email, password_hash, user_role) VALUES (?, ?, ?, ?)",
      [`Test ${label}`, email, passwordHash, role],
    );
    userIds.push(result.insertId);
    accounts.push({ email, id: result.insertId });
  }
  const [s1, s2, , t1, t2] = accounts;

  const [lab] = await db.execute(
    "INSERT INTO laboratories (lab_name, location) VALUES (?, ?)",
    [`Fault Test ${tag}`, "Temporary test location"],
  );
  labId = lab.insertId;
  for (const name of ["A", "B"]) {
    const [item] = await db.execute(
      "INSERT INTO equipment (equipment_name, lab_id) VALUES (?, ?)",
      [`Fault Equipment ${name} ${tag}`, labId],
    );
    equipmentIds.push(item.insertId);
  }
  const [eqA, eqB] = equipmentIds;

  const cookies = [];
  for (const account of accounts) cookies.push(await login(account.email, password));
  const [student1, student2, staff, tech1, tech2] = cookies;

  const [dateRows] = await db.query(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
            DATE_FORMAT(CURDATE() + INTERVAL 1 DAY, '%Y-%m-%d') AS tomorrow`,
  );
  const { today, tomorrow } = dateRows[0];

  const equipmentStatus = async (id) => (await db.execute(
    "SELECT equipment_status FROM equipment WHERE equipment_id = ?", [id],
  ))[0][0].equipment_status;
  const faultRow = async (id) => (await db.execute(
    "SELECT * FROM fault_reports WHERE fault_id = ?", [id],
  ))[0][0];

  // ---- Access control and validation ----
  check("Unauthenticated fault list rejected",
    (await request("/api/faults")).status === 401);
  check("Technician cannot report faults",
    (await request("/api/faults", "POST", { equipment_id: eqA, description: "Technician report" }, tech1)).status === 403);
  check("Too-short description rejected",
    (await request("/api/faults", "POST", { equipment_id: eqA, description: "bad" }, student1)).status === 400);
  check("Invalid equipment id rejected",
    (await request("/api/faults", "POST", { equipment_id: -3, description: "Valid description" }, student1)).status === 400);
  check("Unknown equipment returns 404",
    (await request("/api/faults", "POST", { equipment_id: 2147483000, description: "Valid description" }, student1)).status === 404);
  check("Invalid status filter rejected",
    (await request("/api/faults?status=Nope", "GET", undefined, staff)).status === 400);

  // ---- Report a fault ----
  const reported = await request("/api/faults", "POST",
    { equipment_id: eqA, description: "Display flickers and goes blank" }, student1);
  check("Student can report a fault", reported.status === 201 && reported.data.fault_id);
  const fault1 = reported.data.fault_id;
  faultIds.push(fault1);

  let row = await faultRow(fault1);
  check("New fault is Reported, unassigned, dated",
    row.fault_status === "Reported" && row.technician_id === null && row.reported_date);
  check("Reporting a fault marks available equipment Under Repair",
    (await equipmentStatus(eqA)) === "Under Repair");
  check("Duplicate open report rejected",
    (await request("/api/faults", "POST",
      { equipment_id: eqA, description: "Display flickers and goes blank" }, student1)).status === 409);

  const second = await request("/api/faults", "POST",
    { equipment_id: eqA, description: "Power button is loose" }, student2);
  check("Second student can report a different fault", second.status === 201);
  const fault2 = second.data.fault_id;
  faultIds.push(fault2);

  // ---- Visibility ----
  const own = await request("/api/faults", "GET", undefined, student1);
  check("Student sees only their own faults",
    own.status === 200 && own.data.faults.length === 1
    && own.data.faults[0].fault_id === fault1 && own.data.technicians.length === 0);
  const all = await request("/api/faults", "GET", undefined, staff);
  check("Staff sees all faults and the technician list",
    all.data.faults.length >= 2 && all.data.technicians.some((t) => t.technician_id === t1.id));
  const filtered = await request("/api/faults?status=Reported", "GET", undefined, staff);
  check("Status filter works",
    filtered.data.faults.every((f) => f.fault_status === "Reported"));

  // ---- Booking is blocked while faulty ----
  check("Equipment with an open fault cannot be requested",
    (await request("/api/bookings", "POST",
      { equipment_id: eqA, booking_date: today, due_date: tomorrow }, student1)).status === 409);

  // ---- Assignment ----
  const assignBody = (faultId, technicianId) =>
    ({ action: "assign", fault_id: faultId, technician_id: technicianId });
  check("Student cannot assign",
    (await request("/api/faults", "PATCH", assignBody(fault1, t1.id), student1)).status === 403);
  check("Technician cannot assign",
    (await request("/api/faults", "PATCH", assignBody(fault1, t1.id), tech1)).status === 403);
  check("Assigning a non-technician is rejected",
    (await request("/api/faults", "PATCH", assignBody(fault1, s2.id), staff)).status === 400);
  check("Assigning an unknown fault returns 404",
    (await request("/api/faults", "PATCH", assignBody(2147483000, t1.id), staff)).status === 404);
  check("Invalid action body rejected",
    (await request("/api/faults", "PATCH", { action: "delete", fault_id: fault1 }, staff)).status === 400);

  check("Staff can assign a technician",
    (await request("/api/faults", "PATCH", assignBody(fault1, t1.id), staff)).status === 200);
  row = await faultRow(fault1);
  check("Assignment moves the fault to Under Repair with a date",
    row.fault_status === "Under Repair" && row.technician_id === t1.id && row.assigned_date);
  check("Assigning the same technician again is rejected",
    (await request("/api/faults", "PATCH", assignBody(fault1, t1.id), staff)).status === 409);

  const t1List = await request("/api/faults", "GET", undefined, tech1);
  check("Technician sees only their assigned faults",
    t1List.status === 200 && t1List.data.faults.length === 1 && t1List.data.faults[0].fault_id === fault1);
  const t2List = await request("/api/faults", "GET", undefined, tech2);
  check("Other technician sees none",
    t2List.status === 200 && t2List.data.faults.length === 0);

  // ---- Triggers (direct SQL) ----
  check("Trigger rejects assigning a non-technician",
    (await sqlRejects("UPDATE fault_reports SET technician_id = ? WHERE fault_id = ?", [s1.id, fault1])) === "ER_SIGNAL_EXCEPTION");
  check("Trigger rejects resolving an unassigned fault",
    (await sqlRejects("UPDATE fault_reports SET fault_status = 'Resolved' WHERE fault_id = ?", [fault2])) === "ER_SIGNAL_EXCEPTION");
  check("Trigger rejects inserting a fault that is not Reported",
    (await sqlRejects(
      "INSERT INTO fault_reports (equipment_id, reported_by, fault_description, reported_date, fault_status) VALUES (?, ?, 'x trigger test', CURDATE(), 'Resolved')",
      [eqA, s1.id])) === "ER_SIGNAL_EXCEPTION");
  const [audit] = await db.execute(
    "SELECT old_status, new_status FROM fault_audit WHERE fault_id = ? ORDER BY audit_id", [fault1]);
  check("Audit trigger recorded the report and the assignment",
    audit.length === 2 && audit[0].old_status === null && audit[0].new_status === "Reported"
    && audit[1].old_status === "Reported" && audit[1].new_status === "Under Repair");

  // ---- Repair updates (MongoDB) ----
  const eventId = randomUUID();
  const update = { event_id: eventId, fault_id: fault1, action: "Diagnosis", notes: "Backlight cable is loose", details: { parts: "cable" } };
  check("Student cannot add repair updates",
    (await request("/api/repairs", "POST", update, student1)).status === 403);
  check("Unassigned technician cannot add repair updates",
    (await request("/api/repairs", "POST", update, tech2)).status === 403);
  check("Invalid repair action rejected",
    (await request("/api/repairs", "POST", { ...update, action: "Guess" }, tech1)).status === 400);
  check("Repair update for an unknown fault returns 404",
    (await request("/api/repairs", "POST", { ...update, fault_id: 2147483000 }, tech1)).status === 404);
  check("Student cannot read repair history",
    (await request(`/api/repairs?fault_id=${fault1}`, "GET", undefined, student1)).status === 403);
  check("Unassigned technician cannot read repair history",
    (await request(`/api/repairs?fault_id=${fault1}`, "GET", undefined, tech2)).status === 403);

  if (mongoUp) {
    check("Assigned technician can add a repair update",
      (await request("/api/repairs", "POST", update, tech1)).status === 201);
    const retry = await request("/api/repairs", "POST", update, tech1);
    check("Retry with the same event_id is idempotent",
      retry.status === 200 && retry.data.duplicate === true);
    check("Only one document stored for the retried event",
      (await updates.countDocuments({ event_id: eventId })) === 1);
    const history = await request(`/api/repairs?fault_id=${fault1}`, "GET", undefined, staff);
    check("Staff can read repair history",
      history.status === 200 && history.data.updates.length === 1
      && history.data.updates[0].technician_id === t1.id);
    const stored = await updates.findOne({ event_id: eventId });
    check("technician_id is taken from the session, not the browser",
      stored.technician_id === t1.id);
  } else {
    const failed = await request("/api/repairs", "POST", update, tech1);
    check("MongoDB failure is reported as an error, never as success",
      failed.status === 502 && failed.data.success !== true);
    for (const name of [
      "Assigned technician can add a repair update",
      "Retry with the same event_id is idempotent",
      "Only one document stored for the retried event",
      "Staff can read repair history",
      "technician_id is taken from the session, not the browser",
    ]) skip(name);
  }

  // ---- Resolution ----
  check("Staff cannot resolve",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: fault1 }, staff)).status === 403);
  check("Unassigned technician cannot resolve",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: fault1 }, tech2)).status === 403);
  check("Resolving an unassigned (Reported) fault is rejected",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: fault2 }, tech1)).status === 403);

  check("Assigned technician can resolve",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: fault1 }, tech1)).status === 200);
  row = await faultRow(fault1);
  check("Resolved fault has a resolved date",
    row.fault_status === "Resolved" && row.resolved_date);
  check("Equipment stays Under Repair while another fault is open",
    (await equipmentStatus(eqA)) === "Under Repair");
  check("Resolving twice is rejected",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: fault1 }, tech1)).status === 409);
  check("Resolved fault cannot be reassigned",
    (await request("/api/faults", "PATCH", assignBody(fault1, t2.id), staff)).status === 409);
  check("Trigger rejects editing a resolved fault",
    (await sqlRejects("UPDATE fault_reports SET fault_status = 'Under Repair' WHERE fault_id = ?", [fault1])) === "ER_SIGNAL_EXCEPTION");

  check("Staff can reassign an open fault to another technician",
    (await request("/api/faults", "PATCH", assignBody(fault2, t2.id), staff)).status === 200);
  check("Second technician resolves the last open fault",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: fault2 }, tech2)).status === 200);
  check("Equipment becomes Available when all faults are resolved",
    (await equipmentStatus(eqA)) === "Available");

  // ---- Fault while equipment is issued ----
  const [booking] = await db.execute(
    "INSERT INTO bookings (user_id, equipment_id, booking_date, due_date) VALUES (?, ?, CURDATE(), CURDATE() + INTERVAL 1 DAY)",
    [s1.id, eqB]);
  check("Staff approves booking for equipment B",
    (await request("/api/bookings", "PATCH", { booking_id: booking.insertId, action: "approve" }, staff)).status === 200);
  check("Staff issues equipment B",
    (await request("/api/bookings", "PATCH", { booking_id: booking.insertId, action: "issue" }, staff)).status === 200);

  const issuedFault = await request("/api/faults", "POST",
    { equipment_id: eqB, description: "Probe tip is bent" }, student2);
  check("Fault can be reported on issued equipment", issuedFault.status === 201);
  faultIds.push(issuedFault.data.fault_id);
  check("Reporting does not erase the outstanding issue",
    (await equipmentStatus(eqB)) === "Issued");
  check("Assign technician to the issued-equipment fault",
    (await request("/api/faults", "PATCH", assignBody(issuedFault.data.fault_id, t1.id), staff)).status === 200);
  check("Resolve the issued-equipment fault",
    (await request("/api/faults", "PATCH", { action: "resolve", fault_id: issuedFault.data.fault_id }, tech1)).status === 200);
  check("Resolution keeps equipment Issued while the booking is outstanding",
    (await equipmentStatus(eqB)) === "Issued");
  check("Return after resolution makes equipment Available",
    (await request("/api/bookings", "PATCH", { booking_id: booking.insertId, action: "return" }, staff)).status === 200
    && (await equipmentStatus(eqB)) === "Available");

  // ---- Reports ----
  check("Student cannot read reports",
    (await request("/api/reports", "GET", undefined, student1)).status === 403);
  const report = await request("/api/reports", "GET", undefined, staff);
  check("Staff can read reports",
    report.status === 200 && Array.isArray(report.data.statusCounts)
    && report.data.workload.some((w) => w.technician_id === t1.id && w.resolved_faults >= 2)
    && report.data.labs.some((l) => l.total_faults >= 3));
  if (mongoUp) {
    check("Report includes MongoDB repair activity",
      report.data.mongoError === null && report.data.repairActivity.some((r) => r.technician_id === t1.id));
  } else {
    skip("Report includes MongoDB repair activity");
  }
} catch (error) {
  console.error(error.message);
  results.push({ name: error.message, passed: false });
  process.exitCode = 1;
} finally {
  if (db) {
    try {
      await db.beginTransaction();
      for (const id of equipmentIds) {
        await db.execute("DELETE FROM fault_reports WHERE equipment_id = ?", [id]);
        await db.execute("DELETE FROM bookings WHERE equipment_id = ?", [id]);
        await db.execute("DELETE FROM equipment WHERE equipment_id = ?", [id]);
      }
      if (labId) await db.execute("DELETE FROM laboratories WHERE lab_id = ?", [labId]);
      for (const id of userIds) await db.execute("DELETE FROM users WHERE user_id = ?", [id]);
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
  if (mongo) {
    if (mongoUp && faultIds.length) {
      await mongo.db(process.env.MONGODB_DATABASE || "labtrack")
        .collection("repair_updates").deleteMany({ fault_id: { $in: faultIds } });
    }
    await mongo.close();
  }

  await writeFile("docs/automated-fault-test-results.json", JSON.stringify({
    runAt: new Date().toISOString(),
    mongoReachable: mongoUp,
    cleanupPassed,
    results,
  }, null, 2));
  console.log("Results saved to docs/automated-fault-test-results.json");
}
