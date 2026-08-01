# AutoFirma Client

Cliente TypeScript para usar la API oficial **AutoScript** con promesas,
tipado estricto, conversión de datos, errores normalizados y dobles de prueba.

> [!IMPORTANT]
> Este proyecto no pertenece al Gobierno de España, no incluye AutoFirma y no
> sustituye la validación criptográfica en servidor.

## Estado

El proyecto está en una fase inicial. La versión del paquete refleja el tag
del repositorio oficial `ctt-gob-es/clienteafirma`, no una línea propia de
AutoScript (ver [ADR-0004](docs/arquitectura/adr/ADR-0004-versionado-en-espejo.md)).
La versión de AutoScript realmente empaquetada, y sus constantes, son las que
registra `autoscript.lock.json`, la única fuente de verdad al respecto: hoy
fija el tag `v1.9.2`, que corresponde a AutoScript `1.9.0`. Consulta la
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

Las cadenas se interpretan como Base64. Para datos sin codificar usa `File`,
`Blob`, `ArrayBuffer` o `Uint8Array`.

### Servicios intermedios

```ts
const client = new AutoFirmaClient({
  storageUrl: "https://example.org/storage",
  retrieveUrl: "https://example.org/retrieve",
});
```

Estos servicios pertenecen al protocolo de transporte de AutoFirma. No son un
repositorio documental.

### Guardar ficheros y comprobar el reloj

```ts
await client.saveDataToFile({
  data: base64Data,
  title: "Guardar firma",
  filename: "firma",
  extension: "csig",
  description: "Firma electrónica (*.csig)",
});
```

`saveDataToFile` pide a AutoFirma que guarde datos en un fichero elegido por
la persona usuaria; rechaza si la versión fijada de AutoScript no expone la
operación.

```ts
await client.checkTime({ checkType: "CT_RECOMMENDED" });
```

`checkTime` no informa del resultado a través de la promesa que devuelve:
AutoScript hace una petición **síncrona** que bloquea la página mientras
espera respuesta y solo avisa de un desfase con un `alert()` nativo;
cualquier error (incluido uno de red) se silencia. Con
`checkType: "CT_OBLIGATORY"` puede además impedir en silencio que una llamada
posterior a `initialize()` cargue AutoFirma, así que el orden de las llamadas
importa. El docblock de `checkTime` en [`src/client.ts`](src/client.ts)
documenta el detalle completo.

### Ficheros de ejemplo

Para probar una integración local sin usar documentos reales:

- [Texto para CAdES](docs/ejemplos/files/ejemplo.txt)
- [XML para XAdES](docs/ejemplos/files/ejemplo.xml)
- [PDF para PAdES](docs/ejemplos/files/ejemplo.pdf)

Contienen datos ficticios. Una firma generada con ellos no demuestra que la
integración valide certificados, cadenas de confianza o revocación.

## Errores

Todo fallo llega como `AutoFirmaError`, que conserva intactos `nativeType` y
`nativeMessage` tal y como los devolvió AutoFirma. El campo `code` clasifica los
casos sobre los que se puede actuar:

| `code`                   | Cuándo                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `USER_CANCELLED`         | La persona usuaria canceló la operación o la selección de certificado. |
| `DATA_TOO_LARGE`         | El fichero excede la memoria disponible de AutoFirma.                  |
| `NATIVE_TIMEOUT`         | AutoFirma no respondió: no está instalada o no llegó a abrirse.        |
| `NATIVE_ERROR`           | Cualquier otro fallo de AutoFirma, incluidos sus códigos `SAF_xx`.     |
| `UNSUPPORTED_OPERATION`  | La versión fijada de AutoScript no expone esa operación.               |
| `AUTOSCRIPT_UNAVAILABLE` | `window.AutoScript` no existe o no es la API de AutoScript.            |

No existe un tamaño máximo declarado en ninguna parte. El fichero viaja entero
en una sola pieza codificado en Base64, que lo agranda un tercio, y el límite
real es la memoria de la aplicación nativa: al superarla responde `MEMORY_ERROR`
y el cliente lo entrega como `DATA_TOO_LARGE`.

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

### Symlinks en Windows

Los procedimientos recurrentes del proyecto viven como skills en
`.agents/skills/`, la ruta que leen Codex y Grok. Como Claude Code y GitHub
Copilot buscan en `.claude/skills/` y `.github/skills/`, esos dos directorios
contienen enlaces simbólicos a los mismos ficheros en vez de copias.

