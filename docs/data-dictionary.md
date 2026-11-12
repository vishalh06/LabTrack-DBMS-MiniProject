# SQL data dictionary

Generated from the implemented MySQL database. Contains schema metadata only.

## users

| Attribute | Type | Nullable | Default | Extra |
| --- | --- | --- | --- | --- |
| user_id | int | NO | - | auto_increment |
| user_name | varchar(100) | NO | - |  |
| email | varchar(100) | NO | - |  |
| password_hash | varchar(255) | NO | - |  |
| user_role | enum('Student','Staff','Technician') | NO | - |  |

### Keys constraints and indexes

```sql
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `user_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `user_role` enum('Student','Staff','Technician') NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  CONSTRAINT `chk_user_name_nonempty` CHECK ((char_length(trim(`user_name`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## laboratories

| Attribute | Type | Nullable | Default | Extra |
| --- | --- | --- | --- | --- |
| lab_id | int | NO | - | auto_increment |
| lab_name | varchar(100) | NO | - |  |
| location | varchar(100) | NO | - |  |

### Keys constraints and indexes

```sql
CREATE TABLE `laboratories` (
  `lab_id` int NOT NULL AUTO_INCREMENT,
  `lab_name` varchar(100) NOT NULL,
  `location` varchar(100) NOT NULL,
  PRIMARY KEY (`lab_id`),
  CONSTRAINT `chk_lab_location_nonempty` CHECK ((char_length(trim(`location`)) > 0)),
  CONSTRAINT `chk_lab_name_nonempty` CHECK ((char_length(trim(`lab_name`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## equipment

| Attribute | Type | Nullable | Default | Extra |
| --- | --- | --- | --- | --- |
| equipment_id | int | NO | - | auto_increment |
| equipment_name | varchar(100) | NO | - |  |
| equipment_status | enum('Available','Issued','Under Repair') | NO | Available |  |
| lab_id | int | NO | - |  |

### Keys constraints and indexes

```sql
CREATE TABLE `equipment` (
  `equipment_id` int NOT NULL AUTO_INCREMENT,
  `equipment_name` varchar(100) NOT NULL,
  `equipment_status` enum('Available','Issued','Under Repair') NOT NULL DEFAULT 'Available',
  `lab_id` int NOT NULL,
  PRIMARY KEY (`equipment_id`),
  KEY `fk_equipment_lab` (`lab_id`),
  CONSTRAINT `fk_equipment_lab` FOREIGN KEY (`lab_id`) REFERENCES `laboratories` (`lab_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_equipment_name_nonempty` CHECK ((char_length(trim(`equipment_name`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## bookings

| Attribute | Type | Nullable | Default | Extra |
| --- | --- | --- | --- | --- |
| booking_id | int | NO | - | auto_increment |
| user_id | int | NO | - |  |
| equipment_id | int | NO | - |  |
| booking_date | date | NO | - |  |
| due_date | date | NO | - |  |
| return_date | date | YES | - |  |
| booking_status | enum('Pending','Approved','Issued','Returned','Rejected') | NO | Pending |  |

### Keys constraints and indexes

```sql
CREATE TABLE `bookings` (
  `booking_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `equipment_id` int NOT NULL,
  `booking_date` date NOT NULL,
  `due_date` date NOT NULL,
  `return_date` date DEFAULT NULL,
  `booking_status` enum('Pending','Approved','Issued','Returned','Rejected') NOT NULL DEFAULT 'Pending',
  PRIMARY KEY (`booking_id`),
  KEY `idx_booking_equipment_dates` (`equipment_id`,`booking_status`,`booking_date`,`due_date`),
  KEY `idx_booking_user` (`user_id`,`booking_status`),
  CONSTRAINT `fk_booking_equipment` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`equipment_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_booking_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_booking_dates` CHECK ((`due_date` >= `booking_date`)),
  CONSTRAINT `chk_booking_return_status` CHECK ((((`booking_status` = _cp850'Returned') and (`return_date` is not null)) or ((`booking_status` <> _cp850'Returned') and (`return_date` is null)))),
  CONSTRAINT `chk_return_date` CHECK (((`return_date` is null) or (`return_date` >= `booking_date`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## fault_reports

| Attribute | Type | Nullable | Default | Extra |
| --- | --- | --- | --- | --- |
| fault_id | int | NO | - | auto_increment |
| equipment_id | int | NO | - |  |
| reported_by | int | NO | - |  |
| technician_id | int | YES | - |  |
| fault_description | varchar(500) | NO | - |  |
| reported_date | date | NO | - |  |
| fault_status | enum('Reported','Under Repair','Resolved') | NO | Reported |  |

### Keys constraints and indexes

```sql
CREATE TABLE `fault_reports` (
  `fault_id` int NOT NULL AUTO_INCREMENT,
  `equipment_id` int NOT NULL,
  `reported_by` int NOT NULL,
  `technician_id` int DEFAULT NULL,
  `fault_description` varchar(500) NOT NULL,
  `reported_date` date NOT NULL,
  `fault_status` enum('Reported','Under Repair','Resolved') NOT NULL DEFAULT 'Reported',
  PRIMARY KEY (`fault_id`),
  KEY `fk_fault_reporter` (`reported_by`),
  KEY `fk_fault_technician` (`technician_id`),
  KEY `idx_fault_equipment_status` (`equipment_id`,`fault_status`),
  CONSTRAINT `fk_fault_equipment` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`equipment_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fault_reporter` FOREIGN KEY (`reported_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fault_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_fault_description_nonempty` CHECK ((char_length(trim(`fault_description`)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```
