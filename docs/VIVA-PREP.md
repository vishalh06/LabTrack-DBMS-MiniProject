# LabTrack – Viva Preparation

**Project:** Laboratory Equipment Booking and Fault Management System  
**Team Members:** Vishal and Vidit  
**Technology:** Next.js, TypeScript, MySQL, MongoDB

---

# 1. Project Introduction

### Q1. What is your project?

LabTrack is a Laboratory Equipment Booking and Fault Management System. It helps students book laboratory equipment, staff manage bookings and equipment, and technicians handle equipment faults and repairs.

### Q2. Why did you choose this project?

We chose this project because laboratory equipment is shared among multiple students. Managing bookings, availability, and maintenance manually can create conflicts. Our application provides a centralized solution.

### Q3. What problem does your project solve?

It solves equipment booking conflicts, manual tracking problems, difficulty reporting faults, and lack of proper repair history.

### Q4. What are the main modules?

Our main modules are:
- Authentication and role management.
- Laboratory and equipment management.
- Booking management.
- Fault reporting and assignment.
- Technician repair management.
- Reports and audit tracking.

### Q5. Who are the users of the application?

There are three main roles:
- Student
- Staff
- Technician

Each role has different permissions.

# 2. Your Role in the Project

### Q6. What was your contribution?

I worked on the implementation and integration of the application, particularly the database-backed workflows and fault-management functionality. This included working with MySQL, MongoDB repair history, backend APIs, testing, and project documentation.

*Only mention the responsibilities you personally handled.*

### Q7. What was the most challenging part?

Maintaining equipment status consistently was one of the challenging parts. For example, resolving one fault should not make equipment available if another unresolved fault or active issued booking still exists.

### Q8. What did you learn from this project?

I learned practical database design, SQL transactions, triggers, views, backend API development, role-based access control, MongoDB integration, and automated testing.

# 3. Database Management System

### Q9. What is DBMS?

A Database Management System is software used to create, store, retrieve, update, and manage data efficiently.

Examples include MySQL, PostgreSQL, and Oracle.

### Q10. Why did you use MySQL?

We used MySQL because our application contains structured and related data such as users, equipment, bookings, and fault reports. MySQL supports relationships, foreign keys, transactions, and constraints.

### Q11. What are the main tables in your project?

The main MySQL entities include:
- USERS
- LABORATORIES
- EQUIPMENT
- BOOKINGS
- FAULT_REPORTS
- FAULT_AUDIT

### Q12. What is a primary key?

A primary key uniquely identifies each record in a table.

For example, `user_id` identifies each user.

### Q13. What is a foreign key?

A foreign key connects two tables and maintains referential integrity.

For example, `equipment_id` in the BOOKINGS table refers to the corresponding equipment record.

### Q14. What is referential integrity?

Referential integrity ensures that relationships between tables remain valid. A foreign key prevents references to records that do not exist.

### Q15. What is normalization?

Normalization is the process of organizing database tables to reduce redundant data and avoid insertion, deletion, and update anomalies.

### Q16. What is an index?

An index improves data retrieval speed by helping the database locate records efficiently.

However, indexes also require storage and can add overhead to insert and update operations.

# 4. SQL Concepts

### Q17. What is the difference between DELETE, TRUNCATE, and DROP?

- DELETE removes selected rows from a table.
- TRUNCATE removes all rows from a table.
- DROP removes the entire table structure and its data.

### Q18. What is a JOIN?

A JOIN combines records from two or more tables using related columns.

For example, we can join USERS and BOOKINGS to identify which student created a booking.

### Q19. What is a database transaction?

A transaction is a group of database operations treated as one logical unit.

It follows ACID properties.

### Q20. Explain ACID properties.

- Atomicity: All operations succeed or none are applied.
- Consistency: The database remains valid.
- Isolation: Concurrent transactions are controlled.
- Durability: Committed changes are preserved.

### Q21. What is a stored procedure?

A stored procedure is a group of SQL statements stored in the database and executed when required.

### Q22. What is a database trigger?

A trigger is a database operation that executes automatically when a specified event occurs, such as INSERT, UPDATE, or DELETE.

In LabTrack, triggers support fault validation and audit-related operations.

### Q23. What is a database view?

A view is a virtual table based on a SQL query.

We use views to simplify reporting and retrieve summarized information.

Our project includes:
- `vw_fault_details`
- `vw_lab_fault_summary`
- `vw_technician_workload`

# 5. Booking Management

### Q24. Explain the booking workflow.

First, a student selects available equipment and submits a booking request. Staff reviews the request and can approve or reject it. Approved equipment can then be issued and returned.

### Q25. How do you prevent double booking?

We use MySQL transactions and row locking to protect equipment availability during booking operations. This helps prevent concurrent requests from allocating the same equipment incorrectly.

### Q26. What is concurrency?

Concurrency means multiple users or transactions accessing the same data at the same time.

### Q27. Why is row locking important?

Row locking prevents conflicting transactions from modifying the same equipment record simultaneously during critical operations.

