# Instrucciones para agentes

## Alcance del proyecto

Este repositorio contiene un wrapper TypeScript fino sobre el objeto global
oficial `AutoScript`. No reimplementa criptografía, no valida firmas y no
redistribuye `autoscript.js`.

## Idioma y estilo

- El código, los identificadores, las APIs públicas y los mensajes técnicos
  internos se escriben en inglés.
- Los comentarios, docblocks, README, documentación y textos dirigidos a
  personas usuarias se escriben en español.
- Usa dos espacios en TypeScript, JSON y YAML.
- Mantén TypeScript en modo estricto. No introduzcas `any` salvo que un límite
  externo lo haga imprescindible y quede documentado.
- La API debe permanecer independiente de frameworks.

## Arquitectura

- `src/client.ts`: fachada pública y orquestación.
- `src/autoscript-adapter.ts`: adaptación exclusiva de callbacks nativos.
- `src/types.ts`: contratos públicos.
- `src/base64.ts` y `src/parameters.ts`: normalización sin efectos laterales.
- `src/testing/`: dobles de prueba para proyectos consumidores.
- `docs/arquitectura/`: ADR y SDD en español.

La librería debe seguir siendo una capa de adaptación. No añadas almacenamiento,
REST, UI, validación criptográfica ni lógica específica de WordPress.

## Integración con AutoScript

Antes de envolver una operación de AutoScript, comprueba su firma real y el
valor literal de sus constantes en `vendor/autoscript.js`, el fichero fijado
por `autoscript.lock.json`. No los asumas por el nombre de la operación ni por
el manual oficial: `needNativeAppInstalled` se wrapeó como asíncrona con
callback y en realidad está deprecada, no acepta argumentos y devuelve `true`
de forma síncrona, así que la promesa nunca resolvía contra el fichero real; y
`checkTime` se llamó con `CHECKTIME_NO`/`CHECKTIME_RECOMMENDED`/
`CHECKTIME_OBLIGATORY`, que no existen, en vez de los valores reales
`CT_NO`/`CT_RECOMMENDED`/`CT_OBLIGATORY`.

Un doble de prueba nunca debe definir el contrato. Ambos fallos tenían un test
en verde porque el mock reproducía la forma asumida, no la real: la prueba
validaba el defecto en vez de detectarlo. Antes de escribir el doble, lee la
operación en `vendor/autoscript.js`.

## Compatibilidad y versiones

- La versión del paquete es la del tag mayor del repositorio oficial
  `ctt-gob-es/clienteafirma`, no la línea de AutoScript: ver ADR-0004.
- El `autoscript.js` fijado y sus constantes (`VERSION`, `VERSION_CODE`,
  `PROTOCOL_VERSION`) quedan registrados en `autoscript.lock.json`, la única
  fuente de verdad sobre qué AutoScript corresponde a cada versión publicada.
- Un workflow programado vigila el repositorio oficial y abre un pull request
  cuando cambia el tag mayor; actualizar el lock y publicar sigue siendo una
  decisión manual.
- No declares compatibilidad que no tenga una prueba o referencia verificable.

## Pruebas y controles

Antes de publicar cambios ejecuta:

```bash
make install
make check
```

Usa `make lint`, `make test` y `make build` como las mismas puertas que ejecuta
CI. `make fix` aplica el formato localmente y no debe usarse como sustituto de
una comprobación limpia en el pipeline.

Los cambios de API necesitan tests. Conserva los datos nativos al normalizar
errores. Prueba casos de cancelación, operaciones ausentes, entradas binarias y
serialización de parámetros.

## Releases

- No modifiques una release publicada.
- El tag debe ser `v` seguido exactamente de la versión de `package.json`.
- `release.yml` publica en npm mediante Trusted Publishing y crea el release de
  GitHub con el tarball.
- No añadas tokens npm al repositorio ni al workflow.

## Documentación de arquitectura

Consulta `docs/arquitectura/adr/records.md` y
`docs/arquitectura/sdd/records.md` antes de decisiones relevantes.

- Crea un ADR para decisiones duraderas.
- Crea un SDD para cambios amplios o transversales.
- Los IDs son correlativos y no se reutilizan.
- Los ADR aceptados son históricos: se sustituyen con otro ADR, no se reescriben.
