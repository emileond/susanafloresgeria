import { and, asc, count, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { ApiErrorBody, Dashboard, Me } from '../shared/types';
import * as schema from './db/schema';
import { appointments, notes, patients } from './db/schema';
import { syncDoctoralia } from './calendar/sync';
import { zonedTimeToUtc } from '../shared/time';
import { backupDatabase } from './jobs/backup';
import { appointmentRoutes, selectAppointments, toAppointmentItem } from './routes/appointments';
import { TIME_ZONE } from '../shared/constants';
import { todayISO } from '../shared/format';
import { authMiddleware, canEditClinical } from './lib/auth';
import { dbMiddleware } from './lib/db';
import { fileRoutes, patientFileRoutes } from './routes/files';
import { historyRoutes } from './routes/history';
import { medicationRoutes, patientMedicationRoutes } from './routes/medications';
import { noteRoutes, patientNoteRoutes } from './routes/notes';
import { patientRoutes, toListItem } from './routes/patients';
import { patientPrescriptionRoutes, prescriptionRoutes } from './routes/prescriptions';
import { assessmentRoutes, patientAssessmentRoutes } from './routes/assessments';
import { enabledScales } from '../shared/scales';
import type { AppEnv } from './types';

const api = new Hono<AppEnv>()
  .use(secureHeaders({ referrerPolicy: 'no-referrer' }))
  .use(async (c, next) => {
    await next();
    // Ninguna respuesta con datos de pacientes debe quedar en caché.
    c.header('cache-control', 'private, no-store');
  })
  .use(dbMiddleware)
  .use(authMiddleware)

  .get('/me', (c) => {
    const u = c.get('user');
    const me: Me = {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      canEditClinical: canEditClinical(u.role),
      features: {
        ai: Boolean(c.env.ANTHROPIC_API_KEY?.trim()),
        scales: enabledScales(c.env.LICENSED_SCALES).map((s) => s.key),
      },
    };
    return c.json(me);
  })

  .get('/dashboard', async (c) => {
    const db = c.get('db');
    const clinical = canEditClinical(c.get('user').role);
    const [y, m, d] = todayISO().split('-').map(Number) as [number, number, number];
    const dayStart = zonedTimeToUtc(y, m, d, 0, 0, 0, TIME_ZONE);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
    const [patientTotal, recent, drafts, today] = await Promise.all([
      db.select({ n: count() }).from(patients).where(isNull(patients.archivedAt)),
      db.select().from(patients).where(isNull(patients.archivedAt)).orderBy(desc(patients.updatedAt)).limit(8),
      clinical
        ? db
            .select({ id: notes.id, patientId: notes.patientId, patientName: patients.fullName, visitDate: notes.visitDate, type: notes.type })
            .from(notes)
            .innerJoin(patients, eq(notes.patientId, patients.id))
            .where(and(eq(notes.status, 'draft'), isNull(patients.archivedAt)))
            .orderBy(desc(notes.updatedAt))
            .limit(10)
        : Promise.resolve([]),
      selectAppointments(db)
        .where(and(gte(appointments.startsAt, dayStart), lt(appointments.startsAt, dayEnd)))
        .orderBy(asc(appointments.startsAt)),
    ]);
    const body: Dashboard = {
      totals: { patients: patientTotal[0]?.n ?? 0, draftNotes: drafts.length },
      todayAppointments: today.map((r) => toAppointmentItem(r.a, r.patientName)),
      recentPatients: recent.map(toListItem),
      draftNotes: drafts,
    };
    return c.json(body);
  })

  .route('/patients', patientRoutes)
  // Información clínica: cada uno de estos routers exige un rol clínico (requireClinical).
  .route('/patients/:patientId/notes', patientNoteRoutes)
  .route('/patients/:patientId/history', historyRoutes)
  .route('/patients/:patientId/files', patientFileRoutes)
  .route('/patients/:patientId/medications', patientMedicationRoutes)
  .route('/patients/:patientId/assessments', patientAssessmentRoutes)
  .route('/patients/:patientId/prescriptions', patientPrescriptionRoutes)
  .route('/assessments', assessmentRoutes)
  .route('/appointments', appointmentRoutes)
  .route('/notes', noteRoutes)
  .route('/files', fileRoutes)
  .route('/medications', medicationRoutes)
  .route('/prescriptions', prescriptionRoutes);

const app = new Hono<AppEnv>()
  .route('/api', api)
  .notFound((c) => c.json({ error: { code: 'not_found', message: 'Ruta no encontrada' } } satisfies ApiErrorBody, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  // No registrar el mensaje completo: los errores de base de datos pueden incluir datos de pacientes.
  console.error('unhandled_error', err.name);
  return c.json({ error: { code: 'server_error', message: 'Ocurrió un error inesperado. Intente de nuevo.' } } satisfies ApiErrorBody, 500);
});

export default {
  fetch: app.fetch,
  /** Tareas programadas (ver "triggers" en wrangler.jsonc). */
  async scheduled(controller, env, ctx) {
    if (controller.cron === '0 9 * * *') {
      ctx.waitUntil(
        backupDatabase(env).then(
          (r) => console.log('backup_ok', Object.keys(r.tables).length),
          (err) => console.error('backup_failed', err instanceof Error ? err.name : 'unknown'),
        ),
      );
    } else {
      ctx.waitUntil(
        syncDoctoralia(env, drizzle(env.DB, { schema })).then(
          (r) => console.log('doctoralia_sync', r.status, r.added, r.updated, r.cancelled),
          (err) => console.error('doctoralia_sync_failed', err instanceof Error ? err.name : 'unknown'),
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
