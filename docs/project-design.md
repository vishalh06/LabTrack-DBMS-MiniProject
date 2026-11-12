# LabTrack initial design

Members: Vishal and Vidit.

## Problem statement

University laboratories often track equipment availability, bookings, and
repairs in separate registers or spreadsheets. This can cause conflicting
allocations, incomplete equipment histories, and delays in resolving faults.
LabTrack provides a central application for equipment requests, staff approval,
issue and return tracking, and fault management.

## Objectives

- Maintain consistent laboratory and equipment records.
- Allow students to request individual equipment items for a date range.
- Prevent conflicting approved allocations and multiple active issues.
- Record equipment issue, return, and overdue status.
- Support fault assignment and repair history.
- Demonstrate relational integrity, transactions, stored procedures,
  indexing, and appropriate SQL and NoSQL integration.

## Scope

The project manages individually identified equipment, date-based lending,
and three roles: Student, Staff, and Technician.

Hourly reservations, online payments, email notifications, public signup,
and AI recommendations are outside the agreed scope.

Booking and equipment management are implemented.
Fault-management operations and reporting are assigned to Vidit's second half.
The fault table and MongoDB document foundation already exist.

## Functional requirements

1. Users can log in and log out.
2. The backend enforces access according to the authenticated user's role.
3. Users can browse and filter equipment.
4. Staff can create, edit, and delete eligible laboratories and equipment.
5. Students can request equipment and view only their own bookings.
6. Staff can approve or reject pending requests.
7. Staff can issue approved equipment during its booking period.
8. Staff can record returns and preserve booking history.
9. Conflicting allocations and equipment with unresolved faults are blocked.
10. Overdue issued bookings are identified from due dates.
11. The completed system must support fault reports and technician assignment.
12. The completed system must support repair notes and fault resolution.

Requirements 11 and 12 are pending application implementation.

## Relational schema

USERS(
  user_id PK, user_name, email UNIQUE, password_hash, user_role
)

LABORATORIES(
  lab_id PK, lab_name, location
)

EQUIPMENT(
  equipment_id PK, equipment_name, equipment_status,
  lab_id FK -> LABORATORIES.lab_id
)

BOOKINGS(
  booking_id PK,
  user_id FK -> USERS.user_id,
  equipment_id FK -> EQUIPMENT.equipment_id,
  booking_date, due_date, return_date, booking_status
)

FAULT_REPORTS(
  fault_id PK,
  equipment_id FK -> EQUIPMENT.equipment_id,
  reported_by FK -> USERS.user_id,
  technician_id FK -> USERS.user_id NULLABLE,
  fault_description, reported_date, fault_status
)

Each laboratory can contain many equipment items.
Each user and equipment item can have many historical bookings.
Each equipment item can have many fault reports.
A fault has one reporter and zero or one assigned technician.
A user may report many faults; a technician may be assigned many faults.

Foreign keys alone do not validate the assigned user's Technician role.
The fault implementation must enforce this additional rule.

See data-dictionary.md and database/schema.sql for actual constraints,
referential actions, column types, and indexes.
The earlier ER diagram must be reconciled with the final schema.

## Database choice

MySQL stores structured operational records requiring foreign keys, checks,
joins, and coordinated transactions.

MongoDB stores repair updates with variable diagnostic details. Different
faults can involve different readings, parts, and repair actions.
Its application integration remains pending.
See mongodb-model.md for the collection design and retrieval strategy.

## Architecture

The browser displays the Next.js interface.
Client components call Next.js Route Handlers.
The handlers validate requests, authenticate users, and enforce role access.
Server-only helpers connect to MySQL and MongoDB.

Current booking and management operations use MySQL.
The MongoDB helper is prepared for the pending repair APIs.
Database credentials remain in local environment configuration.

## Booking integrity

Booking mutations use transactions and READ COMMITTED isolation.
The equipment row is locked before booking status is changed.
Approval and issue operations call sp_validate_allocation.
The procedure checks status, dates, unresolved faults, and conflicts.

Issue updates booking and equipment together.
Return records its date and keeps faulty equipment under repair.
Failures roll back the transaction.

## Validation and security

MySQL enforces primary keys, foreign keys, unique email, date/status checks,
and nonempty names, locations, and fault descriptions.
The backend additionally validates request shapes and role permissions.
Passwords are hashed, SQL values are parameterised, and sessions use signed
HTTP-only cookies.

Rate limiting and server-side token revocation are not implemented.

## Validation evidence

Manual checks confirmed login for all three roles, the full booking workflow,
future-date issue rejection, and laboratory/equipment management.

Automated checks cover permissions, student data isolation, invalid dates,
duplicate requests, concurrent approvals, issue/return consistency, faulty
equipment rejection, referential deletion protection, and logout.

A production build passed. See automated-test-results.json for the latest
automated run. Clean setup on Vidit's machine remains to be verified.