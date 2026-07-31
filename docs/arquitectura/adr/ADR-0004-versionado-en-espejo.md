---
id: ADR-0004
titulo: "Versión en espejo del tag de AutoFirma"
estado: Aceptado
fecha: 2026-07-31
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0002]
  adrs: []
sustituye: [ADR-0001]
sustituido_por: []
asistencia_ia:
  herramienta: ""
  modelo: ""
---

# ADR-0004: Versión en espejo del tag de AutoFirma

## Contexto

ADR-0001 fijó `1.9.x`: mayor y menor identifican la línea de AutoScript y el
parche versiona el wrapper. Esa regla asumía que la propia constante `VERSION`
del fichero crece con cada versión oficial nueva, de modo que bastaba con
leerla para saber qué línea publicar.

## Problema

El paquete necesita una única fuente de verdad, automatizable, que ordene las
versiones oficiales de AutoFirma sin intervención manual y sin exigir criterio
sobre qué cuenta como "la misma línea".

## Opciones consideradas

1. Seguir leyendo la constante `VERSION` de `autoscript.js` como en ADR-0001.
2. Usar la fecha de publicación del tag oficial.
3. Usar el tag mayor del repositorio oficial por orden numérico.

## Evidencias

La constante interna no ordena. El tag `v1.9.1` (2026-04-29) trae
`autoscript.js` con `VERSION = "1.10.1"`, y el tag `v1.9.2` (2026-05-12),
publicado después, trae `VERSION = "1.9.0"`: `v1.9.2` cuelga de una línea
divergente, `git compare v1.9.1...v1.9.2` informa `diverged, ahead 1, behind
209`. Una clave que retrocede entre dos publicaciones consecutivas no sirve
para ordenarlas.

## Decisión

Se adopta la opción 3. La versión publicada es la del tag con el número mayor,
por orden numérico, entre los que siguen el patrón `vX.Y[.Z]` del repositorio
oficial `ctt-gob-es/clienteafirma`, normalizando `v1.9` a `1.9.0`. Se descartan
el legado (`OT_*`, `Version_*`) y las candidatas a release (`v1.9_RC`), que un
orden textual colocaría por delante del release definitivo.

La opción 1 queda descartada por la evidencia anterior: la propia constante no
ordena. La opción 2 ordenaría por la fecha que informa el servidor del
repositorio oficial, un dato ajeno al contenido del tag y que puede cambiar si
el tag se reetiqueta; el orden numérico de la opción 3 se deriva del propio
nombre del tag, así que cualquiera puede reproducirlo sin consultar ninguna
API. En el caso de `v1.9.1` y `v1.9.2` ambos órdenes coinciden, pero solo el
numérico no depende de un dato externo al propio tag.

## Consecuencias

### Positivas

- La selección del tag es una operación pura y automatizable: no depende de
  leer ni interpretar el contenido de `autoscript.js`.
- La versión publicada siempre corresponde a una publicación oficial real,
  identificable por su tag.

### Negativas

- Entre dos tags oficiales no queda ningún número libre para publicar una
  corrección propia. Las tres alternativas obvias están descartadas por la
  herramienta, no por criterio: npm elimina los metadatos de build
  (`1.9.2+1` se almacena como `1.9.2`), las preversiones ordenan por debajo de
  la versión final y `^1.9.2` no las acepta, y un cuarto número no es semver
  válido (`npm error Invalid version: 1.9.2.1`).
- El tag mayor puede traer un `autoscript.js` con una `VERSION` interna menor
  que la de un tag anterior, porque el proyecto oficial etiqueta desde líneas
  divergentes.

### Neutras

- `autoscript.lock.json` pasa a ser la fuente de verdad sobre qué
  `autoscript.js` corresponde a cada versión publicada, incluidas las tres
  constantes leídas del fichero.

## Validación

Pruebas de Vitest sobre `selectLatestTag` y `normalizeTagVersion` cubren la
normalización de `v1.9` y el descarte del legado y las candidatas. El release
sigue verificando que el tag `v` coincide con `package.json`.

## Referencias

- <https://github.com/ctt-gob-es/clienteafirma>
- `docs/arquitectura/sdd/SDD-0002-seguimiento-upstream-y-demo.md`
- `scripts/upstream.ts`
- `autoscript.lock.json`
