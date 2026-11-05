# Sitio web — Dra. Susana Flores Alonso, Geriatra en León

Sitio estático construido con [Astro](https://astro.build) + Tailwind CSS. Genera HTML puro (sin depender de JavaScript para mostrar el contenido), lo que lo hace rápido en celulares y fácil de indexar por Google.

Forma parte del monorepo (ver el [README principal](../../README.md)). Instale las dependencias una sola vez desde la raíz con `npm install`.

## Comandos

Desde esta carpeta (`apps/web`), o desde la raíz agregando `-w @susanafloresgeria/web`:

| Comando           | Acción                                          |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo en `http://localhost:4321` |
| `npm run build`   | Genera el sitio final en `apps/web/dist/`       |
| `npm run preview` | Sirve localmente la carpeta `dist/`             |
| `npm run check`   | Revisa errores de tipos y plantillas            |

`dist/` se puede publicar en cualquier hosting estático (Cloudflare, Netlify, Vercel…).

## Dónde cambiar las cosas

- **Correo, dirección, horarios, perfil de Doctoralia y cédulas:** `src/config/site.ts`. Todo el sitio toma los datos de ahí.
- **Textos de la página principal** (servicios, pasos, testimonios, preguntas frecuentes): `src/pages/index.astro`. Cada sección está separada con un comentario.
- **Colores y tipografía:** `packages/theme/theme.css` (compartido con la app). Estilos propios del sitio: `src/styles/global.css`.
- **Logo:** `public/logo-mark.svg` (copia también en `packages/theme/logo-mark.svg` para la app; si cambia uno, actualice el otro).
- **Foto:** `src/assets/headshot.png`. Astro la optimiza automáticamente (WebP, varios tamaños).
- **Imagen para compartir en WhatsApp/Facebook:** `public/og-image.jpg` (1200×630).

## Blog en Markdown

Los artículos se escriben en archivos Markdown con frontmatter en `src/content/blog/`:

```
---
slug: mi-primer-post
title: "Título del artículo (50–65 caracteres)"
description: "Descripción para Google, 140–160 caracteres."
excerpt: "Resumen corto para la tarjeta del blog."
date: 2026-01-03
updated: 2026-02-10            # opcional: fecha de la última revisión
category: "Memoria"            # Geriatría | Memoria | Caídas y movilidad | Medicamentos | Cuidadores | Salud general | Cuidados paliativos
summary:                       # opcional: recuadro "En resumen"
  - "Punto clave 1"
  - "Punto clave 2"
faqs:                          # opcional: preguntas al final (también se envían a Google)
  - q: "¿Pregunta?"
    a: "Respuesta breve."
cta:                           # opcional: texto del bloque para agendar
  title: "Título del llamado a la acción"
  text: "Texto breve."
---

Contenido en Markdown...
```

- Listado: `/blog/` · Detalle: `/blog/{slug}/`
- Use un `slug` en minúsculas, con guiones y sin acentos.
- Use `##` para las secciones principales: aparecen automáticamente en el índice "En este artículo".
- Para un recuadro destacado, escriba una cita que empiece en negritas: `> **Consejo:** texto…`
- Cada artículo muestra automáticamente: autora, preguntas frecuentes, bloque para agendar cita y artículos relacionados.
- El contenido soporta listas, encabezados, tablas y enlaces (GFM).
