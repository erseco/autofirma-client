---
id: ADR-0010
titulo: "Mayor y menor del tag oficial, parche propio"
estado: Aceptado
fecha: 2026-10-15
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0002]
  adrs: [ADR-0004, ADR-0007]
sustituye: [ADR-0004]
sustituido_por: []
asistencia_ia:
  herramienta: "Claude Code"
  modelo: "claude-opus-5-5"
---

# ADR-0010: Mayor y menor del tag oficial, parche propio

## Contexto

ADR-0004 hizo que la versión del paquete fuera idéntica al tag mayor del
repositorio oficial y aceptó, como contrapartida, que entre dos tags no quedara
ningún número para publicar correcciones propias.

## Problema

`1.9.2` se publicó en npm el 2026-08-02 y se retiró. npm no permite reutilizar
un número despublicado, así que con la regla del espejo no hay ninguna versión
estable posible hasta que exista un tag oficial nuevo. Mientras tanto `latest`
apunta a una canary antigua y ya hay paquetes de terceros que dependen de una
preversión concreta.

## Opciones consideradas

1. Esperar al siguiente tag oficial.
2. Sufijos como `1.9.3-r1`.
3. Mayor y menor del tag fijado; el parche, propio del wrapper.

## Evidencias

`npm view @erseco/autofirma-client time` muestra `1.9.2`, pero `versions` no la
incluye. Un sufijo `-r1` es una preversión en semver: ordena por debajo de
`1.9.3` y `^1.9.0` no la resuelve, igual que las canary.

## Decisión

Se adopta la opción 3. El mayor y el menor del paquete son los del campo `tag`
de `autoscript.lock.json`; el parche lo decide el wrapper y solo crece. Una
línea oficial nueva (`v1.10.x`) abre `1.10.0` o el primer parche libre. Qué
AutoScript empaqueta cada versión lo sigue registrando el lock, y lo recogen el
CHANGELOG y las notas de la release.

## Consecuencias

### Positivas

- Las correcciones del wrapper pueden publicarse como estables sin esperar al
  proyecto oficial.
- Se puede publicar ya `1.9.3`, fijada al tag `v1.9.2`.

### Negativas

- El parche del paquete deja de coincidir con el del tag oficial: `1.9.3` no
  significa AutoFirma 1.9.3. Hay que consultar el lock o el CHANGELOG.

### Neutras

- El workflow de publicación compara mayor y menor con el lock, en lugar de la
  versión completa.

## Validación

`publish.yml` aborta la release si el tag no es la versión de `package.json` o
si esta no comparte mayor y menor con el tag del lock.

## Referencias

- `docs/arquitectura/adr/ADR-0004-versionado-en-espejo.md`
- `autoscript.lock.json`
- `.github/workflows/publish.yml`
