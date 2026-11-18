# LabTrack
## Laboratory Equipment Booking and Fault Management System

**Project Type:** DBMS Mini Project  
**Team Members:** Vishal and Vidit  
**Technology Stack:** Next.js, TypeScript, MySQL, MongoDB

---

## 1. Abstract

LabTrack is a web-based Laboratory Equipment Booking and Fault Management System designed to simplify the management of laboratory equipment in educational institutions.

The system provides separate access for students, staff, and technicians. Students can browse available equipment, submit booking requests, and report equipment faults. Staff members can manage laboratories and equipment, approve or reject bookings, issue and return equipment, and assign faults to technicians. Technicians can view assigned faults, record repair activities, and resolve reported issues.

The application uses MySQL to maintain structured records such as users, laboratories, equipment, bookings, and fault reports. MongoDB is used to store detailed repair history. This combination demonstrates the use of relational and NoSQL databases in a practical application.

The project focuses on data consistency, role-based access control, transaction management, database constraints, triggers, views, and automated testing.

## 2. Introduction

Laboratories contain equipment that must be properly maintained and shared among students and staff. Managing equipment availability, booking requests, and maintenance activities manually can lead to scheduling conflicts, inaccurate records, and delays in resolving equipment problems.

LabTrack addresses these challenges through a centralized web application.

The system allows users to perform their tasks according to their assigned roles while maintaining consistent equipment records and providing visibility into booking and fault-management activities.

## 3. Problem Statement

Traditional laboratory equipment management often depends on manual registers, spreadsheets, or disconnected communication.

This creates several problems:

- Difficulty tracking equipment availability.
- Conflicts between multiple booking requests.
- Lack of centralized booking history.
- Delays in reporting and assigning equipment faults.
- Difficulty tracking technician repair activities.
- Inconsistent equipment status updates.
- Limited reporting and monitoring capabilities.

LabTrack aims to solve these problems using a database-driven application with automated workflows and controlled access.

## 4. Objectives

The main objectives are:

1. Develop a centralized laboratory equipment management system.
2. Provide secure login and role-based access.
3. Allow students to request equipment bookings.
4. Enable staff to approve, reject, issue, and return equipment.
5. Prevent conflicting equipment allocations.
6. Allow students and staff to report equipment faults.
7. Enable staff to assign faults to technicians.
8. Maintain detailed repair history.
9. Use database triggers, views, constraints, and transactions.
10. Generate useful reports for monitoring equipment and fault activities.

## 5. Scope of the Project

The project covers:

- Student, staff, and technician authentication.
- Laboratory and equipment management.
- Equipment search and filtering.
- Booking request management.
- Booking approval and rejection.
- Equipment issue and return.
- Fault reporting and assignment.
- Technician repair updates.
- Fault resolution.
- Fault audit tracking.
- Laboratory and technician reports.

The application is designed as a centralized system that can be extended with additional laboratory-management features.

## 6. Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Web application framework |
| TypeScript | Type-safe application development |
| React | User interface |
| MySQL | Relational database |
| MongoDB | Repair history storage |
| Node.js | Backend execution environment |
| SQL | Database queries, constraints, triggers, and views |
| npm | Package management |

### Why MySQL?

MySQL is used for structured and relational data, including users, laboratories, equipment, bookings, and fault reports.

It supports transactions, foreign keys, constraints, indexes, and triggers, helping maintain data integrity.

### Why MongoDB?

MongoDB is used for repair activity records because repair notes and maintenance history are naturally represented as documents.

This demonstrates how relational and document-oriented databases can be used together.

## 7. System Users and Roles

### 7.1 Student

Students can:

- Log in to the application.
- Browse available equipment.
- Search and filter equipment.
- Submit booking requests.
- View their booking history.
- Report equipment faults.

### 7.2 Staff

Staff members can:

- Manage laboratories and equipment.
- View booking requests.
- Approve or reject requests.
- Issue and return equipment.
- View reported faults.
- Assign and reassign technicians.
- Monitor fault reports and dashboard summaries.

### 7.3 Technician

Technicians can:

- Log in to the application.
- View faults assigned to them.
- Add repair notes.
- Update repair progress through the permitted workflow.
- Resolve assigned faults.

## 8. System Architecture

LabTrack follows a web-based client-server architecture.

The frontend communicates with backend API routes. The backend performs authentication, authorization, validation, and database operations.

MySQL stores the primary application records, while MongoDB stores detailed repair history.

**Architecture flow:**

```text
                 USER
                   |
                   v
             NEXT.JS UI
                   |
                   v
             BACKEND APIs
                   |
          AUTHENTICATION
          ROLE VALIDATION
          INPUT VALIDATION
                   |
             +-----+-----+
             |           |
             v           v
          MySQL       MongoDB
             |           |
       Core Records   Repair History
             |
             v
       Reports and Views
```

## 9. Database Design

The project uses two database systems.

### 9.1 MySQL Database

The MySQL database is named `labtrack_new`.

It stores the main application data and maintains relationships between entities.

Important entities include:

- Users
- Laboratories
- Equipment
- Bookings
- Fault Reports
- Fault Audit Records

Foreign keys maintain relationships between related records. Constraints help prevent invalid data, while indexes improve query performance.

### 9.2 MongoDB Database

MongoDB stores repair activity in the `repair_updates` collection.

Each repair record can contain information such as:

- Fault identifier.
- Technician identifier.
- Repair note.
- Event identifier.
- Timestamp.

Schema validation helps ensure that documents follow the expected structure.

### 9.3 Database Relationship Overview

The main relationships include:

