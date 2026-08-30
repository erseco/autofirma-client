# CHANGELOG

## Sin publicar

### Añadido

- `fromBase64` convierte resultados Base64 a `Uint8Array` sin depender de Node.js
- `isAutoScriptAvailable` permite comprobar de forma segura si el bridge global de AutoScript está cargado
- `AutoFirmaClientOptions` acepta `appName` y `locale`, que se reenvían a AutoScript cuando la versión utilizada expone `setAppName` y `setLocale`
- Documentación específica de las ayudas de integración y de sus límites

## v1.9.2 – 2026-08-01

Primera versión publicada.

### Añadido

- `AutoFirmaClient` envuelve la API oficial AutoScript con promesas y tipado estricto: `sign`, `coSign`, `counterSign` y `selectCertificate`
- `saveDataToFile` pide a AutoFirma que guarde datos en un fichero elegido por la persona usuaria
- `checkTime` comprueba la sincronía del reloj del equipo, con la advertencia de que la promesa no informa del resultado y de que `CT_OBLIGATORY` puede impedir en silencio que una llamada posterior a `initialize()` cargue AutoFirma
- Las entradas aceptan `Blob`, `File`, `ArrayBuffer`, `Uint8Array` y cadenas Base64
- `serializeParameters` compone los `extraParams` en el formato que exige AutoScript y neutraliza los saltos de línea de los valores, que de otro modo añadirían parámetros que quien integra nunca puso
- Todo fallo llega como `AutoFirmaError` conservando `nativeType` y `nativeMessage`, clasificado en `USER_CANCELLED`, `DATA_TOO_LARGE`, `NATIVE_TIMEOUT`, `NATIVE_ERROR`, `UNSUPPORTED_OPERATION` y `AUTOSCRIPT_UNAVAILABLE`
- El paquete incluye AutoScript verificado por sha256, sin descarga manual: AutoScript 1.9.0, del tag `v1.9.2` de `ctt-gob-es/clienteafirma`
- `loadAutoScript(url)` inserta AutoScript como script clásico y resuelve con el objeto global; acepta `integrity` y `crossOrigin` para verificar el fichero cuando se sirve desde un origen que no controlas
- `MockAutoFirmaClient`, en `@erseco/autofirma-client/testing`, para pruebas de aplicaciones consumidoras
- `client.raw` da acceso al objeto oficial para las funciones que el wrapper todavía no cubre
- Demo de página única que firma con AutoFirma real: firma visible PAdES, estampado de imagen, datos del certificado firmante, descarga con la extensión que corresponde al formato y aviso de que desde el móvil no puede firmar
- Publicación en npm mediante Trusted Publishing y en GitHub Packages, con el mismo tarball verificado contra el pin
- Canal `canary`: cada push a `main` publica una preversión bajo ese dist-tag, sin tocar `latest`
- Un workflow semanal vigila el repositorio oficial y abre un pull request cuando cambia el tag mayor

### Cambiado

- La versión del paquete refleja el tag mayor de `ctt-gob-es/clienteafirma`, no la línea de AutoScript: por eso la primera versión es la 1.9.2 y no la 0.1.0 (ADR-0004)

### Actualizado

- typescript: 5.9.3 → 7.0.2
- vitest: 3.2.7 → 4.1.10
- @vitest/coverage-v8: 3.2.7 → 4.1.10
- @types/node: 20.19.43 → 26.1.2

---
