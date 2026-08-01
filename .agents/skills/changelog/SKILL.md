---
name: changelog
description: Genera un borrador de entrada del CHANGELOG para la próxima versión a partir de los pull requests mezclados en GitHub, o actualiza el bloque borrador existente con los PR mezclados desde uno ya incorporado. Pregunta qué modo ejecutar antes de empezar.
---

# Skill: generar o actualizar el borrador del CHANGELOG

> **Esta skill produce un borrador, no un changelog terminado.** La salida es un punto de partida para facilitar el trabajo: quien mantiene el proyecto debe revisar, editar y afinar cada entrada antes de commitear.

Hay dos modos:

- **Modo A — Actualizar el borrador existente** (el habitual, por ejemplo «mira si hay PR nuevos desde la última vez»): revisa los PR mezclados después de uno ya incorporado y añade las entradas nuevas al bloque borrador que ya encabeza `CHANGELOG.md`.
- **Modo B — Bloque de versión nuevo**: genera un bloque desde cero con todos los PR mezclados desde la última release _publicada_. Solo cuando se empieza el borrador de una versión que aún no tiene bloque.

---

## 0. Preguntar qué modo ejecutar

**Antes de nada**, pregunta:

> ¿Quieres (A) actualizar el borrador que encabeza el CHANGELOG con los PR mezclados desde uno que ya esté recogido, o (B) empezar un bloque de versión nuevo desde la última release publicada?

Si no lo tiene claro, o es la tarea recurrente de «mira si hay PR nuevos», usa el **modo A**.

---

## Lo que este proyecto tiene de particular

Léelo antes de escribir ninguna entrada; cambia qué número lleva el encabezado y qué merece aparecer.

- **La versión no se inventa ni se calcula.** Es la del tag mayor del repositorio oficial `ctt-gob-es/clienteafirma`, que registra `autoscript.lock.json` en su campo `tag` y refleja `package.json` (ver [ADR-0004](../../../docs/arquitectura/adr/ADR-0004-versionado-en-espejo.md)). En el modo B, léela de ahí en vez de preguntarla.
- **Un cambio de pin es la entrada más importante que puede haber.** Si `autoscript.lock.json` cambió, di qué versión de AutoScript se empaqueta ahora y de qué tag sale. Quien integra necesita eso más que cualquier otra línea.
- **Las versiones `canary` no se documentan.** Se publica una por push a `main`; el CHANGELOG cubre releases, no el canal de pruebas.
- **El texto va en español**, como el resto de documentación de cara a personas usuarias. El código, los identificadores y los nombres de fichero, en inglés.

---

## Modo A — Actualizar el borrador existente

### A.1 Preguntar por el último PR incorporado

Pregunta:

> ¿Cuál es el número del último PR que ya está reflejado en el borrador actual del CHANGELOG?

Espera el número (por ejemplo `12`). No intentes adivinarlo cruzando el texto del changelog con los títulos de los PR: es ambiguo y propenso a error; preguntar es más fiable.

### A.2 Obtener la fecha de corte

```bash
gh pr view <N> --repo erseco/autofirma-client --json number,title,mergedAt
```

Anota `mergedAt` como corte.

### A.3 Listar los PR mezclados después del corte

```bash
gh pr list \
  --repo erseco/autofirma-client \
  --state merged \
  --search "merged:>YYYY-MM-DDTHH:MM:SSZ" \
  --json number,title,body,labels,mergedAt \
  --limit 200
```

Ordena por `mergedAt` ascendente. De cada PR lee el `title` y el `body` **entero**: el título por sí solo esconde a menudo una corrección real mezclada con cambios de pruebas, o al revés.

### A.4 Descartar lo que no afecta a quien usa la librería

Salta los PR que solo tocan pruebas, CI, formato o herramientas internas sin cambio de comportamiento descrito en el cuerpo. Lee el cuerpo con atención: un PR titulado como cambio de pruebas puede describir un fallo real que corrigió en el código de la librería; en ese caso extrae solo esa corrección y deja fuera lo demás.

### A.5 Clasificar y redactar

