-- Recetas (defensa en profundidad, además de la API):
-- 1) Una receta emitida no se modifica. Lo único permitido es cancelarla (estado, fecha, autor y motivo
--    de la cancelación); todo el contenido impreso debe quedar igual.
CREATE TRIGGER `prescriptions_issued_no_update`
BEFORE UPDATE ON `prescriptions`
WHEN OLD.`status` = 'issued' AND NOT (
  NEW.`status` = 'cancelled'
  AND NEW.`cancelled_at` IS NOT NULL
  AND NEW.`cancel_reason` IS NOT NULL
  AND NEW.`id` IS OLD.`id`
  AND NEW.`patient_id` IS OLD.`patient_id`
  AND NEW.`note_id` IS OLD.`note_id`
  AND NEW.`folio` IS OLD.`folio`
  AND NEW.`date` IS OLD.`date`
  AND NEW.`items` IS OLD.`items`
  AND NEW.`diagnosis` IS OLD.`diagnosis`
  AND NEW.`general_instructions` IS OLD.`general_instructions`
  AND NEW.`weight_kg` IS OLD.`weight_kg`
  AND NEW.`snapshot` IS OLD.`snapshot`
  AND NEW.`issued_at` IS OLD.`issued_at`
  AND NEW.`issued_by` IS OLD.`issued_by`
  AND NEW.`source_id` IS OLD.`source_id`
  AND NEW.`created_at` IS OLD.`created_at`
  AND NEW.`created_by` IS OLD.`created_by`
)
BEGIN
  SELECT RAISE(ABORT, 'issued prescriptions are immutable');
END;
--> statement-breakpoint
-- 2) Una receta cancelada ya no cambia.
CREATE TRIGGER `prescriptions_cancelled_no_update`
BEFORE UPDATE ON `prescriptions`
WHEN OLD.`status` = 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'cancelled prescriptions are immutable');
END;
--> statement-breakpoint
-- 3) Solo los borradores se pueden descartar; lo emitido es parte permanente del expediente.
CREATE TRIGGER `prescriptions_issued_no_delete`
BEFORE DELETE ON `prescriptions`
WHEN OLD.`status` <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'issued prescriptions cannot be deleted');
END;
--> statement-breakpoint
-- 4) Un borrador no puede saltar directo a «cancelada».
CREATE TRIGGER `prescriptions_draft_no_cancel`
BEFORE UPDATE ON `prescriptions`
WHEN OLD.`status` = 'draft' AND NEW.`status` = 'cancelled'
BEGIN
  SELECT RAISE(ABORT, 'only issued prescriptions can be cancelled');
END;
