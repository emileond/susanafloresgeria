# Expedientes — app clínica privada

App para que la Dra. Flores (y en el futuro su equipo) lleve el expediente de sus pacientes: alta rápida, ficha de identificación, cuidadores, notas clínicas (SOAP) con firma, historia clínica versionada (con asistencia opcional de IA), escalas geriátricas, archivos (estudios, fotos, recetas) y lista de medicamentos.

**Stack (solo Cloudflare):** Vite + React 19 + TanStack Router/Query (interfaz) · Hono en Workers (API) · D1 + Drizzle (datos) · R2 (archivos) · Cloudflare Access (inicio de sesión con Google).

```
src/client/   interfaz React (rutas en src/client/routes)
src/worker/   API Hono (/api/*), esquema D1, autenticación y auditoría
src/shared/   esquemas zod, catálogos y tipos usados por ambos lados
drizzle/      migraciones SQL (se aplican con wrangler)
seed/         datos ficticios para desarrollo local
test/         pruebas de la API dentro del runtime de Workers
```

## Desarrollo local

```bash
npm install                      # desde la raíz del repositorio
cp apps/app/.dev.vars.example apps/app/.dev.vars
npm run db:migrate:local -w @susanafloresgeria/app
npm run db:seed:local -w @susanafloresgeria/app   # pacientes ficticios
npm run dev:app                  # http://localhost:5173
```

En local no hay Cloudflare Access: se entra como `DEV_USER_EMAIL` (de `.dev.vars`). Esa excepción solo funciona con `ENVIRONMENT=development` **y** en `localhost`.

Pruebas y tipos: `npm test -w @susanafloresgeria/app` · `npm run check -w @susanafloresgeria/app`.

## Primer despliegue (una sola vez)

1. **Base de datos y archivos**
   ```bash
   cd apps/app
   npx wrangler d1 create susanafloresgeria-app        # copie el database_id a wrangler.jsonc
   npx wrangler r2 bucket create susanafloresgeria-files
   npx wrangler r2 bucket create susanafloresgeria-backups
   npx wrangler d1 migrations apply DB --remote
   ```
2. **Worker y dominio:** en Cloudflare, *Workers & Pages → Create → Import a repository*, con:
   - **Nombre:** `susanafloresgeria-app`
   - **Build command:** `npm run build:app`
   - **Deploy command:** `npx wrangler deploy -c apps/app/wrangler.jsonc`
   - **Build watch paths:** `apps/app/*` y `packages/theme/*`

   Después agregue el dominio personalizado `app.susanafloresgeria.com`.
3. **Cloudflare Access (Zero Trust):** cree una aplicación *Self-hosted* para `app.susanafloresgeria.com`, con Google como proveedor de identidad y una política que permita solo el correo de la doctora. Duración de sesión recomendada: 8–12 h.
4. **Variables** en `wrangler.jsonc` (o en el panel del Worker):
   - `ACCESS_TEAM_DOMAIN`: p. ej. `susanaflores.cloudflareaccess.com`
   - `ACCESS_AUD`: el *Application Audience (AUD) Tag* de la aplicación de Access
   - `BOOTSTRAP_ADMIN_EMAIL`: el correo de la doctora (se da de alta sola en su primer acceso)

## Escalas geriátricas

Definidas en `src/shared/scales/` (ítems en español, puntuación, interpretación y referencia bibliográfica). La interfaz muestra la puntuación en vivo, pero **el servidor la recalcula** al guardar. Un resultado guardado no se modifica y puede agregarse al apartado «Objetivo» de una nota en borrador.

Incluidas: Katz, Barthel, Lawton-Brody, GDS-15, FRAIL, SARC-F y Tinetti. **MNA-SF y Zarit** tienen derechos de autor y están deshabilitadas: una vez confirmadas sus condiciones de uso, agregue sus claves a `LICENSED_SCALES` (p. ej. `"mna-sf,zarit"`). La doctora debe revisar la redacción de los ítems contra las versiones validadas en español que utilice.

## Recetas

En *Recetas* (expediente del paciente) la doctora escribe la receta en borrador (con autoguardado), opcionalmente a partir de los medicamentos activos del paciente, y la **emite**. Al emitirse:

- recibe un **folio** consecutivo y se guarda una copia de los datos impresos (paciente, edad, alergias y datos de la doctora), así una reimpresión es idéntica aunque después cambie el expediente;
- queda **inmutable** (API y *trigger* en la base de datos). Para corregirla se **cancela con motivo** y se emite una nueva a partir de ella; la cancelada sigue en el expediente y se imprime con la marca «CANCELADA»;
- puede agregar a la lista de medicamentos los que aún no estén activos.

Solo el rol `doctor` emite o cancela (el nombre y las cédulas impresos son los suyos); `admin` puede preparar borradores; `assistant` no ve recetas.

**Impresión / PDF:** la ruta `/recetas/<id>/imprimir` tiene una hoja de impresión (media carta o carta) y el botón «Imprimir / Guardar como PDF» usa el diálogo del navegador. Cada impresión queda en la bitácora. Contenido según el Reglamento de Insumos para la Salud (art. 29–31): nombre, especialidad, institución y cédulas profesional y de especialidad, domicilio del consultorio, fecha, nombre, edad y peso del paciente, denominación genérica (y marca opcional), presentación, dosis, vía, frecuencia y duración, y línea de firma. Los datos de la doctora están en `src/shared/prescriber.ts`. Los estupefacientes y psicotrópicos tienen requisitos adicionales (p. ej. recetario especial con código de barras de COFEPRIS) que esta receta no cubre.

## Asistente de IA para la historia clínica (opcional)

En *Historia clínica → Completar con IA*, la doctora elige notas y el modelo (`AI_MODEL`, por defecto `claude-haiku-5-5`) propone el texto de cada sección. Ella acepta, edita o descarta sección por sección; solo lo aceptado se guarda como versión nueva marcada «con asistencia de IA».

- Antes de enviar se eliminan nombre del paciente y contactos, CURP, teléfonos y correos.
- Límite de 10 solicitudes por minuto por usuario (Workers Rate Limiting).
- Activación: `npx wrangler secret put ANTHROPIC_API_KEY` y, recomendado, una **AI Gateway** de Cloudflare (`AI_GATEWAY_URL = https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY>/anthropic`) con registro de cuerpos desactivado y límite de gasto.
- Actualice el aviso de privacidad para mencionar el uso de un encargado de tratamiento (proveedor de IA).

## Buenas prácticas incluidas

- **Doble verificación de sesión:** Access protege el dominio y la API además verifica la firma del JWT en cada petición. Los roles se aplican en el servidor: `doctor`/`admin` ven lo clínico; `assistant` solo datos de identificación.
- **Notas firmadas inmutables:** se bloquean en la API y con un *trigger* en la base de datos; las correcciones se hacen con **adenda**. Los borradores se pueden descartar.
- **Historia clínica versionada:** cada guardado crea una versión nueva; las anteriores no se modifican.
- **Nada se borra del expediente:** pacientes y archivos se **archivan** (NOM-004: conservar al menos 5 años).
- **Bitácora de auditoría** (NOM-024): quién consultó o cambió qué y cuándo; solo admite inserciones y nunca guarda contenido clínico.
- **Archivos privados en R2:** sin URL pública, entregados solo por la API con `no-store`; lista blanca de tipos y máximo 50 MB; se guarda el hash SHA-256.
- **Sin datos de pacientes en URLs ni en registros:** la búsqueda va en el cuerpo de la petición y los errores se registran sin contenido.
- **Bloqueo por inactividad:** a los 15 min la pantalla se oculta.
