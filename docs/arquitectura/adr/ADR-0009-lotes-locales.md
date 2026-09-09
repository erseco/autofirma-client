---
id: ADR-0009
titulo: "Firma local por lotes"
estado: Propuesto
fecha: 2026-09-06
---

# ADR-0009: Firma local por lotes

## Contexto y decisión

Se necesita firmar varios PDF con la misma marca visible en una operación.
Exponer `signBatch` como lote JSON local con parámetros comunes, IDs únicos y resultados nativos por documento. Impedir operaciones concurrentes sobre el mismo AutoScript y restaurar el modo local al terminar.

## Consecuencias

Se conserva la firma individual. Los fallos parciales no anulan los documentos
correctos: se usa `stopOnError: false`. Cada resultado se asocia por ID, nunca
por su posición. Los lotes viajan completos en memoria y deben respetar los
límites de tamaño y tiempo del transporte. No se añade servidor trifásico.

## Enmienda (2026-09-09): parámetros por documento

Los parámetros comunes no bastan cuando cada PDF tiene el hueco del sello en una
página y una altura distintas. El formato del lote ya lo contempla y la
librería no lo exponía: `addDocumentToBatch(id, datareference, format,
suboperation, extraparams)` admite extraparams por documento, y
`JSONBatchManager` los usa **en lugar de** los del lote cuando vienen —no los
mezcla— y copia los del lote si no. Cada documento de `signBatch` acepta ahora
`parameters` opcionales con esa semántica: completos, no un delta. Se serializan
antes de crear el lote, para que un parámetro inválido rechace sin dejar un
lote a medias en el global de AutoScript.

## Evidencia y validación

- [AutoScript fijado](https://github.com/ctt-gob-es/clienteafirma/blob/b4fe147c322932ebdd11e25db3134af934e0e832/afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js).
- [Formato local de respuesta](https://github.com/ctt-gob-es/clienteafirma/blob/b4fe147c322932ebdd11e25db3134af934e0e832/afirma-simple/src/main/java/es/gob/afirma/standalone/protocol/JSONBatchManager.java).
- [Extraparams por singlesign](https://github.com/ctt-gob-es/clienteafirma/blob/b4fe147c322932ebdd11e25db3134af934e0e832/afirma-simple/src/main/java/es/gob/afirma/standalone/protocol/JSONBatchManager.java#L148-L156): sustituyen a los del lote, no se mezclan.
- Pruebas de errores parciales, cancelaciones y correspondencia por ID.
- SDD-0003 describe la integración y sus comprobaciones.
