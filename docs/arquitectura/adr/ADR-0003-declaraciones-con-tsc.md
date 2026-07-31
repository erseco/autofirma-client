---
id: ADR-0003
titulo: "Emitir las declaraciones con tsc"
estado: Aceptado
fecha: 2026-07-31
relacionados:
  issues: []
  prs: [2]
  sdds: []
  adrs: []
sustituye: []
sustituido_por: []
asistencia_ia:
  herramienta: ""
  modelo: ""
---

# ADR-0003: Emitir las declaraciones con tsc

## Contexto

El build empaquetaba JavaScript y declaraciones en una sola herramienta: `tsup`
con la opción `dts: true`. Esa opción no usa `tsc`, sino `rollup-plugin-dts`
incrustado en el propio `tsup`.

TypeScript 7 es el compilador reescrito en Go y ya es la versión `latest` del
paquete `typescript`. Su paquete npm expone únicamente `version` y
`versionMajorMinor`: la API JavaScript del compilador (`ts.sys`,
`ts.createProgram`, `ts.createCompilerHost`) ha desaparecido.

## Problema

`rollup-plugin-dts` lee `ts.sys.useCaseSensitiveFileNames` al cargarse. Con
TypeScript 7 instalado, `npm run build` aborta con
`TypeError: Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`.
El paquete declara compatibilidad con `^4.5 || ^5.0 || ^6.0`, así que no es un
fallo puntual: ninguna herramienta que dependa de la API JavaScript del
compilador funciona bajo TypeScript 7 mientras no se reescriba.

La línea de bundling no está afectada, porque `tsup` transpila con esbuild y
esbuild elimina los tipos sin consultar al compilador.

## Opciones consideradas

1. Fijar `typescript` en la línea 5.x e ignorar el major en Dependabot.
2. Sustituir `tsup` por otra herramienta de empaquetado con soporte para
   TypeScript 7.
3. Separar responsabilidades: `tsup` emite JavaScript y `tsc` emite las
   declaraciones.

## Evidencias

Con `typescript@7.0.2` instalado:

- `tsc --noEmit` valida `src`, `tests` y la configuración sin cambios en el
  código fuente.
- `tsc -p tsconfig.build.json` genera `dist/index.d.ts` y
  `dist/testing/index.d.ts` en las rutas que declaran `types` y `exports`.
- Un proyecto consumidor con `moduleResolution: NodeNext` resuelve los tipos de
  ambos puntos de entrada desde el tarball empaquetado.

## Decisión

`tsup` deja de generar declaraciones. `npm run build` ejecuta
`tsup && tsc -p tsconfig.build.json`, donde `tsconfig.build.json` hereda de
`tsconfig.json` y solo añade `rootDir`, `outDir` y `emitDeclarationOnly` sobre
`src`.

La opción 1 aplaza el problema sin resolverlo. La opción 2 cambia una
herramienta que funciona por un motivo que no le corresponde.

## Consecuencias

### Positivas

- El build funciona con TypeScript 5, 6 y 7 sin condicionales.
- Las declaraciones las produce el compilador oficial, no un reempaquetador.
- El contrato publicado deja de depender de un plugin de terceros.

### Negativas

- El build tiene dos pasos en lugar de uno.
- `dist` contiene un `.d.ts` por módulo en vez de un fichero agregado.

### Neutras

- Dejan de emitirse los `.d.cts`. El campo `exports` nunca los referenció: tanto
  `import` como `require` resuelven a `./dist/index.d.ts`.
- `declarationMap` queda desactivado en el build porque `files` no publica
  `src` y los mapas apuntarían a ficheros ausentes del paquete.

## Validación

`npm run build` debe generar `dist/index.d.ts` y `dist/testing/index.d.ts`.
`make check` debe terminar sin errores con la versión de TypeScript instalada.

## Referencias

- `tsconfig.build.json`
- `tsup.config.ts`
- <https://github.com/Swatinem/rollup-plugin-dts>
