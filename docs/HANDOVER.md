# LabTrack handover from Vishal to Vidit

## Working foundation

Next.js App Router, TypeScript, MySQL, MongoDB.
Keep the existing project structure and review AGENTS.md and bundled
Next.js documentation before implementation.

Next.js Cache Components is enabled.
Do not add route-segment runtime declarations with this configuration.
Authenticated GET handlers call await connection() outside their try/catch
before accessing request-specific authentication.

## Completed

- Five MySQL tables, foreign keys, checks, and indexes
- Authentication, role checks, signed session cookies
- Laboratory and equipment management
- Equipment catalogue, search, and filters
- Request, approve, reject, issue, and return workflow
- Transaction locks and concurrent allocation protection
- Allocation-validation stored procedure integrated into the API
- MongoDB helper, repair_updates schema validation, and indexes
- Schema export and fresh-install scripts
- TypeScript, lint, and clean production build
- Manual booking and management checks
- Automated API/database checks, including concurrent approvals

See automated-test-results.json for the latest actual test run.

## API map

POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
GET /api/catalog
GET /api/bookings
POST /api/bookings
PATCH /api/bookings
POST /api/manage

Use requireUser() for backend role enforcement.
Use checkOrigin() on cookie-authenticated mutations.
Use parameterised SQL.
Do not expose credentials or password hashes.

## Remaining work

1. Implement fault reporting and staff assignment screens/APIs.
2. Validate Technician role and actual assignment before repair operations.
3. Add MongoDB repair-update insertion and history retrieval.
4. Add fault-resolution transactions.
5. Implement the fault-related trigger and useful SQL views.
6. Add dashboards, report queries, and MongoDB aggregation.
7. Test permissions, invalid inputs, failure handling, and cross-database workflows.
8. Update the final ER diagram, relational schema, and data dictionary.
9. Finish the required report, screenshots, important-query explanations,
   architecture, conclusions, and demonstration.
10. Verify setup from a clean installation on Vidit's machine.

## Integration rules

MySQL owns fault status, equipment status, and assignments.
MongoDB owns detailed repair history.
Read docs/mongodb-model.md for the document contract.

All booking/fault operations that change equipment availability must:
- begin a MySQL transaction
- lock the equipment row first
- validate current records
- update related records consistently
- commit or roll back

Fault reporting must block further issue without erasing an outstanding issue.
Fault resolution must consider other unresolved faults and active issued bookings.
A return must keep equipment Under Repair when an unresolved fault remains.
Do not let forms edit equipment status directly.

There is no atomic transaction across MySQL and MongoDB.
Keep repair-note writes separate from authoritative SQL state transitions,
show write failures, and reuse event_id on retries.

## Known limits

- Demonstration authentication has no server-side token revocation or rate limiting.
- The development environment uses locally configured MySQL credentials.
- Dependency audit findings have not yet been reviewed and resolved.
- Full clean-install reproduction on Vidit's machine is still pending.
- Fault-management operations and reports are not implemented yet.
- Existing ER artwork predates the authentication/schema additions.

Do not describe pending features or unperformed checks as complete.