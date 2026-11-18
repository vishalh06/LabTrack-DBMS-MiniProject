# LabTrack – Entity Relationship Diagram

The following ER diagram represents the database structure of the LabTrack Laboratory Equipment Booking and Fault Management System.

It includes the main MySQL entities and the MongoDB repair-history collection.

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : requests
    EQUIPMENT ||--o{ BOOKINGS : "is booked in"
    LABORATORIES ||--o{ EQUIPMENT : contains

    EQUIPMENT ||--o{ FAULT_REPORTS : "has faults"
    USERS ||--o{ FAULT_REPORTS : "reports"
    USERS o|--o{ FAULT_REPORTS : "is assigned to"

    FAULT_REPORTS ||--o{ FAULT_AUDIT : "has audit records"
    FAULT_REPORTS ||--o{ REPAIR_UPDATES_MONGO : "has repair updates"

    USERS {
        int user_id PK
        string email UK
        enum user_role
    }

    LABORATORIES {
        int lab_id PK
        string lab_name
    }

    EQUIPMENT {
        int equipment_id PK
        int lab_id FK
        enum equipment_status
    }

    BOOKINGS {
        int booking_id PK
        int user_id FK
        int equipment_id FK
        enum booking_status
    }

    FAULT_REPORTS {
        int fault_id PK
        int equipment_id FK
        int reported_by FK
        int technician_id FK
        enum fault_status
        date reported_date
        date assigned_date
        date resolved_date
    }

    FAULT_AUDIT {
        int audit_id PK
        int fault_id FK
        enum new_status
        timestamp changed_at
    }

    REPAIR_UPDATES_MONGO {
        string event_id UK
        int fault_id
        int technician_id
        string action
        date created_at
    }
```

## Database Design Notes

### MySQL Entities

- `USERS`: Stores student, staff, and technician information.
- `LABORATORIES`: Stores laboratory details.
- `EQUIPMENT`: Stores equipment information and its current status.
- `BOOKINGS`: Stores equipment booking requests and their status.
- `FAULT_REPORTS`: Stores reported faults, assigned technicians, and fault status.
- `FAULT_AUDIT`: Stores fault status audit records generated through database triggers.

### MongoDB Collection

`REPAIR_UPDATES_MONGO` represents the MongoDB `repair_updates` collection in this conceptual diagram.

It stores detailed repair activities separately from the main MySQL database.

The `fault_id` connects repair-history documents logically to their corresponding MySQL fault records. It is not a MySQL foreign key.

### Important Relationships

- One user can create multiple bookings.
- One laboratory can contain multiple equipment items.
- One equipment item can have multiple booking records over time.
- One equipment item can have multiple fault reports.
- One user can report multiple faults.
- A technician can be assigned multiple faults.
- One fault can have multiple audit records and repair updates.

**Note:** This is a conceptual ER representation. The exact columns, constraints, and relationships should be verified against the final SQL schema and MongoDB validation rules.