-- Datos de prueba para desarrollo local. TODOS LOS PACIENTES SON FICTICIOS.
-- Uso: npm run db:seed:local  (después de npm run db:migrate:local)

INSERT OR IGNORE INTO users (id, email, name, role) VALUES
  ('01900000-0000-7000-8000-000000000001', 'doctora@example.com', 'Dra. Prueba (local)', 'doctor');

INSERT OR IGNORE INTO patients (id, full_name, search_name, birth_date, sex, phone, allergies, blood_type, last_visit_at, created_by, updated_by) VALUES
  ('01900000-0000-7000-8000-0000000000a1', 'Rosa María Ejemplo Pérez', 'rosa maria ejemplo perez', '1941-03-12', 'F', '477 000 0001', 'Penicilina', 'O+', '2026-10-28', '01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000001'),
  ('01900000-0000-7000-8000-0000000000a2', 'José Luis Prueba García', 'jose luis prueba garcia', '1938-11-02', 'M', '477 000 0002', NULL, 'A+', '2026-10-15', '01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000001'),
  ('01900000-0000-7000-8000-0000000000a3', 'Carmen Ficticia López', 'carmen ficticia lopez', '1950-07-21', 'F', NULL, 'Sulfas, AINE', NULL, NULL, '01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000001');

INSERT OR IGNORE INTO patient_contacts (id, patient_id, name, relationship, phone, is_primary, created_by) VALUES
  ('01900000-0000-7000-8000-0000000000c1', '01900000-0000-7000-8000-0000000000a1', 'Laura Ejemplo', 'Hija', '477 000 0101', 1, '01900000-0000-7000-8000-000000000001'),
  ('01900000-0000-7000-8000-0000000000c2', '01900000-0000-7000-8000-0000000000a2', 'Miguel Prueba', 'Hijo', '477 000 0102', 1, '01900000-0000-7000-8000-000000000001');

INSERT OR IGNORE INTO medications (id, patient_id, name, dose, frequency, indication, active, created_by) VALUES
  ('01900000-0000-7000-8000-0000000000d1', '01900000-0000-7000-8000-0000000000a1', 'Metformina', '850 mg', 'Cada 12 h', 'Diabetes tipo 2', 1, '01900000-0000-7000-8000-000000000001'),
  ('01900000-0000-7000-8000-0000000000d2', '01900000-0000-7000-8000-0000000000a1', 'Losartán', '50 mg', 'Cada 24 h', 'Hipertensión', 1, '01900000-0000-7000-8000-000000000001'),
  ('01900000-0000-7000-8000-0000000000d3', '01900000-0000-7000-8000-0000000000a1', 'Clonazepam', '0.5 mg', 'Por la noche', 'Insomnio', 1, '01900000-0000-7000-8000-000000000001');

INSERT OR IGNORE INTO notes (id, patient_id, type, modality, visit_date, subjective, objective, assessment, plan, vitals, status, created_by, updated_by) VALUES
  ('01900000-0000-7000-8000-0000000000e1', '01900000-0000-7000-8000-0000000000a1', 'primera_vez', 'consultorio', '2026-10-28',
   'Acude acompañada de su hija. Refiere olvidos frecuentes desde hace 1 año, dos caídas en los últimos 3 meses al levantarse por la noche. Diabetes tipo 2 desde hace 15 años e hipertensión desde hace 10. Vive con su hija; viuda; escolaridad primaria. No fuma.',
   'Alerta, orientada en persona, parcialmente en tiempo. Marcha con base amplia, lenta. Sin focalización neurológica.',
   'Probable deterioro cognitivo leve. Caídas de repetición, posible hipotensión ortostática y efecto de benzodiacepina. Polifarmacia.',
   'Valoración cognitiva completa, laboratorio (BH, QS, TSH, B12). Plan de desprescripción gradual de clonazepam. Recomendaciones de seguridad en casa.',
   '{"taSys":138,"taDia":78,"fc":72,"weight":61.5,"height":154}', 'draft',
   '01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000001');
