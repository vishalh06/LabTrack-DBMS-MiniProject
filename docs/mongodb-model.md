# MongoDB repair history

Database: labtrack
Collection: repair_updates

MySQL owns fault reports, technician assignments, fault status, and equipment status.
MongoDB owns flexible investigation and repair details.

Each repair update contains:
- event_id: unique request identifier, reused when retrying the same update
- fault_id: positive integer identifying the MySQL fault
- technician_id: positive integer identifying the authenticated technician
- action: Diagnosis, Progress, or Repair
- notes: required text, up to 5000 characters
- details: an object containing fault-specific fields, such as readings or parts
- created_at: server-generated BSON date

Before insertion, the backend must verify the MySQL fault exists and the
authenticated technician is assigned to it. Do not trust technician_id from
the browser. MongoDB cannot enforce foreign keys to MySQL.

Read one fault's repair history by fault_id, ordered by created_at.
The compound fault/history index supports this retrieval.
event_id has a unique index to prevent duplicate retry submissions.

Repair notes do not automatically resolve a MySQL fault. Resolution must use
a separate authorised MySQL transaction. Both fault changes and booking changes
must lock the equipment row first. Availability must consider unresolved faults
and outstanding issued bookings.

A failure saving repair notes must be shown to the user and support retry.
Do not report success if MongoDB rejected or failed the write.

Setup:
npm run db:mongo

The setup script creates or updates validation and indexes, pings MongoDB,
and checks rejection of an invalid document.

Vidit's remaining work:
- Fault-report and assignment APIs and screens
- Technician-role and assignment validation
- Repair-update insertion and retrieval
- Fault-resolution workflow
- Useful aggregation and reports
- Cross-database integration tests