-- Protecciones a nivel base de datos (defensa en profundidad, además de la API):
-- 1) Una nota firmada no se puede modificar ni borrar; las correcciones se hacen con adenda.
CREATE TRIGGER `notes_signed_no_update`
BEFORE UPDATE ON `notes`
WHEN OLD.`status` = 'signed'
BEGIN
  SELECT RAISE(ABORT, 'signed notes are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `notes_signed_no_delete`
BEFORE DELETE ON `notes`
WHEN OLD.`status` = 'signed'
BEGIN
  SELECT RAISE(ABORT, 'signed notes cannot be deleted');
END;
--> statement-breakpoint
-- 2) La bitácora de auditoría solo admite inserciones.
CREATE TRIGGER `audit_log_no_update`
BEFORE UPDATE ON `audit_log`
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_no_delete`
BEFORE DELETE ON `audit_log`
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only');
END;
--> statement-breakpoint
-- 3) Las versiones de historia clínica no se modifican: cada cambio crea una versión nueva.
CREATE TRIGGER `history_no_update`
BEFORE UPDATE ON `clinical_histories`
BEGIN
  SELECT RAISE(ABORT, 'clinical history versions are immutable');
END;
