import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import type { ApiErrorBody } from '../../shared/types';

/** zValidator con respuesta de error uniforme (código, mensaje y errores por campo). */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      const body: ApiErrorBody = { error: { code: 'invalid_input', message: 'Revise los datos marcados.', fields } };
      return c.json(body, 422);
    }
  });
