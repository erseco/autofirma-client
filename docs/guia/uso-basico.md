# Uso básico

```ts
import { AutoFirmaClient } from "@erseco/autofirma-client";

const client = new AutoFirmaClient();
client.initialize();

const result = await client.sign({
  data: file,
  algorithm: "SHA256withRSA",
  format: "PAdES",
  parameters: {
    mode: "implicit",
    signingReason: "Conformidad",
  },
});
```

Las cadenas se interpretan como Base64. Para datos sin codificar usa `File`,
`Blob`, `ArrayBuffer` o `Uint8Array`.

## Servicios intermedios

```ts
const client = new AutoFirmaClient({
  storageUrl: "https://example.org/storage",
  retrieveUrl: "https://example.org/retrieve",
});
```

Estos servicios pertenecen al protocolo de transporte de AutoFirma. No son un
repositorio documental.
