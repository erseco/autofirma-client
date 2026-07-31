---
id: ADR-0006
titulo: "Web de página única sin generador"
estado: Aceptado
fecha: 2026-07-31
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0002]
  adrs: []
sustituye: []
sustituido_por: []
asistencia_ia:
  herramienta: ""
  modelo: ""
---

# ADR-0006: Web de página única sin generador

## Contexto

La documentación se generaba con `zensical` a partir de varias páginas Markdown
en `docs/` (`docs/index.md`, `docs/guia/instalacion.md`,
`docs/guia/uso-basico.md`, `docs/api/index.md`, `docs/ejemplos/index.md`,
`docs/compatibilidad.md`, `docs/seguridad.md`) y `zensical.toml`. El workflow
`docs.yml` instalaba Python 3.13 con `actions/setup-python`, ejecutaba
`pip install zensical` y `zensical build` antes de publicar en GitHub Pages.
Ninguna de esas páginas ejecutaba la librería: describían su uso en prosa.

## Problema

Mantener un generador de sitios y su toolchain de Python solo para publicar
documentación de un paquete npm añade una dependencia ajena al proyecto, y la
documentación en prosa no demuestra que la librería funcione contra una
AutoFirma real.

## Opciones consideradas

1. Mantener `zensical` y añadir la demo como una página más del sitio
   generado.
2. Sustituir `zensical` por otro generador de sitios estático en Node.
3. Sustituir el sitio generado por una única página HTML escrita a mano, con
   la demo ejecutable en la parte superior.

## Evidencias

`docs/index.md`, `docs/guia/instalacion.md`, `docs/guia/uso-basico.md`,
`docs/api/index.md`, `docs/ejemplos/index.md`, `docs/compatibilidad.md`,
`docs/seguridad.md` y `zensical.toml` ya no existen en el repositorio.
`web/index.html`, `web/demo.ts`, `web/certificate.ts` y `web/styles.css` los
sustituyen. En `.github/workflows/docs.yml`, el paso `actions/setup-python`
con `pip install zensical` y `zensical build` se sustituyó por
`actions/setup-node` con `npm ci` y `npm run build:web`, y sus `paths` de
disparo pasan de `docs/**` y `zensical.toml` a `web/**`, `src/**` y
`autoscript.lock.json`.

## Decisión

Se adopta la opción 3. `npm run build:web` compila la página única junto con
`autoscript.js` a `site/`, que es lo que publica `docs.yml` en GitHub Pages.

La opción 1 no resuelve el problema: conserva Python y la demo seguiría
descrita en prosa en vez de ejecutada. La opción 2 cambia una dependencia
externa por otra: un generador de sitios en Node sigue exigiendo un tema, un
modelo de contenido y su propio proceso de build para publicar una sola
página con una demo incrustada, en vez de reutilizar el mismo `tsup` que ya
compila la librería. Una demo ejecutable es código, no contenido: no gana
nada de pasar por un generador pensado para producir varias páginas a partir
de Markdown.

Los ADR y los SDD se quedan como Markdown en `docs/arquitectura/`, que GitHub
ya renderiza sin generador.

## Consecuencias

### Positivas

- El workflow de publicación deja de instalar un runtime de Python: solo usa
  el Node ya necesario para construir el paquete.
- La demo ejecuta operaciones reales de `AutoScript` en vez de describirlas.
- Un único fichero HTML es más fácil de mantener en sincronía con el código
  que varias páginas Markdown de un generador aparte.

### Negativas

- La página deja de tener navegación entre secciones propia de un sitio
  generado: es una sola página larga.
- Los estilos y el marcado se mantienen a mano, sin un tema ni una plantilla
  que los provea.

### Neutras

- `docs/arquitectura/` no cambia: sigue siendo Markdown ajeno al sitio
  publicado, pensado para leerse en el propio repositorio.

## Validación

`npm run build:web` debe generar `site/index.html` y copiar
`vendor/autoscript.js`. La demo no se prueba automáticamente porque exige
AutoFirma instalada: se verifica a mano antes de publicar, como registra
SDD-0002.

## Referencias

- `docs/arquitectura/sdd/SDD-0002-seguimiento-upstream-y-demo.md`
- `web/index.html`
- `.github/workflows/docs.yml`
