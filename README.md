# Sitio web — Dra. Susana Flores Alonso, Geriatra en León

Sitio estático construido con [Astro](https://astro.build) + Tailwind CSS. Genera HTML puro (sin depender de JavaScript para mostrar el contenido), lo que lo hace rápido en celulares y fácil de indexar por Google.

## Comandos

| Comando           | Acción                                          |
| ----------------- | ----------------------------------------------- |
| `npm install`     | Instala dependencias                            |
| `npm run dev`     | Servidor de desarrollo en `http://localhost:4321` |
| `npm run build`   | Genera el sitio final en `dist/`                |
| `npm run preview` | Sirve localmente la carpeta `dist/`             |
| `npm run check`   | Revisa errores de tipos y plantillas            |

`dist/` se puede publicar en cualquier hosting estático (Cloudflare Pages, Netlify, Vercel, GitHub Pages…).

## Dónde cambiar las cosas

- **Teléfono, WhatsApp, correo, dirección, horarios, precios y cédulas:** `src/config/site.ts`. Todo el sitio toma los datos de ahí.
- **Textos de la página principal** (servicios, pasos, testimonios, preguntas frecuentes): `src/pages/index.astro`. Cada sección está separada con un comentario.
- **Colores y tipografías:** `src/styles/global.css`.
- **Foto:** `src/assets/headshot.png`. Astro la optimiza automáticamente (WebP, varios tamaños).
- **Imagen para compartir en WhatsApp/Facebook:** `public/og-image.jpg` (1200×630).

## Blog en Markdown

Los artículos se escriben en archivos Markdown con frontmatter en `src/content/blog/`:

```
---
slug: mi-primer-post
title: "Título del artículo"
date: 2026-01-03
excerpt: "Resumen corto para la tarjeta del blog."
---

Contenido en Markdown...
```

- Listado: `/blog/` · Detalle: `/blog/{slug}/`
- Use un `slug` en minúsculas, con guiones y sin acentos.
- Cada artículo muestra automáticamente un bloque para agendar cita y artículos relacionados.
- El contenido soporta listas, encabezados, tablas y enlaces (GFM).
