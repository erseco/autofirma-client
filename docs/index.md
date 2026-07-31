# AutoFirma Client

`@erseco/autofirma-client` ofrece una API TypeScript moderna sobre AutoScript:
promesas, tipos, conversión Base64, errores normalizados y utilidades de prueba.

```ts
const result = await client.sign({
  data: file,
  format: "PAdES",
  parameters: { mode: "implicit" },
});
```

## Límite del proyecto

Este proyecto es independiente y no oficial. No incluye AutoFirma ni
`autoscript.js`, no accede por sí mismo a la red y no valida criptográficamente
los resultados.

[Empezar con la instalación](guia/instalacion.md)
