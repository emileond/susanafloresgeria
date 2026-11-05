import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { HISTORY_SECTIONS, type HistoryData, type HistorySectionKey } from '../../shared/history';

/**
 * Asistente para completar la historia clínica a partir de las notas.
 * - Solo se envía texto clínico: se eliminan nombre, CURP, teléfonos y correos antes de llamar al modelo.
 * - El resultado es una PROPUESTA: la doctora la revisa y acepta sección por sección; nunca se guarda sola.
 */

export interface NoteForAi {
  visitDate: string;
  type: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
}

export interface Identifiers {
  names: string[];
  curp?: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reemplaza datos identificables por marcadores. */
export function deidentify(text: string, ids: Identifiers): string {
  let out = text;
  if (ids.curp) out = out.replace(new RegExp(escapeRegex(ids.curp), 'gi'), '[CURP]');
  out = out.replace(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi, '[CURP]');
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]');
  out = out.replace(/(?:\+?\d[\s-]?){7,}\d/g, '[teléfono]');
  // Nombres y apellidos del paciente y sus contactos (palabras de 3+ letras), sin importar acentos ni mayúsculas.
  const tokens = new Set(
    ids.names
      .flatMap((n) => n.split(/\s+/))
      .map((t) => t.trim())
      .filter((t) => t.length >= 3),
  );
  const ACCENTS: Record<string, string> = { a: 'aá', e: 'eé', i: 'iíï', o: 'oó', u: 'uúü', n: 'nñ' };
  for (const token of tokens) {
    const base = token.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const pattern = [...base].map((ch) => (ACCENTS[ch.toLowerCase()] ? `[${ACCENTS[ch.toLowerCase()]}]` : escapeRegex(ch))).join('');
    // Límites de palabra con letras Unicode (\b no reconoce letras acentuadas).
    out = out.replace(new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, 'giu'), '[nombre]');
  }
  return out;
}

const SectionsSchema = z.object(
  Object.fromEntries(HISTORY_SECTIONS.map((s) => [s.key, z.string()])) as Record<HistorySectionKey, z.ZodString>,
);
const ProposalSchema = z.object({ sections: SectionsSchema });

const SYSTEM_PROMPT = `Eres un asistente de documentación clínica para una médica geriatra en México.
A partir de las notas clínicas que se te proporcionan, redacta las secciones de la historia clínica (contenido de la NOM-004-SSA3-2012).

Reglas:
- Usa únicamente información que aparezca explícitamente en las notas o en la historia actual. No inventes ni infieras datos, diagnósticos, dosis ni fechas.
- Si una sección ya tiene contenido en la historia actual, intégralo con la información nueva sin perder nada de lo existente y sin duplicar.
- Si no hay información para una sección, devuelve una cadena vacía "".
- Redacta en español, en tercera persona, con estilo clínico conciso. Usa viñetas o frases cortas cuando ayude a la lectura.
- Los marcadores como [nombre], [teléfono] o [CURP] sustituyen datos personales: no intentes reconstruirlos ni los repitas.
- Los síndromes geriátricos (caídas, memoria, ánimo, continencia, sueño, nutrición, polifarmacia) van en "aparatosSistemas" cuando se mencionan como síntomas.`;

export function buildUserMessage(notes: NoteForAi[], current: HistoryData, ids: Identifiers, patientContext: string): string {
  const sectionGuide = HISTORY_SECTIONS.map((s) => `- ${s.key} (${s.label}): ${s.hint}`).join('\n');
  const currentText = HISTORY_SECTIONS.map((s) => `### ${s.key}\n${deidentify(current[s.key] ?? '', ids) || '(vacío)'}`).join('\n\n');
  const notesText = notes
    .map((n, i) => {
      const parts = [
        n.subjective && `Subjetivo: ${n.subjective}`,
        n.objective && `Objetivo: ${n.objective}`,
        n.assessment && `Análisis: ${n.assessment}`,
        n.plan && `Plan: ${n.plan}`,
        n.body && `Notas adicionales: ${n.body}`,
      ].filter(Boolean);
      return `## Nota ${i + 1} — ${n.visitDate} (${n.type})\n${deidentify(parts.join('\n'), ids)}`;
    })
    .join('\n\n');
  return `Contexto: ${patientContext}

Secciones a completar:
${sectionGuide}

<historia_actual>
${currentText}
</historia_actual>

<notas>
${notesText}
</notas>`;
}

export class AiError extends Error {
  constructor(
    public code: 'refused' | 'truncated' | 'invalid_output' | 'rate_limited' | 'upstream',
    message: string,
  ) {
    super(message);
  }
}

/** Interfaz mínima del cliente (permite usar un doble en las pruebas). */
export type ParseClient = Pick<Anthropic, 'messages'>;

export function createAnthropic(env: Env): Anthropic | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({
    apiKey,
    // A través de Cloudflare AI Gateway cuando está configurado (registros, límites y control de gasto).
    baseURL: env.AI_GATEWAY_URL?.trim() || undefined,
    maxRetries: 1,
    timeout: 60_000,
  });
}

/** Pide al modelo la propuesta y devuelve solo las secciones que cambian respecto a la historia actual. */
export async function draftHistory(
  client: ParseClient,
  model: string,
  notes: NoteForAi[],
  current: HistoryData,
  ids: Identifiers,
  patientContext: string,
): Promise<Partial<Record<HistorySectionKey, string>>> {
  let response;
  try {
    response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(notes, current, ids, patientContext) }],
      output_config: { format: zodOutputFormat(ProposalSchema), effort: 'medium' },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new AiError('rate_limited', 'El asistente está ocupado. Intente en un minuto.');
    if (err instanceof Anthropic.APIError) throw new AiError('upstream', 'El asistente no está disponible en este momento.');
    throw err;
  }

  if (response.stop_reason === 'refusal') throw new AiError('refused', 'El asistente no pudo generar una propuesta para estas notas.');
  if (response.stop_reason === 'max_tokens') throw new AiError('truncated', 'Las notas son demasiado extensas. Seleccione menos notas.');
  const parsed = response.parsed_output;
  if (!parsed) throw new AiError('invalid_output', 'La respuesta del asistente no tuvo el formato esperado. Intente de nuevo.');

  const proposals: Partial<Record<HistorySectionKey, string>> = {};
  for (const s of HISTORY_SECTIONS) {
    const proposed = parsed.sections[s.key]?.trim() ?? '';
    if (proposed && proposed !== (current[s.key] ?? '').trim()) proposals[s.key] = proposed;
  }
  return proposals;
}
