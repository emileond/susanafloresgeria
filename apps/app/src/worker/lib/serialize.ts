/** Convierte fechas a texto ISO de forma explícita (las respuestas usan tipos de src/shared/types.ts). */
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoReq = (d: Date): string => d.toISOString();
