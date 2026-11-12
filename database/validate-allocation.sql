CREATE PROCEDURE sp_validate_allocation(
    IN p_booking_id INT,
    IN p_action VARCHAR(10)
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_equipment_id INT;
    DECLARE v_start DATE;
    DECLARE v_due DATE;
    DECLARE v_booking_status VARCHAR(20);
    DECLARE v_equipment_status VARCHAR(20);
    DECLARE v_count INT DEFAULT 0;

    IF p_action IS NULL OR p_action NOT IN ('approve', 'issue') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid allocation action.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM bookings WHERE booking_id = p_booking_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking not found.';
    END IF;

    SELECT equipment_id, booking_date, due_date, booking_status
    INTO v_equipment_id, v_start, v_due, v_booking_status
    FROM bookings WHERE booking_id = p_booking_id;

    IF (p_action = 'approve' AND v_booking_status <> 'Pending')
       OR (p_action = 'issue' AND v_booking_status <> 'Approved') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid booking status for this action.';
    END IF;

    SELECT equipment_status INTO v_equipment_status
    FROM equipment WHERE equipment_id = v_equipment_id;

    IF v_equipment_status <> 'Available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Equipment is issued or under repair.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM fault_reports
    WHERE equipment_id = v_equipment_id
      AND fault_status <> 'Resolved';

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Equipment has an unresolved fault.';
    END IF;

    IF v_due < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The booking period has expired.';
    END IF;

    IF p_action = 'issue' AND v_start > CURDATE() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking has not started yet.';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM bookings
    WHERE equipment_id = v_equipment_id
      AND booking_id <> p_booking_id
      AND (
          booking_status = 'Issued'
          OR (
              booking_status = 'Approved'
              AND booking_date <= v_due
              AND due_date >= v_start
          )
      );

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Equipment has a conflicting allocation.';
    END IF;
END