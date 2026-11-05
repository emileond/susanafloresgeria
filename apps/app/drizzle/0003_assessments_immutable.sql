-- Un resultado de escala guardado es parte del expediente: no se modifica ni se borra.
CREATE TRIGGER `assessments_no_update`
BEFORE UPDATE ON `assessments`
BEGIN
  SELECT RAISE(ABORT, 'assessments are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `assessments_no_delete`
BEFORE DELETE ON `assessments`
BEGIN
  SELECT RAISE(ABORT, 'assessments are immutable');
END;