# 6. Fault Management

### Q28. Explain the fault-management workflow.

A student or staff member reports an equipment fault. Staff assigns the fault to a technician. The technician adds repair notes and resolves the fault after completing the repair.

### Q29. What are the fault statuses?

Our application uses three main statuses:

1. Reported
2. Under Repair
3. Resolved

### Q30. Why do you need a separate FAULT_AUDIT table?

It maintains a history of fault status changes. This helps track what happened to a fault and when the change occurred.

### Q31. What happens when a technician resolves a fault?

The fault status becomes Resolved. The system also checks other unresolved faults and active issued bookings before determining the correct equipment status.

### Q32. Why can't equipment always become Available after resolving a fault?

Because the equipment may have another unresolved fault or an active issued booking. Marking it available without checking these conditions could lead to incorrect allocations.

# 7. MongoDB Integration

### Q33. Why did you use MongoDB along with MySQL?

We used MySQL for structured relational data and MongoDB for detailed repair activity records.

Repair notes can vary in content, so a document-oriented database is suitable for storing this history.

### Q34. What is NoSQL?

NoSQL refers to non-relational database systems that support data models such as documents, key-value pairs, and graphs.

MongoDB is a document-oriented NoSQL database.

### Q35. What is a MongoDB collection?

A collection is a group of MongoDB documents. It is similar to a table in a relational database, but documents do not have to follow a fixed tabular structure.

### Q36. What is a MongoDB document?

A document is an individual record stored in BSON format. It contains fields and their corresponding values.

### Q37. Why not store everything in MySQL?

We could store repair notes in MySQL too, but we used MongoDB to demonstrate a hybrid database architecture and to keep detailed repair activity separate from the main relational records.

### Q38. How are MySQL and MongoDB connected?

Repair documents contain a `fault_id` that logically identifies the corresponding fault in MySQL.

This is an application-level relationship, not a MySQL foreign key.

# 8. Authentication and Security

### Q39. What is authentication?

Authentication verifies the identity of a user, usually through login credentials.

### Q40. What is authorization?

Authorization determines what an authenticated user is allowed to access or perform.

### Q41. What is role-based access control?

Role-based access control assigns permissions based on user roles.

For example, students can submit bookings, while staff can approve them.

### Q42. Why do you hash passwords?

Passwords should not be stored in plain text. Hashing stores a derived representation, making it harder to recover the original password if the database is exposed.

### Q43. What are HTTP-only cookies?

HTTP-only cookies cannot be accessed directly through browser JavaScript. They help protect session cookies from certain client-side attacks.

# 9. Testing and Results

### Q44. How did you test your project?

We used automated booking and fault tests, MongoDB validation checks, linting, TypeScript checks, production builds, and manual workflow verification.

### Q45. What were your test results?

- Booking tests: 17 passed.
- Fault tests: 58 passed.
- Fault test failures: 0.
- Fault test skipped: 0.
- MongoDB validation checks: 3 passed.
- Lint: Successful.
- TypeScript check: Successful.
- Production build: Successful.

### Q46. What is the purpose of automated testing?

Automated testing checks whether application functionality works as expected and helps detect errors when the code changes.

# 10. Common Tricky Viva Questions

### Q47. What happens if MongoDB is unavailable?

The repair-history operation can fail even if MySQL is working. The application should report that failure clearly. We do not treat a failed MongoDB write as a successful repair-history update.

### Q48. Do MySQL and MongoDB share one transaction?

No. They use separate database systems, and our implementation does not provide one atomic transaction across both databases.

### Q49. What is the difference between SQL and NoSQL?

SQL databases generally organize structured data into relational tables with defined schemas. NoSQL databases support other data models, such as MongoDB's document model.

### Q50. Can your project be extended?

Yes. Future improvements could include email notifications, QR-code equipment identification, advanced analytics, scheduled maintenance, and cloud deployment.

---

# 11. Important Commands for Demonstration

Start the application:

```bash
npm run dev
```

Run booking tests:

```bash
npm run test:bookings
```

Run fault tests:

```bash
npm run test:faults
```

Check MongoDB:

```bash
npm run db:mongo
```

Run lint:

```bash
npm run lint
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Create production build:

```bash
npm run build
```

---

# 12. Final 30-Second Project Explanation

"Good morning, our project is LabTrack, a Laboratory Equipment Booking and Fault Management System.

It is designed to simplify equipment booking, availability management, and maintenance tracking in laboratories.

We have three user roles: students, staff, and technicians. Students can book equipment and report faults, staff can manage bookings and assign technicians, and technicians can record repair activities and resolve faults.

We use MySQL for relational data and MongoDB for repair history. We have also implemented transactions, foreign keys, triggers, views, role-based access control, and automated testing.

The main objective is to make laboratory equipment management more organized, reliable, and efficient."

---

**Preparation tip:** Understand the concepts instead of memorizing every answer. Be especially confident about transactions, row locking, triggers, views, foreign keys, and why the project uses both MySQL and MongoDB.