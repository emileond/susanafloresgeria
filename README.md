# Dra. Susana Flores Alonso — Geriatra en León

Monorepo con npm workspaces:

```
apps/
  web/          Sitio público (Astro + Tailwind): inicio, servicios y blog → susanafloresgeria.com
  app/          (próximamente) App de expedientes para la doctora: Vite + React + Cloudflare Workers, D1 y R2
packages/
  theme/        Colores, tipografía y logo compartidos (tokens de Tailwind)
```

## Comandos (desde la raíz)

| Comando             | Acción                                             |
| ------------------- | -------------------------------------------------- |
| `npm install`       | Instala las dependencias de todos los paquetes     |
| `npm run dev`       | Sitio web en `http://localhost:4321`               |
| `npm run build`     | Compila todos los proyectos                        |
| `npm run build:web` | Compila solo el sitio web (`apps/web/dist/`)       |
| `npm run check`     | Revisa errores de tipos en todos los proyectos     |

Para un comando de un solo proyecto: `npm run <script> -w @susanafloresgeria/web`.

## Tema compartido

`packages/theme/theme.css` define los colores (`brand`, `mist`, `ink`, `accent`…) y la tipografía (Figtree).
Cualquier proyecto con Tailwind v4 lo usa así:

```css
@import "tailwindcss";
@import "@susanafloresgeria/theme";
```

Agregue `"@susanafloresgeria/theme": "*"` a las dependencias del proyecto. Un cambio de color en ese archivo se refleja en el sitio y en la app.

## Despliegue

Cada app se despliega por separado en Cloudflare desde este mismo repositorio, indicando su carpeta (`apps/web`, `apps/app`) como raíz del proyecto. Así, un cambio en el blog no vuelve a desplegar la app de expedientes y viceversa.

Detalles de cada proyecto en su propio README: [apps/web](apps/web/README.md).
