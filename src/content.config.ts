import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const categories = [
  'Geriatría',
  'Memoria',
  'Caídas y movilidad',
  'Medicamentos',
  'Cuidadores',
  'Salud general',
  'Cuidados paliativos',
] as const;

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    slug: z.string().optional(),
    title: z.string(),
    /** Meta descripción para Google (140–160 caracteres). Si falta, se usa `excerpt`. */
    description: z.string().optional(),
    /** Resumen corto para las tarjetas del blog. */
    excerpt: z.string().optional(),
    date: z.coerce.date(),
    /** Fecha de la última revisión del contenido (opcional). */
    updated: z.coerce.date().optional(),
    category: z.enum(categories).default('Geriatría'),
    /** Puntos clave que se muestran en el recuadro "En resumen". */
    summary: z.array(z.string()).optional(),
    /** Preguntas frecuentes al final del artículo (también se envían a Google). */
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    /** Texto personalizado del bloque para agendar cita. */
    cta: z.object({ title: z.string(), text: z.string() }).optional(),
  }),
});

export const collections = { blog };
