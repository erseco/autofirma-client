# API pública

## `AutoFirmaClient`

- `initialize()`: solicita la carga o apertura de AutoFirma.
- `sign(options)`: firma datos.
- `coSign(options)`: añade una firma al mismo nivel.
- `counterSign(options)`: contrafirma.
- `selectCertificate(parameters)`: selecciona un certificado.
- `raw`: acceso explícito a AutoScript.

## Utilidades

- `toBase64(data)`
- `serializeParameters(parameters)`
- `MockAutoFirmaClient` desde `@erseco/autofirma-client/testing`

Los tipos publicados en `dist/index.d.ts` son la referencia exacta del contrato.
