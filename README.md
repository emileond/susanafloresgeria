# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


## Blog en Markdown

Para facilitar el mantenimiento por personas no técnicas, los artículos del blog se escriben en archivos Markdown con frontmatter.

- Carpeta de posts: `src/content/blog/`
- Formato de archivo (`.md`) con frontmatter YAML:

```
---
slug: mi-primer-post
title: "Título del artículo"
date: 2026-01-03
excerpt: "Resumen corto para la tarjeta del blog."
---

Contenido en Markdown...
```

- La lista de artículos y las páginas de detalle se generan automáticamente:
  - Listado: `/blog`
  - Detalle: `/blog/{slug}`

### Agregar un nuevo artículo
1. Cree un archivo `.md` en `src/content/blog/` siguiendo el formato anterior.
2. Use un `slug` en minúsculas, con guiones y sin acentos.
3. Guarde el archivo. El sitio lo detectará automáticamente durante el build/servidor de desarrollo.

### Notas
- La fecha se muestra con formato local `es-MX`.
- El contenido Markdown soporta listas, encabezados, tablas y enlaces (GFM).
