---
id: SDD-0003
titulo: "Firma de varios PDF con sello común"
estado: Implementado
fecha: 2026-09-06
---

# SDD-0003: Firma de varios PDF con sello común

## Alcance

Exponer `signBatch` como lote JSON local con parámetros comunes, IDs únicos y resultados nativos por documento. Impedir operaciones concurrentes sobre el mismo AutoScript y restaurar el modo local al terminar.

## Flujo y errores

1. Validar selección y preparar datos antes de abrir AutoFirma.
2. Configurar una sola vez formato PAdES, texto, página y rectángulo.
3. Enviar documentos con identificadores únicos en una operación local.
4. Procesar resultados por ID. Mostrar los errores individuales y conservar
   las firmas correctas. Un éxito nativo no implica persistencia en servidor.

No ejecutar firmas en paralelo. El modo local vuelve a desactivarse incluso
tras cancelaciones. En WordPress, comprobar permisos por documento, conservar
los originales y permitir descargar cada PDF firmado aunque falle su guardado.
La pantalla no vuelve a firmar automáticamente un lote ya procesado.

## Pruebas

`make check` comprueba tipos, normalización binaria, parámetros compartidos, respuestas inválidas, solapamientos, cancelación y errores parciales. `npm run build:web` construye la demo de selección múltiple.

La comprobación manual final requiere AutoFirma: seleccionar dos PDF, activar
sello común, firmar y abrir ambos resultados para comprobar página y posición.
Repetir con un PDF inválido y con cancelación. No se afirma compatibilidad móvil
sin probarla en el dispositivo de destino.
