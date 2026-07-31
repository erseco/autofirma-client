# Seguridad y privacidad

## Lo que hace esta librería

- Convierte datos en memoria a Base64.
- Serializa opciones.
- Llama al objeto AutoScript proporcionado por la aplicación.
- Devuelve a la aplicación los resultados recibidos.

## Lo que no hace

- No envía documentos a un servidor propio.
- No almacena documentos ni firmas.
- No incluye analítica ni telemetría.
- No valida firmas, certificados o revocaciones.
- No garantiza la identidad de quien firma.

**La ausencia de almacenamiento se refiere exclusivamente a esta librería.** La
aplicación consumidora, AutoScript, AutoFirma o los servicios intermedios que se
configuren pueden procesar o almacenar datos conforme a su propia
implementación.

Para trámites reales, valida la firma en un backend de confianza y aplica
controles de acceso al original y al documento firmado.
