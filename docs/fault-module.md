# Fault management module

## Workflow

```
Student/Staff reports fault   ->  fault_reports.status = Reported (no technician)
Staff assigns a technician    ->  Under Repair (assigned_date set by trigger)
Technician adds repair notes  ->  MongoDB repair_updates (history)
Technician marks resolved     ->  Resolved (resolved_date set by trigger)
```

Equipment status follows the fault: reporting marks Available equipment
`Under Repair`; equipment that is `Issued` stays `Issued` (the return workflow
moves it afterwards). Resolving sets the equipment to `Issued` if a booking is
still issued, `Under Repair` if another fault is open, otherwise `Available`.

## Setup (existing or fresh database)

```
npm run db:faults     # adds columns, audit table, views, triggers (idempotent)
npm run db:mongo      # MongoDB collection, validator and indexes
npm run test:faults   # fault workflow tests
npm run test:bookings # regression tests for the booking workflow
```

## API

| Route | Roles | Purpose |
| --- | --- | --- |
| `POST /api/faults` | Student, Staff | Report a fault `{equipment_id, description}` |
| `GET /api/faults?status=` | all (scoped) | Student: own faults, Technician: assigned, Staff: all + technician list |
| `PATCH /api/faults` `{action:"assign"}` | Staff | Assign / reassign `{fault_id, technician_id}` |
| `PATCH /api/faults` `{action:"resolve"}` | assigned Technician | Resolve `{fault_id}` |
| `POST /api/repairs` | assigned Technician | Add repair note `{event_id, fault_id, action, notes, details}` |
| `GET /api/repairs?fault_id=` | Staff, assigned Technician | Repair history from MongoDB |
| `GET /api/reports` | Staff | SQL aggregates plus MongoDB aggregation |

Repair notes: `technician_id` comes from the session. Retrying with the same
`event_id` returns success without creating a second document. If MongoDB is
down the API returns 502 and records nothing.

## SQL objects added by `001_fault_management.sql`

| Object | Type | Purpose |
| --- | --- | --- |
| `fault_reports.assigned_date`, `resolved_date` | columns | Lifecycle dates |
| `fault_audit` | table | History of status/technician changes (FK to fault, ON DELETE CASCADE) |
| `trg_fault_before_insert` | trigger | New faults must be Reported and unassigned |
| `trg_fault_before_update` | trigger | Only Technician-role users assignable; blocks Reported->Resolved, Under Repair->Reported, edits to Resolved; sets dates |
| `trg_fault_after_insert` / `trg_fault_after_update` | triggers | Write the audit rows |
| `vw_fault_details` | view | 5-table join (fault, equipment, lab, reporter, technician) |
| `vw_technician_workload` | view | LEFT JOIN + GROUP BY, open/resolved/avg days |
| `vw_lab_fault_summary` | view | Faults per laboratory |

## Viva: likely questions

**Why triggers if the API already checks?** The API gives friendly errors; the
triggers guarantee the rules even for direct SQL. `test:faults` proves it by
issuing raw `UPDATE`s that the triggers reject.

**Why no CHECK constraint for "Under Repair needs a technician"?** The
technician foreign key is `ON DELETE SET NULL`, and MySQL does not allow a
CHECK on a column used in a SET NULL action. A trigger is used instead.

**Why is the equipment row locked first?** Bookings and faults both change
`equipment_status`. One consistent lock order (equipment, then fault/booking)
prevents deadlocks and lost updates.

**Why MongoDB for repair notes?** Notes have flexible `details`, are
append-only and read as a history. MySQL stays the source of truth for who is
assigned; Mongo stores only the notes.

**Normalisation:** fault data is in `fault_reports`; names are fetched by join,
not copied (3NF). The audit table is deliberate history, not redundancy.

### Demo queries

```sql
-- Open faults with technician (join)
SELECT fault_id, equipment_name, lab_name, technician_name, fault_status
FROM vw_fault_details WHERE fault_status <> 'Resolved';

-- Technician workload (outer join + aggregate)
SELECT * FROM vw_technician_workload;

-- Equipment with more than one fault (GROUP BY / HAVING)
SELECT e.equipment_name, COUNT(*) AS faults
FROM fault_reports f JOIN equipment e ON e.equipment_id = f.equipment_id
GROUP BY e.equipment_id, e.equipment_name HAVING COUNT(*) > 1;

-- Unassigned faults older than 2 days (subquery-free filter on a view)
SELECT * FROM vw_fault_details WHERE fault_status = 'Reported' AND age_days > 2;

-- Lifecycle of one fault (audit trigger)
SELECT * FROM fault_audit WHERE fault_id = 1 ORDER BY audit_id;

-- Trigger demo: must fail with 'Only a user with the Technician role...'
UPDATE fault_reports SET technician_id = 1 WHERE fault_id = 1; -- use a Student's id
```

### CRUD map
Create: report fault, repair note. Read: fault list, history, reports.
Update: assign, resolve. Delete: faults are never deleted (audit trail);
deleting equipment or a lab that has faults is blocked by foreign keys.
