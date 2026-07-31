# AutoFirma Client

Cliente TypeScript para usar la API oficial **AutoScript** con promesas,
tipado estricto, conversión de datos, errores normalizados y dobles de prueba.

> [!IMPORTANT]
> Este proyecto no pertenece al Gobierno de España, no incluye AutoFirma y no
> sustituye la validación criptográfica en servidor.

## Estado

El proyecto está en una fase inicial. La línea `1.9.x` se desarrolla y prueba
contra AutoScript `1.9` y requiere AutoFirma `1.9` o posterior. Consulta la
política de compatibilidad en
[AGENTS.md](AGENTS.md#compatibilidad-y-versiones) antes de actualizar.

## Instalación

```bash
npm install @erseco/autofirma-client
```

El paquete incluye una copia fijada y verificada por hash de `autoscript.js`
en `vendor/autoscript.js`; no hace falta descargarla aparte. Ese fichero no es
un módulo: es un script clásico que no declara UMD ni exporta nada, sino que
confía en que su `var` de nivel superior se convierta en global. Por eso no
puede importarse con un empaquetador y hay que insertarlo como etiqueta
`<script>`. `loadAutoScript(url)` hace justo eso: sirve `vendor/autoscript.js`
desde tu propia infraestructura estática y pásale esa URL.

```ts
import { AutoFirmaClient, loadAutoScript } from "@erseco/autofirma-client";

const autoScript = await loadAutoScript("/vendor/autoscript.js");
const client = new AutoFirmaClient({ autoScript });
```

## Uso

```ts
import { AutoFirmaClient } from "@erseco/autofirma-client";

const client = new AutoFirmaClient();
client.initialize();

const file = document.querySelector<HTMLInputElement>("#document")?.files?.[0];

if (!file) {
  throw new Error("Selecciona un documento.");
}

const result = await client.sign({
  data: file,
  format: "PAdES",
  parameters: {
    mode: "implicit",
    signingReason: "Aprobación del documento",
  },
});

console.log(result.signature);
```

## Qué aporta

- API basada en `Promise`.
- Tipos para PAdES, CAdES, XAdES y FacturaE.
- Entradas `Blob`, `File`, `ArrayBuffer`, `Uint8Array` y Base64.
- Serialización segura de parámetros en el formato de AutoScript.
- Errores normalizados sin perder el tipo y mensaje nativos.
- `MockAutoFirmaClient` para pruebas de aplicaciones consumidoras.
- Acceso a `client.raw` para funciones oficiales no cubiertas todavía.

## Seguridad y privacidad

La librería transforma los datos en memoria y los entrega al objeto AutoScript
de la página. **No incluye telemetría, backend, cookies ni almacenamiento**. Que
un documento salga o no del equipo depende de la configuración de AutoScript,
de los servicios intermedios configurados por la aplicación y del código de la
aplicación consumidora.

No confíes en los datos devueltos por el navegador para decisiones jurídicas o
de autorización. Valida en servidor la firma, la integridad del documento, el
certificado, la cadena de confianza y, cuando proceda, la revocación.

## Desarrollo

```bash
make install
make check
```

La CI ejecuta formato, TypeScript, tests con cobertura y construcción en Node
20, 22 y 24.

Los objetivos rápidos son:

- `make lint`: comprueba Prettier y TypeScript.
- `make fix`: aplica Prettier.
- `make test`: ejecuta Vitest con cobertura.
- `make build`: genera ESM, CommonJS y tipos.
- `make check`: ejecuta lint, tests y build.

## Publicación

Los tags `v1.9.x` ejecutan `.github/workflows/release.yml`, verifican que el tag
coincida con `package.json`, repiten todos los controles, publican el paquete en
npm y adjuntan el tarball a GitHub Releases.

La publicación usa **npm Trusted Publishing con OIDC**. Antes de la primera
publicación hay que registrar en npm el repositorio `erseco/autofirma-client` y
el workflow `release.yml` como publicador de confianza.

## Documentación

Una página con una demo ejecutable se publica en
<https://erseco.github.io/autofirma-client/>, generada con
`npm run build:web` a partir de `web/`. Las decisiones de arquitectura (ADR y
SDD) están en [`docs/arquitectura/`](docs/arquitectura/).

## Licencia

GPL-2.0-or-later. AutoFirma y AutoScript conservan sus propias licencias y
marcas.
