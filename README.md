# LabTrack

Laboratory Equipment Booking and Fault Management System.

Members: Vishal and Vidit.

## Current implementation

- Student, Staff, and Technician login
- Password hashing and signed HTTP-only session cookies
- Backend authentication and role checks
- Equipment catalogue with search and filters
- Staff laboratory and equipment management
- Student booking requests and personal history
- Staff approval, rejection, equipment issue, and return
- Booking transactions, equipment locks, and allocation validation procedure
- MySQL constraints and indexes
- MongoDB connection helper, repair collection validation, and indexes

Fault-management screens, repair operations, and final reports are pending.

## Requirements

- Node.js and npm compatible with the installed Next.js version
- MySQL 8.0.16 or later
- MongoDB Community Server
- Git

Development used MySQL 8.0.34.
Use package-lock.json and npm ci to reproduce the npm dependencies.

## Fresh installation

1. Clone the repository and open its folder.
2. Run npm ci.
3. Copy .env.example to .env.local.
4. Configure MySQL credentials, MongoDB URI, and APP_ORIGIN.
5. Generate AUTH_SECRET with:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
6. Ensure MySQL and MongoDB services are running.
7. Run npm run db:setup.
8. Run npm run db:procedure.
9. Run npm run db:seed.
10. Run npm run db:mongo.
11. Run npm run dev.
12. Open http://localhost:3000.

db:setup targets the labtrack database and refuses to change an existing
database containing tables. Do not drop an existing database to bypass this
check. Review schema changes as migrations.

Setup requires database creation and procedure privileges.
Use a dedicated database account with appropriate permissions for deployment.

## Demonstration accounts

- Student: student@labtrack.local
- Staff: staff@labtrack.local
- Technician: technician@labtrack.local

New demonstration accounts use LabTrack@123.
The seed script does not overwrite existing accounts.
These accounts are for local demonstrations; change them before deployment.

## Commands

- npm run dev
- npm run lint
- npx tsc --noEmit
- npm run build
- npm start
- npm run test:bookings
- npm run db:mongo

Run the application before test:bookings.
Tests use APP_ORIGIN and create temporary users, equipment, and bookings.
They remove their temporary data and save results in
docs/automated-test-results.json.

## Security and configuration

Never commit .env.local or share real database credentials.
Keep APP_ORIGIN consistent with the browser URL.
Production cookies use the Secure flag; deployment requires HTTPS.
Authentication tokens expire after eight hours.
Logout clears the browser cookie; server-side token revocation is not
implemented. Login rate limiting is not implemented.

## Database design

MySQL tables:
users, laboratories, equipment, bookings, fault_reports.

database/schema.sql contains the current table definitions.
database/validate-allocation.sql defines sp_validate_allocation.
The procedure is installed through npm run db:procedure.

The procedure validates approval and issue operations.
The API owns the transaction, locks equipment before the booking,
calls the procedure, updates records, and commits or rolls back.
Booking mutations use READ COMMITTED isolation.

Approval checks overlapping Approved bookings and any outstanding issue.
Pending requests from different students may compete; only one conflicting
request can be approved.
An outstanding issue conservatively blocks new requests for that equipment.
Dates are interpreted using the MySQL server's current date.

MongoDB owns flexible repair updates; MySQL owns current operational state.
See docs/mongodb-model.md and docs/HANDOVER.md.

## Repository contributions

Vishal implements the first half.
Vidit continues with fault management, reports, integration testing,
and final documentation. Each member commits their own actual work.