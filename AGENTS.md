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

## Compatibilidad y versiones

- La versión `1.9.x` corresponde a la línea de compatibilidad AutoScript `1.9`.
- El tercer componente versiona cambios del wrapper compatibles con esa línea.
- Una nueva línea de AutoScript exige revisar el manual oficial, actualizar
  pruebas y abrir la siguiente línea menor del paquete.
- No declares compatibilidad que no tenga una prueba o referencia verificable.

## Pruebas y controles

Antes de publicar cambios ejecuta:

```bash
npm ci
npm run check
```

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