Aplica la misma tabla de clasificación y las mismas reglas de estilo del modo B ([B.3](#b3-clasificar-cada-cambio) y [B.4](#b4-redactar-las-entradas)) a lo que sobreviva al filtro.

### A.6 Insertar en el bloque de arriba

Localiza el **primer** bloque `## vX.Y.Z…` de `CHANGELOG.md`, que es el borrador activo. Para cada entrada nueva:

- Insértala como viñeta en la subsección que corresponda de ese bloque.
- Si esa subsección no existe todavía, créala en el orden estándar: Añadido, Cambiado, Corregido, Actualizado, Eliminado.
- No crees un bloque `## vX.Y.Z` nuevo ni toques ningún bloque por debajo del primero.
- Comprueba duplicados **semánticos**, no solo coincidencias literales, antes de añadir nada.

### A.7 Informar

Di, PR por PR, cuáles se añadieron y en qué sección aterrizaron, y cuáles se descartaron y por qué. Después, el recordatorio de [B.7](#b7-recordar-que-es-un-borrador).

---

## Modo B — Bloque de versión nuevo

### B.0 Determinar la versión

**No la preguntes ni la calcules.** Léela:

```bash
node -p "require('./autoscript.lock.json').tag"
node -p "require('./package.json').version"
```

Deben coincidir (`v1.9.2` ↔ `1.9.2`); si no, para y avísalo, porque el workflow de release también lo comprueba y fallaría. Usa esa versión en el encabezado. La fecha es la de hoy en formato `aaaa-mm-dd`.

### B.1 Encontrar la última release publicada

```bash
gh release view --repo erseco/autofirma-client --json tagName,publishedAt
```

Si no hay ninguna release todavía, usa como corte la fecha del primer commit y recoge todo. Anota `publishedAt` como corte.

### B.2 Recoger los PR mezclados desde entonces

```bash
gh pr list \
  --repo erseco/autofirma-client \
  --state merged \
  --search "merged:>YYYY-MM-DDTHH:MM:SSZ" \
  --json number,title,body,labels,mergedAt \
  --limit 200
```

De cada PR lee `title`, el `body` completo —es la fuente principal, y un PR suele traer varios cambios sin relación bajo un solo título— y las `labels`.

Si el cuerpo referencia incidencias con `Closes #NNN`:

```bash
gh issue view NNN --repo erseco/autofirma-client --json title,body
```

**Este repositorio también recibe cambios sin PR**, empujados directamente a `main`. Compleméntalo con:

```bash
git log --oneline <tag-anterior>..HEAD
```

y trata cada commit relevante como una entrada más.

### B.3 Clasificar cada cambio

Un PR puede dar varias entradas.

| Sección         | Qué va aquí                                                               |
| --------------- | ------------------------------------------------------------------------- |
| **Añadido**     | Operaciones nuevas del cliente, opciones nuevas, documentación nueva      |
| **Cambiado**    | Comportamiento o contrato que cambia sin dejar de existir                 |
| **Corregido**   | Fallos, correcciones de comportamiento, mejoras de rendimiento, seguridad |
| **Actualizado** | Cambio del AutoScript empaquetado y subidas de dependencias               |
| **Eliminado**   | Operaciones, opciones o ficheros que dejan de existir                     |

Pistas de etiqueta: `bug` → Corregido; `enhancement`/`feature` → Añadido; `dependencies` → Actualizado; `breaking`/`removal` → Eliminado.

Cuando un PR mezcle añadidos y correcciones, sepáralos en entradas distintas.

### B.4 Redactar las entradas

- **Una frase por viñeta.** Empieza en mayúscula y no cierres con punto.
- **Encabeza con el área** cuando el cambio sea de una parte concreta: `AutoScript:`, `Demo:`, `Publicación:`.
- Describe **qué cambia para quien usa la librería**, no cómo está implementado:
  - ✅ `Un fichero demasiado grande devuelve ahora el código DATA_TOO_LARGE en vez de un error genérico`
  - ❌ `Añadida una rama en fromNativeError que comprueba outofmemory`
- **Dependencias**: `nombre-paquete: ANTIGUA → NUEVA`, en minúscula, con `→` y sin más palabras.
- **Cambio de pin**: `AutoScript: 1.9.0 → 1.10.1 (tag v1.9.1)`.
- Agrupa lo relacionado dentro de cada sección.

**Qué no incluir:** entradas duplicadas del mismo cambio, subidas de dependencias sin efecto visible —agrúpalas en una sola viñeta si son muchas—, commits de merge, cambios de versión, y lo puramente interno (CI, pruebas, formato) salvo que sea relevante.

### B.5 Montar el bloque

```markdown
## vX.Y.Z – AAAA-MM-DD

### Añadido

- …

### Corregido

- …

### Actualizado

- …

---
```

Omite las secciones vacías.

### B.6 Insertar en `CHANGELOG.md`

Justo después del encabezado `# CHANGELOG` y antes del bloque `## v…` anterior. Si el fichero no existe, créalo con ese encabezado. No modifiques nada por debajo del punto de inserción.

### B.7 Recordar que es un borrador

> ⚠️ Esto es un borrador. Revisa cada entrada antes de commitear:
>
> - Comprueba que se entiende sin conocer el código.
> - Fusiona o elimina lo redundante.
> - Verifica los números de versión contra el diff real de `package.json` y de `autoscript.lock.json`.
> - Añade lo que los PR no describieran explícitamente.

---

## Referencia de estilo

```markdown
## v1.9.2 – 2026-08-01

### Añadido

- La librería empaqueta AutoScript y lo entrega verificado por sha256, sin descarga manual
- `loadAutoScript(url)` inserta AutoScript como script clásico y resuelve con el objeto global
- `saveDataToFile` y `checkTime` cubren dos operaciones más de la API oficial

### Cambiado

- La versión del paquete pasa a reflejar el tag de AutoFirma en vez de la línea de AutoScript

### Corregido

- Un fichero demasiado grande devuelve el código `DATA_TOO_LARGE` en vez de un error genérico
- Demo: el fichero descargado conserva la extensión que corresponde al formato firmado

### Actualizado

- AutoScript: 1.9.0 → 1.10.1 (tag v1.9.1)
- typescript: 5.9.3 → 7.0.2
```
