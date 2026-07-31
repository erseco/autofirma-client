---
id: ADR-0001
titulo: "Versionar según la línea compatible de AutoScript"
estado: Aceptado
fecha: 2026-07-31
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0001]
  adrs: []
sustituye: []
sustituido_por: []
asistencia_ia:
  herramienta: "Codex"
  modelo: "GPT-5"
---

# ADR-0001: Versionar según la línea compatible de AutoScript

## Contexto

AutoScript y AutoFirma evolucionan fuera de este repositorio. El área oficial de
descargas publica AutoScript 1.9 y lo identifica como el código JavaScript para
abrir AutoFirma 1.9 desde el navegador.

## Problema

La versión del wrapper debe comunicar compatibilidad sin fingir que este paquete
es una distribución oficial.

## Opciones consideradas

1. SemVer completamente independiente.
2. Copiar exactamente cada versión de AutoFirma.
3. Usar mayor y menor para la línea de AutoScript y el parche para el wrapper.

## Decisión

Se adopta la opción 3. `1.9.x` identifica la línea probada con AutoScript 1.9 y
el parche versiona cambios compatibles propios. Una línea oficial nueva exige
revisión de API y pruebas antes de publicar una línea menor nueva.

## Consecuencias

- La compatibilidad es visible en npm.
- El paquete puede corregirse sin inventar una versión oficial.
- Un salto de AutoScript obliga a revisar y publicar una línea distinta.

## Validación

La CI prueba el adaptador y el release verifica que el tag coincide con
`package.json`.

## Referencias

- <https://administracionelectronica.gob.es/ctt/clienteafirma/descargas>
- `package.json`
- `tests/client.test.ts`