Git guarda esos enlaces como tales, pero **en Windows solo los recrea al clonar
si el soporte está activado**; de lo contrario aparecen como ficheros de texto
que contienen la ruta de destino, y ni Claude Code ni Copilot encontrarán las
skills. La copia real de `.agents/skills/` sigue funcionando en cualquier caso.

```bash
git config --global core.symlinks true
```

Hay que fijarlo **antes de clonar**: en un clon ya hecho no basta con activarlo,
hay que volver a clonar o restaurar esas rutas. Además, Windows exige modo de
desarrollador o privilegios de administrador para crear enlaces simbólicos.

> [!NOTE]
> `prepack` (y por tanto `npm pack` y `npm publish`) ejecuta
> `scripts/vendor-autoscript.ts` directamente con `node`, que necesita el
> soporte nativo de tipos activado por defecto (Node ≥22.18 o ≥23.6; en
> versiones anteriores de la línea 22 existe solo tras la flag
> `--experimental-strip-types`). Es intencional: la librería en sí es
> compatible con Node 20 (`engines.node`), pero los scripts de mantenimiento
> no. Empaquetar con una versión de Node anterior a esa falla con un error de
> sintaxis poco claro; usa Node 22.18 o superior para generar el tarball o
> publicar.

Los objetivos rápidos son:

- `make lint`: comprueba Prettier y TypeScript.
- `make fix`: aplica Prettier.
- `make test`: ejecuta Vitest con cobertura.
- `make build`: genera ESM, CommonJS y tipos.
- `make check`: ejecuta lint, tests y build.

## Publicación

Cada tag `v*` ejecuta `.github/workflows/release.yml`: comprueba que el tag
coincide con la versión de `package.json` y con el tag fijado en
`autoscript.lock.json`, repite todos los controles, verifica que el tarball
generado contiene `vendor/autoscript.js` con el `sha256` que registra el
lock y publica ese mismo tarball ya verificado (`npm publish artifacts/*.tgz`,
sin volver a empaquetar) en tres sitios: el registro público de npm, el gestor
de paquetes de GitHub y GitHub Releases.

La publicación en npm usa **npm Trusted Publishing con OIDC**, sin tokens. Antes
de la primera publicación hay que registrar en npm el repositorio
`erseco/autofirma-client` y los workflows `release.yml` y `canary.yml` como
publicadores de confianza.

### Canal canary

Cada push a `main` que pueda cambiar el paquete ejecuta
`.github/workflows/canary.yml`, que repite los mismos controles y la misma
verificación del tarball y publica bajo el dist-tag **`canary`**:

```bash
npm install @erseco/autofirma-client@canary
```

La versión se calcula sobre el **patch siguiente** al de `package.json`, no
sobre el actual: una preversión ordena por debajo de su versión, así que
`1.9.2-canary.x` quedaría por detrás de la `1.9.2` ya publicada pese a contener
más código. Con `1.9.3-canary.<sello>.<sha>` ordena por encima de `1.9.2`, por
debajo de un futuro `1.9.3`, y no ocupa ese número.

`latest` queda reservado a los tags de release, y un rango como `^1.9.2` no
acepta preversiones, así que quien instale de la forma habitual nunca recibirá
un canary sin pedirlo. Este canal es además la única vía para publicar
correcciones del wrapper entre dos tags de AutoFirma, que ADR-0004 registró como
la contrapartida del versionado en espejo.

Mientras no exista ninguna versión estable publicada, `npm install
@erseco/autofirma-client` sin sufijo no resuelve, porque no hay dist-tag
`latest`: hasta el primer tag hay que instalar con `@canary`.

GitHub Packages no admite Trusted Publishing, así que ese paso se autentica con
el `GITHUB_TOKEN` efímero del propio workflow y necesita el permiso
`packages: write`. Para instalar desde ahí hay que apuntar el ámbito `@erseco`
a ese registro y autenticarse, porque incluso los paquetes públicos de GitHub
Packages exigen credenciales para descargarse:

```
@erseco:registry=https://npm.pkg.github.com
```

Quien no quiera ese paso adicional tiene el paquete en npm sin autenticación.

## Documentación

Una página con una demo ejecutable se publica en
<https://erseco.github.io/autofirma-client/>, generada con
`npm run build:web` a partir de `web/`. Las decisiones de arquitectura (ADR y
SDD) están en [`docs/arquitectura/`](docs/arquitectura/).

## Licencia

GPL-2.0-or-later. AutoFirma y AutoScript conservan sus propias licencias y
marcas.
