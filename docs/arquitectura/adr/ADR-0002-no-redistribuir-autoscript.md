---
id: ADR-0002
titulo: "No redistribuir AutoScript"
estado: Aceptado
fecha: 2026-07-31
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0001]
  adrs: []
sustituye: []
sustituido_por: [ADR-0005]
asistencia_ia:
  herramienta: "Codex"
  modelo: "GPT-5"
---

# ADR-0002: No redistribuir AutoScript

## Contexto

Este proyecto adapta una API oficial global, pero no necesita modificar ni
incorporar su implementación.

## Problema

Incluir `autoscript.js` mezclaría el ciclo de actualización y las condiciones de
distribución de dos proyectos distintos.

## Decisión

El paquete no incluirá AutoScript. La aplicación consumidora cargará una copia
obtenida de la fuente oficial y podrá inyectarla al cliente.

## Consecuencias

- El paquete queda claramente identificado como wrapper no oficial.
- Cada aplicación controla la versión oficial y su política de actualización.
- La instalación necesita un paso explícito adicional.

## Validación

`npm pack --dry-run` no debe listar `autoscript.js`.

## Referencias

- <https://github.com/ctt-gob-es/clienteafirma>
- `package.json`
- `src/autoscript-adapter.ts`
