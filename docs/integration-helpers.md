# Ayudas de integración

`@erseco/autofirma-client` mantiene el resultado nativo de las operaciones de
firma en Base64, pero expone utilidades para los casos habituales de integración
con aplicaciones web.

## Comprobar si AutoScript está disponible

`isAutoScriptAvailable()` permite adaptar la interfaz antes de construir el
cliente. La comprobación no se limita a verificar que `window.AutoScript` sea
truthy: exige que el objeto exponga una función `sign`, evitando aceptar por
error elementos DOM que ocupen ese nombre global.

```ts
import { isAutoScriptAvailable } from "@erseco/autofirma-client";

if (isAutoScriptAvailable()) {
  // Enable the AutoFirma signing action.
}
```

Esta función comprueba únicamente que el bridge JavaScript esté cargado. No
puede garantizar que la aplicación nativa AutoFirma esté instalada, responda o
pueda completar una operación concreta.

## Configurar el nombre de aplicación y el idioma

El constructor acepta `appName` y `locale`. Ambos valores se reenvían a
`setAppName` y `setLocale` cuando esas operaciones existen en la versión de
AutoScript utilizada.

```ts
import { AutoFirmaClient } from "@erseco/autofirma-client";

const client = new AutoFirmaClient({
  appName: "Document signer",
  locale: "es_ES",
});

client.initialize();
```

Estas opciones son compatibles con objetos AutoScript que no expongan los
setters: en ese caso se omiten sin impedir el uso del resto del cliente.

`locale` utiliza directamente los identificadores admitidos por AutoScript,
como `es_ES` o `en_US`; la librería no transforma códigos de idioma de la
aplicación consumidora.

## Convertir una firma Base64 a bytes

Las operaciones `sign`, `coSign` y `counterSign` conservan `signature` como
Base64 para representar fielmente el contrato de AutoScript y evitar crear una
segunda copia binaria del resultado en memoria cuando no sea necesaria.

Cuando una aplicación necesita un `Uint8Array`, por ejemplo para construir un
`Blob`, inspeccionar una cabecera de fichero o descargar el resultado, puede
usar `fromBase64()`:

```ts
import { AutoFirmaClient, fromBase64 } from "@erseco/autofirma-client";

const client = new AutoFirmaClient();

const result = await client.sign({
  data: pdfBytes,
  format: "PAdES",
  parameters: { mode: "implicit" },
});

const signedPdf = fromBase64(result.signature);
const blob = new Blob([signedPdf], { type: "application/pdf" });
```

`fromBase64()` decodifica Base64 estándar y devuelve un `Uint8Array`. No valida
el formato interno de los datos: si la aplicación espera un PDF, XML u otro
formato concreto debe comprobarlo en su propia capa.