- A laboratory can contain multiple equipment records.
- A student can create multiple booking requests.
- Equipment can have multiple booking records over time.
- Equipment can have multiple fault reports over time.
- A technician can be assigned multiple faults.
- A fault can have multiple repair updates.
- Fault status changes can generate audit records.

The detailed ER diagram is maintained separately in `docs/er-diagram.md`.

## 10. Booking Management Module

The booking module manages the process of requesting and allocating laboratory equipment.

### Workflow

1. Student selects available equipment.
2. Student submits a booking request.
3. Staff reviews the request.
4. Staff approves or rejects the request.
5. Approved equipment can be issued.
6. Staff records the equipment return.

### Transaction Management

Transactions are used to maintain consistency during booking operations.

The application locks the relevant equipment record before making availability-related changes. This helps prevent two users from allocating the same equipment simultaneously.

The system also uses database constraints and validation to prevent invalid operations.

## 11. Fault Management Module

The fault management module allows equipment problems to be reported, assigned, tracked, and resolved.

### Workflow

```text
       Fault Reported
              |
              v
       Staff Assignment
              |
              v
        Under Repair
              |
              v
       Technician Adds
         Repair Notes
              |
              v
        Fault Resolved
```

### Main Features

- Student and staff fault reporting.
- Staff fault monitoring.
- Technician assignment and reassignment.
- Technician repair notes.
- Fault resolution.
- Equipment status management.
- Fault audit history.
- Laboratory fault summaries.
- Technician workload reports.

### Fault Statuses

The system uses three primary statuses:

- `Reported`
- `Under Repair`
- `Resolved`

### Equipment Status Consistency

When a fault is reported or resolved, equipment status is handled according to its current booking and fault conditions.

The system considers active issued bookings and other unresolved faults before determining the appropriate equipment status.

This prevents an equipment item from being incorrectly marked as available while another issue remains unresolved.

## 12. Database Triggers and Views

The fault-management migration introduces database-level automation.

### Triggers

Four triggers are implemented:

- `trg_fault_before_insert`
- `trg_fault_before_update`
- `trg_fault_after_insert`
- `trg_fault_after_update`

These triggers support fault validation and audit-related operations.

### Views

Three views are created:

- `vw_fault_details` – provides detailed fault information.
- `vw_lab_fault_summary` – provides laboratory-level fault summaries.
- `vw_technician_workload` – provides technician workload information.

These views simplify reporting and reduce repeated query logic.

## 13. Security Features

The application includes:

- Password hashing.
- Signed HTTP-only session cookies.
- Backend authentication.
- Role-based authorization.
- Input validation.
- Parameterised SQL queries.
- Origin checks for cookie-authenticated mutations.
- Protected API endpoints.

Access to booking, equipment, fault, and reporting operations is controlled according to user roles.

## 14. Testing and Verification

Testing was performed to verify the core booking and fault-management workflows.

### Automated Testing Results

| Test | Result |
|---|---|
| Booking tests | 17 passed |
| Fault tests | 58 passed |
| Fault test failures | 0 |
| Fault test skipped | 0 |
| MongoDB validation checks | 3 passed |
| Lint | Successful |
| TypeScript check | Successful |
| Production build | Successful |

### Additional Verification

The following commands were executed successfully:

```bash
npm run db:faults
npm run db:mongo
npm run test:bookings
npm run test:faults
npm run lint
npx tsc --noEmit
npm run build
```

### Manual Workflow Testing

The following workflows were manually checked:

1. Student login and fault reporting.
2. Staff login and technician assignment.
3. Technician login and repair-note submission.
4. Technician fault resolution.
5. Staff access to the reports dashboard.

Automated test outputs are stored in:

- `docs/automated-test-results.json`
- `docs/automated-fault-test-results.json`

## 15. Challenges and Solutions

| Challenge | Solution |
|---|---|
| Preventing conflicting equipment bookings | Used MySQL transactions and row locking |
| Maintaining equipment status consistency | Added backend validation and database-level logic |
| Managing different user permissions | Implemented role-based access control |
| Tracking repair activities | Used MongoDB for repair history |
| Maintaining fault audit records | Implemented SQL triggers and an audit table |
| Simplifying reporting queries | Created SQL views |
| Preventing duplicate repair events during retries | Used event identifiers |

## 16. Limitations and Future Enhancements

Although the core system is implemented, the following improvements can be considered:

- Email notifications for booking and fault updates.
- Advanced analytics and visual dashboards.
- Equipment maintenance scheduling.
- QR-code-based equipment identification.
- Exportable PDF and Excel reports.
- Improved authentication controls, including rate limiting and server-side session revocation.
- Cloud deployment and centralized database hosting.
- More extensive security and performance testing.

## 17. Conclusion

LabTrack demonstrates how database management concepts can be applied to a practical laboratory-management problem.

The system combines a web application with MySQL and MongoDB to manage equipment, bookings, faults, and repair activities.

It demonstrates relational database design, transactions, foreign keys, constraints, indexes, triggers, views, role-based access control, and NoSQL document storage.

The completed booking and fault-management modules were tested using automated tests and manual workflows. The project successfully demonstrates the use of database technologies to build a centralized and structured laboratory equipment management solution.

## 18. References

- Next.js Documentation: https://nextjs.org/docs
- MySQL Documentation: https://dev.mysql.com/doc/
- MongoDB Documentation: https://www.mongodb.com/docs/
- TypeScript Documentation: https://www.typescriptlang.org/docs/
- Node.js Documentation: https://nodejs.org/docs/

---

**Project:** LabTrack – Laboratory Equipment Booking and Fault Management System

**Team Members:** Vishal and Vidit

**Status:** Core booking and fault-management implementation completed and tested.