-- LabTrack fault-management migration (idempotent; safe on populated databases).
-- Applied by: npm run db:faults
-- Sections are separated by lines beginning with "-- @@" and run one by one.
-- The two new fault_reports columns (assigned_date, resolved_date) are added
-- by scripts/install-faults.mjs only if they are missing.

-- @@ audit table
CREATE TABLE IF NOT EXISTS `fault_audit` (
  `audit_id` int NOT NULL AUTO_INCREMENT,
  `fault_id` int NOT NULL,
  `old_status` enum('Reported','Under Repair','Resolved') DEFAULT NULL,
  `new_status` enum('Reported','Under Repair','Resolved') NOT NULL,
  `old_technician_id` int DEFAULT NULL,
  `new_technician_id` int DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `idx_audit_fault` (`fault_id`, `changed_at`),
  CONSTRAINT `fk_audit_fault` FOREIGN KEY (`fault_id`)
    REFERENCES `fault_reports` (`fault_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- @@ view: full fault details
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vw_fault_details` AS
SELECT f.fault_id, f.equipment_id, e.equipment_name, e.equipment_status,
       l.lab_id, l.lab_name,
       f.reported_by, r.user_name AS reporter_name,
       f.technician_id, t.user_name AS technician_name,
       f.fault_description, f.reported_date, f.assigned_date, f.resolved_date,
       f.fault_status,
       DATEDIFF(COALESCE(f.resolved_date, CURDATE()), f.reported_date) AS age_days
FROM fault_reports f
JOIN equipment e ON e.equipment_id = f.equipment_id
JOIN laboratories l ON l.lab_id = e.lab_id
JOIN users r ON r.user_id = f.reported_by
LEFT JOIN users t ON t.user_id = f.technician_id;

-- @@ view: technician workload
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vw_technician_workload` AS
SELECT u.user_id AS technician_id, u.user_name AS technician_name,
       COALESCE(SUM(f.fault_status = 'Under Repair'), 0) AS open_faults,
       COALESCE(SUM(f.fault_status = 'Resolved'), 0) AS resolved_faults,
       ROUND(AVG(CASE WHEN f.fault_status = 'Resolved'
                      THEN DATEDIFF(f.resolved_date, f.reported_date) END), 1)
         AS avg_days_to_resolve
FROM users u
LEFT JOIN fault_reports f ON f.technician_id = u.user_id
WHERE u.user_role = 'Technician'
GROUP BY u.user_id, u.user_name;

-- @@ view: faults per laboratory
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vw_lab_fault_summary` AS
SELECT l.lab_id, l.lab_name,
       COUNT(f.fault_id) AS total_faults,
       COALESCE(SUM(f.fault_status <> 'Resolved'), 0) AS unresolved_faults,
       COALESCE(SUM(f.fault_status = 'Resolved'), 0) AS resolved_faults
FROM laboratories l
LEFT JOIN equipment e ON e.lab_id = l.lab_id
LEFT JOIN fault_reports f ON f.equipment_id = e.equipment_id
GROUP BY l.lab_id, l.lab_name;

-- @@ trigger: validate new faults
DROP TRIGGER IF EXISTS `trg_fault_before_insert`;

-- @@ trigger: validate new faults (create)
CREATE TRIGGER `trg_fault_before_insert`
BEFORE INSERT ON `fault_reports`
FOR EACH ROW
BEGIN
  IF NEW.fault_status <> 'Reported' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A new fault must start with status Reported.';
  END IF;
  IF NEW.technician_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Assign a technician after the fault is reported.';
  END IF;
END;

-- @@ trigger: enforce fault workflow
DROP TRIGGER IF EXISTS `trg_fault_before_update`;

-- @@ trigger: enforce fault workflow (create)
CREATE TRIGGER `trg_fault_before_update`
BEFORE UPDATE ON `fault_reports`
FOR EACH ROW
BEGIN
  DECLARE v_role VARCHAR(20);

  IF OLD.fault_status = 'Resolved'
     AND (NEW.fault_status <> 'Resolved'
          OR NOT (NEW.technician_id <=> OLD.technician_id)) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A resolved fault cannot be changed.';
  END IF;

  IF NEW.technician_id IS NOT NULL
     AND NOT (NEW.technician_id <=> OLD.technician_id) THEN
    SELECT user_role INTO v_role FROM users WHERE user_id = NEW.technician_id;
    IF v_role IS NULL OR v_role <> 'Technician' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only a user with the Technician role can be assigned.';
    END IF;
  END IF;

  IF OLD.fault_status = 'Reported' AND NEW.fault_status = 'Resolved' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A fault must be assigned and under repair before it is resolved.';
  END IF;

  IF OLD.fault_status = 'Under Repair' AND NEW.fault_status = 'Reported' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A fault under repair cannot return to Reported.';
  END IF;

  IF NEW.fault_status IN ('Under Repair', 'Resolved')
     AND NEW.technician_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A technician must be assigned to this fault.';
  END IF;

  IF NEW.fault_status = 'Reported' AND NEW.technician_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A technician can only be assigned when the fault moves to Under Repair.';
  END IF;

  IF NEW.fault_status = 'Under Repair' AND OLD.fault_status = 'Reported' THEN
    SET NEW.assigned_date = CURDATE();
  END IF;

  IF NEW.fault_status = 'Resolved' AND OLD.fault_status <> 'Resolved' THEN
    SET NEW.resolved_date = CURDATE();
  END IF;
END;

-- @@ trigger: audit new faults
DROP TRIGGER IF EXISTS `trg_fault_after_insert`;

-- @@ trigger: audit new faults (create)
CREATE TRIGGER `trg_fault_after_insert`
AFTER INSERT ON `fault_reports`
FOR EACH ROW
BEGIN
  INSERT INTO fault_audit (fault_id, old_status, new_status,
                           old_technician_id, new_technician_id)
  VALUES (NEW.fault_id, NULL, NEW.fault_status, NULL, NEW.technician_id);
END;

-- @@ trigger: audit fault changes
DROP TRIGGER IF EXISTS `trg_fault_after_update`;

-- @@ trigger: audit fault changes (create)
CREATE TRIGGER `trg_fault_after_update`
AFTER UPDATE ON `fault_reports`
FOR EACH ROW
BEGIN
  IF NEW.fault_status <> OLD.fault_status
     OR NOT (NEW.technician_id <=> OLD.technician_id) THEN
    INSERT INTO fault_audit (fault_id, old_status, new_status,
                             old_technician_id, new_technician_id)
    VALUES (NEW.fault_id, OLD.fault_status, NEW.fault_status,
            OLD.technician_id, NEW.technician_id);
  END IF;
END;
