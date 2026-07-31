# Seguimiento del AutoScript oficial, empaquetado y demo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fijar, verificar y empaquetar el `autoscript.js` oficial, vigilar el repositorio upstream, ampliar mínimamente la API y publicar una demo ejecutable en una página única.

**Architecture:** Un fichero de pin versionado (`autoscript.lock.json`) es la única fuente de verdad sobre qué AutoScript corresponde a cada versión publicada. Dos scripts de Node lo consumen: uno descarga y verifica el fichero para el empaquetado, otro vigila upstream y abre un pull request cuando el tag mayor cambia. La librería añade un cargador de script clásico y tres operaciones. La web deja de generarse con zensical y pasa a ser una página única con la demo.

**Tech Stack:** TypeScript estricto, tsup (esbuild) para bundles, tsc para declaraciones, Vitest con umbrales de cobertura, GitHub Actions, npm Trusted Publishing.

## Global Constraints

- Código, identificadores y APIs públicas en inglés; comentarios, docblocks y documentación en español.
- Dos espacios de indentación en TypeScript, JSON y YAML.
- TypeScript en modo estricto. Prohibido `any` salvo límite externo documentado.
- Todo fichero debe pasar `npx prettier --check .`: la CI lo ejecuta en `make lint`.
- Umbrales de cobertura vigentes sobre `src/**/*.ts`: 90 % líneas, funciones y sentencias; 85 % ramas.
- La librería no incorpora criptografía, validación de firmas, red propia ni persistencia.
- Repositorio upstream: `ctt-gob-es/clienteafirma`. Ruta del fichero: `afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js`.
- Pin inicial: tag `v1.9.2`, `sha256` `567998128f1cd8017c304a8c187f6912a0c56b0feebb02fffa2aa33732e40439`, `VERSION` `1.9.0`, `VERSION_CODE` `3`, `PROTOCOL_VERSION` `4`.
- Los scripts de `scripts/` se ejecutan con Node ≥ 24 (usan el borrado nativo de tipos). La librería publicada mantiene `engines.node >= 20`.
- Nunca añadir atribución de IA en commits, PR ni documentación.

---

## Fase A — Pin, empaquetado y vigilancia (tareas 1 a 5)

### Task 1: Utilidades puras de upstream

**Files:**

- Create: `scripts/upstream.ts`
- Create: `tests/upstream.test.ts`
- Modify: `tsconfig.json` (añadir `"scripts"` a `include`)

**Interfaces:**

- Produces: `selectLatestTag(tagNames: string[]): string` — devuelve el tag mayor por orden numérico; `parseAutoscriptConstants(source: string): { version: string; versionCode: number; protocolVersion: number }`; `sha256Hex(data: Uint8Array): string`; `normalizeTagVersion(tag: string): string`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/upstream.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeTagVersion,
  parseAutoscriptConstants,
  selectLatestTag,
  sha256Hex,
} from "../scripts/upstream.js";

describe("selectLatestTag", () => {
  it("descarta el legado y las candidatas a versión", () => {
    const tags = [
      "v1.8.3",
      "v1.9",
      "v1.9.1",
      "v1.9.2",
      "v1.9_RC",
      "OT_22250",
      "Version_1.7",
    ];
    expect(selectLatestTag(tags)).toBe("v1.9.2");
  });

  it("ordena numéricamente y no alfabéticamente", () => {
    expect(selectLatestTag(["v1.9.9", "v1.9.10"])).toBe("v1.9.10");
  });

  it("prefiere el patch sobre la línea sin patch", () => {
    expect(selectLatestTag(["v1.9", "v1.9.1"])).toBe("v1.9.1");
  });

  it("falla cuando no hay ningún tag válido", () => {
    expect(() => selectLatestTag(["OT_1"])).toThrow(/ningún tag/i);
  });
});

describe("normalizeTagVersion", () => {
  it("completa el tercer componente ausente", () => {
    expect(normalizeTagVersion("v1.9")).toBe("1.9.0");
  });

  it("conserva la versión completa", () => {
    expect(normalizeTagVersion("v1.9.2")).toBe("1.9.2");
  });
});

describe("parseAutoscriptConstants", () => {
  const source = [
    "var AutoScript = ( function ( window, undefined ) {",
    '\t\tvar VERSION = "1.9.0";',
    "\t\tvar VERSION_CODE = 3;",
    "\t\t\tvar PROTOCOL_VERSION = 4;",
  ].join("\n");

  it("lee las tres constantes", () => {
    expect(parseAutoscriptConstants(source)).toEqual({
      version: "1.9.0",
      versionCode: 3,
      protocolVersion: 4,
    });
  });

  it("falla si falta alguna constante", () => {
    expect(() => parseAutoscriptConstants('var VERSION = "1.9.0";')).toThrow(
      /VERSION_CODE/,
    );
  });
});

describe("sha256Hex", () => {
  it("calcula la huella conocida de una cadena vacía", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/upstream.test.ts`
Expected: FAIL, no resuelve `../scripts/upstream.js`.

- [ ] **Step 3: Implementar `scripts/upstream.ts`**

```ts
import { createHash } from "node:crypto";

/** Solo cuentan los tags de versión publicada: `v1.9` o `v1.9.2`. */
const RELEASE_TAG = /^v(\d+)\.(\d+)(?:\.(\d+))?$/;

/**
 * Devuelve el tag mayor por orden numérico. Descarta el legado (`OT_*`,
 * `Version_*`) y las candidatas (`v1.9_RC`), que un orden textual colocaría
 * por delante del release definitivo.
 */
export function selectLatestTag(tagNames: string[]): string {
  const ordered = tagNames
    .map((tag) => ({ tag, parts: RELEASE_TAG.exec(tag) }))
    .filter(
      (entry): entry is { tag: string; parts: RegExpExecArray } =>
        entry.parts !== null,
    )
    .map(({ tag, parts }) => ({
      tag,
      key: [Number(parts[1]), Number(parts[2]), Number(parts[3] ?? 0)] as const,
    }))
    .sort((a, b) => {
      for (let index = 0; index < 3; index += 1) {
        const difference = (a.key[index] ?? 0) - (b.key[index] ?? 0);
        if (difference !== 0) {
          return difference;
        }
      }
      return 0;
    });

  const latest = ordered.at(-1);
  if (!latest) {
    throw new Error("No se encontró ningún tag de versión publicada.");
  }

  return latest.tag;
}

/**
 * Convierte `v1.9` en `1.9.0` para poder usarlo como versión de npm.
 */
export function normalizeTagVersion(tag: string): string {
  const parts = RELEASE_TAG.exec(tag);
  if (!parts) {
    throw new Error(`El tag ${tag} no es una versión publicada.`);
  }

  return `${parts[1]}.${parts[2]}.${parts[3] ?? 0}`;
}

export interface AutoscriptConstants {
  readonly version: string;
  readonly versionCode: number;
  readonly protocolVersion: number;
}

/**
 * Lee las tres constantes que AutoScript declara en su propio código. Es la
 * única forma fiable de saber qué versión trae un fichero concreto.
 */
export function parseAutoscriptConstants(source: string): AutoscriptConstants {
  const version = /var\s+VERSION\s*=\s*"([^"]+)"/.exec(source);
  const versionCode = /var\s+VERSION_CODE\s*=\s*(\d+)/.exec(source);
  const protocolVersion = /var\s+PROTOCOL_VERSION\s*=\s*(\d+)/.exec(source);

  if (!version) {
    throw new Error("No se encontró la constante VERSION.");
  }
  if (!versionCode) {
    throw new Error("No se encontró la constante VERSION_CODE.");
  }
  if (!protocolVersion) {
    throw new Error("No se encontró la constante PROTOCOL_VERSION.");
  }

  return {
    version: version[1] as string,
    versionCode: Number(versionCode[1]),
    protocolVersion: Number(protocolVersion[1]),
  };
}

/**
 * Huella del contenido descargado, en minúsculas.
 */
export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
```

- [ ] **Step 4: Añadir `scripts` al typecheck**

En `tsconfig.json`, cambiar `"include": ["src", "tests", "tsup.config.ts", "vitest.config.ts"]` por `"include": ["src", "tests", "scripts", "tsup.config.ts", "vitest.config.ts"]`.

- [ ] **Step 5: Verificar**

Run: `npx vitest run tests/upstream.test.ts && npm run typecheck && npx prettier --check .`
Expected: 10 pruebas en verde, typecheck limpio, formato correcto.

- [ ] **Step 6: Commit**

```bash
git add scripts/upstream.ts tests/upstream.test.ts tsconfig.json
git commit -m "Add upstream tag and constant helpers"
```

---

### Task 2: Fichero de pin y descarga verificada

**Files:**

- Create: `autoscript.lock.json`
- Create: `scripts/vendor-autoscript.ts`
- Create: `tests/vendor.test.ts`
- Modify: `package.json` (scripts, `files`, `exports`)
- Modify: `.gitignore` (añadir `vendor/`)

**Interfaces:**

- Consumes: `parseAutoscriptConstants`, `sha256Hex` de `scripts/upstream.js`.
- Produces: `readLock(path: string): Promise<UpstreamLock>`; `verifyOrDownload(lock: UpstreamLock, destination: string, fetchImpl?: typeof fetch): Promise<"cached" | "downloaded">`; tipo `UpstreamLock`.

- [ ] **Step 1: Crear el pin**

Crear `autoscript.lock.json` con el contenido exacto:

```json
{
  "repo": "ctt-gob-es/clienteafirma",
  "tag": "v1.9.2",
  "commit": "b4fe147",
  "path": "afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js",
  "sha256": "567998128f1cd8017c304a8c187f6912a0c56b0feebb02fffa2aa33732e40439",
  "autoscript": {
    "version": "1.9.0",
    "versionCode": 3,
    "protocolVersion": 4
  }
}
```

Antes de continuar, sustituir `b4fe147` por el sha completo que devuelva:

```bash
gh api repos/ctt-gob-es/clienteafirma/commits/v1.9.2 --jq .sha
```

- [ ] **Step 2: Escribir la prueba que falla**

Crear `tests/vendor.test.ts`:

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../scripts/upstream.js";
import {
  verifyOrDownload,
  type UpstreamLock,
} from "../scripts/vendor-autoscript.js";

const CONTENT = 'var VERSION = "1.9.0";\n';

function lockFor(content: string): UpstreamLock {
  return {
    repo: "ctt-gob-es/clienteafirma",
    tag: "v1.9.2",
    commit: "0".repeat(40),
    path: "afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js",
    sha256: sha256Hex(new TextEncoder().encode(content)),
    autoscript: { version: "1.9.0", versionCode: 3, protocolVersion: 4 },
  };
}

describe("verifyOrDownload", () => {
  it("descarga cuando no existe la copia local", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const fake = async () => new Response(CONTENT, { status: 200 });

    const outcome = await verifyOrDownload(lockFor(CONTENT), destination, fake);

    expect(outcome).toBe("downloaded");
    expect(await readFile(destination, "utf8")).toBe(CONTENT);
  });

  it("no descarga si la copia local ya coincide", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    await writeFile(destination, CONTENT);
    const fail = async () => {
      throw new Error("no debería descargar");
    };

    expect(await verifyOrDownload(lockFor(CONTENT), destination, fail)).toBe(
      "cached",
    );
  });

  it("aborta cuando la huella no coincide", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const fake = async () =>
      new Response("contenido manipulado", { status: 200 });

    await expect(
      verifyOrDownload(lockFor(CONTENT), destination, fake),
    ).rejects.toThrow(/sha256/i);
  });

  it("aborta cuando la descarga falla", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vendor-"));
    const destination = join(directory, "autoscript.js");
    const fake = async () => new Response("", { status: 404 });

    await expect(
      verifyOrDownload(lockFor(CONTENT), destination, fake),
    ).rejects.toThrow(/404/);
  });
});
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/vendor.test.ts`
Expected: FAIL, no resuelve `../scripts/vendor-autoscript.js`.

- [ ] **Step 4: Implementar `scripts/vendor-autoscript.ts`**

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAutoscriptConstants, sha256Hex } from "./upstream.js";

export interface UpstreamLock {
  readonly repo: string;
  readonly tag: string;
  readonly commit: string;
  readonly path: string;
  readonly sha256: string;
  readonly autoscript: {
    readonly version: string;
    readonly versionCode: number;
    readonly protocolVersion: number;
  };
}

/**
 * URL inmutable: se fija por commit, no por rama ni por tag, que pueden moverse.
 */
export function rawUrlFor(lock: UpstreamLock): string {
  return `https://raw.githubusercontent.com/${lock.repo}/${lock.commit}/${lock.path}`;
}

/**
 * Lee el pin versionado.
 */
export async function readLock(path: string): Promise<UpstreamLock> {
  return JSON.parse(await readFile(path, "utf8")) as UpstreamLock;
}

/**
 * Deja en `destination` el AutoScript fijado. No usa la red si la copia local
 * ya coincide con la huella del pin. Aborta si lo descargado no coincide.
 */
export async function verifyOrDownload(
  lock: UpstreamLock,
  destination: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"cached" | "downloaded"> {
  const cached = await readFile(destination).catch(() => undefined);
  if (cached && sha256Hex(cached) === lock.sha256) {
    return "cached";
  }

  const response = await fetchImpl(rawUrlFor(lock));
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar AutoScript: HTTP ${response.status} en ${rawUrlFor(lock)}`,
    );
  }

  const downloaded = new Uint8Array(await response.arrayBuffer());
  const digest = sha256Hex(downloaded);
  if (digest !== lock.sha256) {
    throw new Error(
      `El sha256 no coincide con el pin: esperado ${lock.sha256}, obtenido ${digest}`,
    );
  }

  const source = new TextDecoder().decode(downloaded);
  const constants = parseAutoscriptConstants(source);
  if (constants.version !== lock.autoscript.version) {
    throw new Error(
      `El fichero declara VERSION ${constants.version} y el pin dice ${lock.autoscript.version}`,
    );
  }

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, downloaded);
  return "downloaded";
}

/**
 * Punto de entrada del script. Se invoca desde `prepack` y desde `npm run vendor`.
 */
async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const lock = await readLock(join(root, "autoscript.lock.json"));
  const destination = join(root, "vendor", "autoscript.js");
  const outcome = await verifyOrDownload(lock, destination);
  console.log(
    `AutoScript ${lock.autoscript.version} (${lock.tag}) ${outcome === "cached" ? "ya estaba en" : "descargado en"} vendor/autoscript.js`,
  );
}

if (process.argv[1]?.endsWith("vendor-autoscript.ts")) {
  await main();
}
```

Esa guarda es lo que permite que la prueba importe el módulo sin lanzar la
descarga: bajo Vitest, `process.argv[1]` apunta al binario de Vitest.

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/vendor.test.ts`
Expected: PASS, 4 pruebas.

- [ ] **Step 6: Cablear el empaquetado**

En `package.json`:

- Añadir a `scripts`: `"vendor": "node scripts/vendor-autoscript.ts"`.
- Cambiar `"prepack": "npm run build"` por `"prepack": "npm run vendor && npm run build"`.
- Añadir `"vendor"` al array `files`.
- Añadir a `exports`: `"./autoscript.js": "./vendor/autoscript.js"`.

En `.gitignore`, añadir la línea `vendor/`.

- [ ] **Step 7: Comprobar el empaquetado real**

Run: `npm run vendor && shasum -a 256 vendor/autoscript.js && npm pack --dry-run 2>&1 | grep vendor`
Expected: la huella coincide con la del pin y el tarball incluye `vendor/autoscript.js`.

- [ ] **Step 8: Commit**

```bash
git add autoscript.lock.json scripts/vendor-autoscript.ts tests/vendor.test.ts package.json .gitignore
git commit -m "Pin and package the official AutoScript"
```

---

### Task 3: Cargador de AutoScript

**Files:**

- Create: `src/loader.ts`
- Create: `tests/loader.test.ts`
- Modify: `src/index.ts`

**Interfaces:**

- Produces: `loadAutoScript(url: string, options?: LoadOptions): Promise<AutoScriptApi>`; `interface LoadOptions { readonly document?: Document; readonly timeoutMs?: number }`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/loader.test.ts`. La prueba no necesita jsdom: inyecta un documento mínimo.

```ts
import { describe, expect, it } from "vitest";
import { loadAutoScript } from "../src/loader.js";
import type { AutoScriptApi } from "../src/types.js";

interface FakeScript {
  src: string;
  async: boolean;
  onload?: () => void;
  onerror?: () => void;
}

function fakeDocument(onAppend: (script: FakeScript) => void): Document {
  const script: FakeScript = { src: "", async: false };
  return {
    createElement: () => script,
    head: { appendChild: () => onAppend(script) },
  } as unknown as Document;
}

const api = { sign: () => undefined } as unknown as AutoScriptApi;

describe("loadAutoScript", () => {
  it("resuelve con el global cuando el script carga", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => {
      globalThis.window.AutoScript = api;
      script.onload?.();
    });

    await expect(loadAutoScript("/autoscript.js", { document })).resolves.toBe(
      api,
    );
  });

  it("rechaza cuando el script carga pero no define el global", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => script.onload?.());

    await expect(
      loadAutoScript("/autoscript.js", { document }),
    ).rejects.toThrow(/no definió/i);
  });

  it("rechaza cuando la descarga falla", async () => {
    globalThis.window = { AutoScript: undefined } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument((script) => script.onerror?.());

    await expect(
      loadAutoScript("/autoscript.js", { document }),
    ).rejects.toThrow(/no se pudo cargar/i);
  });

  it("devuelve el global sin volver a insertar el script", async () => {
    globalThis.window = { AutoScript: api } as unknown as Window &
      typeof globalThis;
    const document = fakeDocument(() => {
      throw new Error("no debería insertar nada");
    });

    await expect(loadAutoScript("/autoscript.js", { document })).resolves.toBe(
      api,
    );
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/loader.test.ts`
Expected: FAIL, no resuelve `../src/loader.js`.

- [ ] **Step 3: Implementar `src/loader.ts`**

```ts
import { AutoFirmaError } from "./errors.js";
import type { AutoScriptApi } from "./types.js";

/**
 * Opciones del cargador. `document` existe para poder probarlo sin navegador.
 */
export interface LoadOptions {
  readonly document?: Document;
}

/**
 * Inserta `autoscript.js` como script clásico y resuelve con el objeto global.
 *
 * AutoScript no es un módulo: no declara UMD, no exporta nada y confía en que
 * su `var` de nivel superior se convierta en global. Importarlo con un
 * empaquetador lo deja en ámbito de módulo y el global nunca aparece, así que
 * la única forma correcta de cargarlo es una etiqueta `script`.
 */
export function loadAutoScript(
  url: string,
  options: LoadOptions = {},
): Promise<AutoScriptApi> {
  const existing = globalThis.window?.AutoScript;
  if (existing) {
    return Promise.resolve(existing);
  }

  const target = options.document ?? globalThis.document;
  if (!target) {
    return Promise.reject(
      new AutoFirmaError(
        "No hay documento donde insertar AutoScript.",
        "AUTOSCRIPT_UNAVAILABLE",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const script = target.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const loaded = globalThis.window?.AutoScript;
      if (loaded) {
        resolve(loaded);
        return;
      }
      reject(
        new AutoFirmaError(
          `${url} se cargó pero no definió el objeto global AutoScript.`,
          "AUTOSCRIPT_UNAVAILABLE",
        ),
      );
    };
    script.onerror = () => {
      reject(
        new AutoFirmaError(
          `No se pudo cargar ${url}.`,
          "AUTOSCRIPT_UNAVAILABLE",
        ),
      );
    };
    target.head.appendChild(script);
  });
}
```

- [ ] **Step 4: Exportarlo**

En `src/index.ts`, añadir tras la primera línea:

```ts
export { loadAutoScript } from "./loader.js";
export type { LoadOptions } from "./loader.js";
```

- [ ] **Step 5: Verificar**

Run: `npx vitest run tests/loader.test.ts && npm run typecheck`
Expected: 4 pruebas en verde y typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add src/loader.ts src/index.ts tests/loader.test.ts
git commit -m "Add classic script loader for AutoScript"
```

---

### Task 4: Tres operaciones nuevas

**Files:**

- Modify: `src/types.ts`
- Modify: `src/client.ts`
- Modify: `src/testing/index.ts`
- Modify: `tests/client.test.ts`

**Interfaces:**

- Produces: en `SignatureClient` y `AutoFirmaClient`: `isNativeAppInstalled(): Promise<boolean>`; `saveDataToFile(options: SaveOptions): Promise<void>`; `checkTime(options?: CheckTimeOptions): Promise<void>`. Tipos nuevos `SaveOptions` y `CheckTimeOptions`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/client.test.ts`:

```ts
describe("operaciones auxiliares", () => {
  it("consulta si AutoFirma está instalada", async () => {
    const autoScript = {
      sign: () => undefined,
      needNativeAppInstalled: (success: (installed: boolean) => void) =>
        success(true),
    } as unknown as AutoScriptApi;

    await expect(
      new AutoFirmaClient({ autoScript }).isNativeAppInstalled(),
    ).resolves.toBe(true);
  });

  it("guarda datos delegando en AutoScript", async () => {
    const calls: string[] = [];
    const autoScript = {
      sign: () => undefined,
      saveDataToFile: (
        data: string,
        title: string,
        filename: string,
        extension: string,
        description: string,
        success: () => void,
      ) => {
        calls.push(data, title, filename, extension, description);
        success();
      },
    } as unknown as AutoScriptApi;

    await new AutoFirmaClient({ autoScript }).saveDataToFile({
      data: "ZGF0b3M=",
      title: "Guardar firma",
      filename: "firma.csig",
      extension: "csig",
      description: "Firma CAdES",
    });

    expect(calls).toEqual([
      "ZGF0b3M=",
      "Guardar firma",
      "firma.csig",
      "csig",
      "Firma CAdES",
    ]);
  });

  it("rechaza cuando la versión fijada no expone la operación", async () => {
    const autoScript = { sign: () => undefined } as unknown as AutoScriptApi;

    await expect(
      new AutoFirmaClient({ autoScript }).checkTime(),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
  });

  it("comprueba la hora con los valores por defecto", async () => {
    const received: unknown[] = [];
    const autoScript = {
      sign: () => undefined,
      checkTime: (checkType: string, maxMillis: number) => {
        received.push(checkType, maxMillis);
      },
    } as unknown as AutoScriptApi;

    await new AutoFirmaClient({ autoScript }).checkTime();

    expect(received).toEqual(["CHECKTIME_RECOMMENDED", 60000]);
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/client.test.ts`
Expected: FAIL, `isNativeAppInstalled` no es una función.

- [ ] **Step 3: Ampliar `src/types.ts`**

Añadir a `AutoScriptApi`:

```ts
  needNativeAppInstalled?: (success: (installed: boolean) => void) => void;
  saveDataToFile?: (
    data: string,
    title: string,
    filename: string,
    extension: string,
    description: string,
    success: () => void,
    failure: NativeFailureCallback,
  ) => void;
  checkTime?: (
    checkType: string,
    maxMillis: number,
    checkUrl?: string,
  ) => void;
```

Añadir los tipos públicos:

```ts
/**
 * Opciones para guardar datos mediante AutoFirma.
 */
export interface SaveOptions {
  readonly data: string;
  readonly title: string;
  readonly filename: string;
  readonly extension: string;
  readonly description: string;
}

/**
 * Opciones de comprobación de hora. Los valores admitidos por AutoScript son
 * `CHECKTIME_NO`, `CHECKTIME_RECOMMENDED` y `CHECKTIME_OBLIGATORY`.
 */
export interface CheckTimeOptions {
  readonly checkType?:
    "CHECKTIME_NO" | "CHECKTIME_RECOMMENDED" | "CHECKTIME_OBLIGATORY";
  readonly maxMillis?: number;
  readonly checkUrl?: string;
}
```

Y a `SignatureClient`:

```ts
  isNativeAppInstalled(): Promise<boolean>;
  saveDataToFile(options: SaveOptions): Promise<void>;
  checkTime(options?: CheckTimeOptions): Promise<void>;
```

- [ ] **Step 4: Implementar en `src/client.ts`**

Añadir los métodos tras `selectCertificate`:

```ts
  /**
   * Indica si AutoFirma está instalada en el equipo.
   */
  public isNativeAppInstalled(): Promise<boolean> {
    const operation = this.autoScript.needNativeAppInstalled;
    if (!operation) {
      return this.unsupported("needNativeAppInstalled");
    }

    return new Promise((resolve) => {
      operation((installed) => resolve(installed));
    });
  }

  /**
   * Pide a AutoFirma que guarde datos en un fichero elegido por la persona
   * usuaria.
   */
  public saveDataToFile(options: SaveOptions): Promise<void> {
    const operation = this.autoScript.saveDataToFile;
    if (!operation) {
      return this.unsupported("saveDataToFile");
    }

    return new Promise((resolve, reject) => {
      operation(
        options.data,
        options.title,
        options.filename,
        options.extension,
        options.description,
        () => resolve(),
        (type, message) => reject(fromNativeError(type, message)),
      );
    });
  }

  /**
   * Comprueba la sincronía del reloj del equipo.
   */
  public checkTime(options: CheckTimeOptions = {}): Promise<void> {
    const operation = this.autoScript.checkTime;
    if (!operation) {
      return this.unsupported("checkTime");
    }

    operation(
      options.checkType ?? "CHECKTIME_RECOMMENDED",
      options.maxMillis ?? 60000,
      options.checkUrl,
    );
    return Promise.resolve();
  }

  /**
   * Rechazo homogéneo para operaciones ausentes en la versión fijada.
   */
  private unsupported<T>(name: string): Promise<T> {
    return Promise.reject(
      new AutoFirmaError(
        `Esta versión de AutoScript no expone ${name}.`,
        "UNSUPPORTED_OPERATION",
      ),
    );
  }
```

Añadir `CheckTimeOptions` y `SaveOptions` al `import type` de `./types.js`.

- [ ] **Step 5: Completar el doble de pruebas**

En `src/testing/index.ts`, añadir a `MockAutoFirmaClient`:

```ts
  public readonly saved: SaveOptions[] = [];
  public installed = true;

  public async isNativeAppInstalled(): Promise<boolean> {
    return this.installed;
  }

  public async saveDataToFile(options: SaveOptions): Promise<void> {
    this.saved.push(options);
  }

  public async checkTime(_options: CheckTimeOptions = {}): Promise<void> {
    return undefined;
  }
```

Importar `CheckTimeOptions` y `SaveOptions` desde `../types.js`.

- [ ] **Step 6: Exportar los tipos**

En `src/index.ts`, añadir `CheckTimeOptions` y `SaveOptions` al bloque `export type`.

- [ ] **Step 7: Verificar**

Run: `npm run typecheck && npm test`
Expected: todas las pruebas en verde y cobertura por encima de los umbrales.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "Wrap native app detection, file saving and time check"
```

---

### Task 5: Vigilante upstream

**Files:**

- Create: `scripts/check-upstream.ts`
- Create: `.github/workflows/upstream.yml`
- Create: `tests/check-upstream.test.ts`

**Interfaces:**

- Consumes: `selectLatestTag`, `parseAutoscriptConstants`, `sha256Hex` de `scripts/upstream.js`; `readLock`, tipo `UpstreamLock` de `scripts/vendor-autoscript.js`.
- Produces: `buildUpdatedLock(current: UpstreamLock, tag: string, commit: string, source: string): UpstreamLock`; `describeChange(previous: UpstreamLock, next: UpstreamLock): string`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/check-upstream.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildUpdatedLock, describeChange } from "../scripts/check-upstream.js";
import type { UpstreamLock } from "../scripts/vendor-autoscript.js";

const current: UpstreamLock = {
  repo: "ctt-gob-es/clienteafirma",
  tag: "v1.9.2",
  commit: "a".repeat(40),
  path: "afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js",
  sha256: "0".repeat(64),
  autoscript: { version: "1.9.0", versionCode: 3, protocolVersion: 4 },
};

const source = [
  'var VERSION = "1.10.1";',
  "var VERSION_CODE = 4;",
  "var PROTOCOL_VERSION = 4;",
].join("\n");

describe("buildUpdatedLock", () => {
  it("conserva repositorio y ruta, y actualiza el resto", () => {
    const next = buildUpdatedLock(current, "v1.10", "b".repeat(40), source);

    expect(next.repo).toBe(current.repo);
    expect(next.path).toBe(current.path);
    expect(next.tag).toBe("v1.10");
    expect(next.commit).toBe("b".repeat(40));
    expect(next.autoscript).toEqual({
      version: "1.10.1",
      versionCode: 4,
      protocolVersion: 4,
    });
    expect(next.sha256).toHaveLength(64);
  });
});

describe("describeChange", () => {
  it("resume el salto de versión y de tag", () => {
    const next = buildUpdatedLock(current, "v1.10", "b".repeat(40), source);
    const summary = describeChange(current, next);

    expect(summary).toContain("v1.9.2");
    expect(summary).toContain("v1.10");
    expect(summary).toContain("1.9.0");
    expect(summary).toContain("1.10.1");
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/check-upstream.test.ts`
Expected: FAIL, no resuelve `../scripts/check-upstream.js`.

- [ ] **Step 3: Implementar `scripts/check-upstream.ts`**

```ts
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAutoscriptConstants,
  selectLatestTag,
  sha256Hex,
} from "./upstream.js";
import { readLock, type UpstreamLock } from "./vendor-autoscript.js";

/**
 * Construye el pin nuevo leyendo las constantes del fichero descargado.
 */
export function buildUpdatedLock(
  current: UpstreamLock,
  tag: string,
  commit: string,
  source: string,
): UpstreamLock {
  return {
    repo: current.repo,
    tag,
    commit,
    path: current.path,
    sha256: sha256Hex(new TextEncoder().encode(source)),
    autoscript: parseAutoscriptConstants(source),
  };
}

/**
 * Resumen legible para el cuerpo del pull request.
 */
export function describeChange(
  previous: UpstreamLock,
  next: UpstreamLock,
): string {
  return [
    `Tag: ${previous.tag} → ${next.tag}`,
    `AutoScript VERSION: ${previous.autoscript.version} → ${next.autoscript.version}`,
    `VERSION_CODE: ${previous.autoscript.versionCode} → ${next.autoscript.versionCode}`,
    `PROTOCOL_VERSION: ${previous.autoscript.protocolVersion} → ${next.autoscript.protocolVersion}`,
    `sha256: ${next.sha256}`,
    `Commit: ${next.commit}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const lockPath = join(root, "autoscript.lock.json");
  const current = await readLock(lockPath);

  const tagsResponse = await fetch(
    `https://api.github.com/repos/${current.repo}/tags?per_page=100`,
  );
  if (!tagsResponse.ok) {
    throw new Error(
      `No se pudieron listar los tags: HTTP ${tagsResponse.status}`,
    );
  }

  const tags = (await tagsResponse.json()) as {
    name: string;
    commit: { sha: string };
  }[];
  const latest = selectLatestTag(tags.map((entry) => entry.name));
  const commit = tags.find((entry) => entry.name === latest)?.commit.sha;
  if (!commit) {
    throw new Error(`No se encontró el commit del tag ${latest}`);
  }

  const fileResponse = await fetch(
    `https://raw.githubusercontent.com/${current.repo}/${commit}/${current.path}`,
  );
  if (!fileResponse.ok) {
    throw new Error(
      `No se pudo descargar el fichero: HTTP ${fileResponse.status}`,
    );
  }

  const source = await fileResponse.text();
  const next = buildUpdatedLock(current, latest, commit, source);

  if (next.sha256 === current.sha256 && next.tag === current.tag) {
    console.log("Sin cambios respecto al pin actual.");
    return;
  }

  await writeFile(lockPath, `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(
    join(root, "upstream-change.txt"),
    `${describeChange(current, next)}\n`,
  );
  console.log(describeChange(current, next));
}

if (process.argv[1]?.endsWith("check-upstream.ts")) {
  await main();
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run tests/check-upstream.test.ts`
Expected: PASS, 2 pruebas.

- [ ] **Step 5: Crear el workflow**

Crear `.github/workflows/upstream.yml`:

```yaml
name: AutoScript upstream

on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - id: check
        run: node scripts/check-upstream.ts
      - name: Abrir pull request
        if: hashFiles('upstream-change.txt') != ''
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          BRANCH="upstream/$(node -p "require('./autoscript.lock.json').tag")"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout -b "${BRANCH}"
          git add autoscript.lock.json
          git commit -m "Update pinned AutoScript to $(node -p "require('./autoscript.lock.json').tag")"
          git push -u origin "${BRANCH}"
          gh pr create \
            --title "Actualizar AutoScript fijado a $(node -p "require('./autoscript.lock.json').tag")" \
            --body-file upstream-change.txt
```

Nota para quien revise el pull request: nace sin comprobaciones porque un push
con el `GITHUB_TOKEN` por defecto no dispara los workflows. Hay que lanzarlas a
mano desde la pestaña Actions antes de mezclar.

- [ ] **Step 6: Probar el script contra el repositorio real**

Run: `node scripts/check-upstream.ts`
Expected: imprime «Sin cambios respecto al pin actual.» y no modifica el lock. Comprobar con `git status --short` que no hay cambios.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-upstream.ts tests/check-upstream.test.ts .github/workflows/upstream.yml
git commit -m "Watch upstream releases and open a pull request on change"
```

---

## Fase B — Demo y web (tareas 6 a 8)

### Task 6: Lectura del certificado firmante

**Files:**

- Create: `web/certificate.ts`
- Create: `tests/certificate.test.ts`
- Create: `tests/fixtures/certificate.pem` (generado)

**Interfaces:**

- Produces: `readCertificate(derBase64: string): CertificateSummary` con `interface CertificateSummary { readonly subject: string; readonly issuer: string; readonly serialNumber: string; readonly notBefore: Date; readonly notAfter: Date }`.

Este parser vive en `web/` y nunca en `src/`: la librería no incorpora lectura de certificados.

- [ ] **Step 1: Generar el certificado de prueba**

```bash
mkdir -p tests/fixtures
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout /dev/null -out tests/fixtures/certificate.pem \
  -subj "/C=ES/O=Ejemplo SL/CN=NOMBRE EJEMPLO EJEMPLO - 00000000T"
openssl x509 -in tests/fixtures/certificate.pem -noout -subject -issuer -serial -dates
```

Anotar los valores impresos: son los que la prueba debe esperar.

- [ ] **Step 2: Escribir la prueba que falla**

Crear `tests/certificate.test.ts`, sustituyendo los valores por los del paso anterior:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCertificate } from "../web/certificate.js";

const pem = readFileSync("tests/fixtures/certificate.pem", "utf8");
const derBase64 = pem
  .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
  .replace(/\s+/g, "");

describe("readCertificate", () => {
  it("lee el titular", () => {
    expect(readCertificate(derBase64).subject).toContain(
      "NOMBRE EJEMPLO EJEMPLO - 00000000T",
    );
  });

  it("lee la emisora", () => {
    expect(readCertificate(derBase64).issuer).toContain("Ejemplo SL");
  });

  it("lee la vigencia", () => {
    const summary = readCertificate(derBase64);
    expect(summary.notBefore.getTime()).toBeLessThan(
      summary.notAfter.getTime(),
    );
  });

  it("lee el número de serie en hexadecimal", () => {
    expect(readCertificate(derBase64).serialNumber).toMatch(/^[0-9a-f]+$/);
  });

  it("rechaza una entrada que no es un certificado", () => {
    expect(() => readCertificate("bm8gZXMgdW4gY2VydGlmaWNhZG8=")).toThrow(
      /certificado/i,
    );
  });
});
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/certificate.test.ts`
Expected: FAIL, no resuelve `../web/certificate.js`.

- [ ] **Step 4: Implementar el lector DER**

Crear `web/certificate.ts`. Recorrer la estructura ASN.1 mínima: `Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }` y dentro de `tbsCertificate` leer `serialNumber`, `issuer`, `validity` y `subject`, saltando `version` cuando aparezca la etiqueta `[0]` (`0xa0`).

```ts
/**
 * Resumen del certificado que ha devuelto AutoFirma. No valida nada: describe.
 */
export interface CertificateSummary {
  readonly subject: string;
  readonly issuer: string;
  readonly serialNumber: string;
  readonly notBefore: Date;
  readonly notAfter: Date;
}

interface Element {
  readonly tag: number;
  readonly content: Uint8Array;
  readonly end: number;
}

/**
 * Lee un elemento DER en la posición indicada.
 */
function readElement(data: Uint8Array, offset: number): Element {
  const tag = data[offset];
  if (tag === undefined) {
    throw new Error("Estructura de certificado incompleta.");
  }

  let cursor = offset + 1;
  const first = data[cursor];
  if (first === undefined) {
    throw new Error("Estructura de certificado incompleta.");
  }
  cursor += 1;

  let length = first;
  if (first > 0x80) {
    const bytes = first & 0x7f;
    length = 0;
    for (let index = 0; index < bytes; index += 1) {
      length = length * 256 + (data[cursor] ?? 0);
      cursor += 1;
    }
  }

  return {
    tag,
    content: data.subarray(cursor, cursor + length),
    end: cursor + length,
  };
}

/**
 * Convierte un nombre distinguido en texto legible, de la parte más específica
 * a la más general.
 */
function readName(data: Uint8Array): string {
  const parts: string[] = [];
  let offset = 0;
  while (offset < data.length) {
    const rdn = readElement(data, offset);
    const attribute = readElement(rdn.content, 0);
    const type = readElement(attribute.content, 0);
    const value = readElement(attribute.content, type.end);
    parts.push(new TextDecoder().decode(value.content));
    offset = rdn.end;
  }
  return parts.reverse().join(", ");
}

/**
 * Interpreta UTCTime (`YYMMDDHHMMSSZ`) y GeneralizedTime (`YYYYMMDDHHMMSSZ`).
 */
function readTime(element: Element): Date {
  const text = new TextDecoder().decode(element.content);
  const long = element.tag === 0x18;
  const year = long
    ? Number(text.slice(0, 4))
    : 2000 + Number(text.slice(0, 2));
  const rest = long ? text.slice(4) : text.slice(2);
  const month = Number(rest.slice(0, 2)) - 1;
  const day = Number(rest.slice(2, 4));
  const hour = Number(rest.slice(4, 6));
  const minute = Number(rest.slice(6, 8));
  const second = Number(rest.slice(8, 10));
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Lee los datos descriptivos del certificado en formato DER codificado en
 * base64, tal y como lo devuelve AutoScript.
 */
export function readCertificate(derBase64: string): CertificateSummary {
  const binary = atob(derBase64);
  const der = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  const certificate = readElement(der, 0);
  if (certificate.tag !== 0x30) {
    throw new Error("El contenido no es un certificado X.509.");
  }

  const tbs = readElement(certificate.content, 0);
  if (tbs.tag !== 0x30) {
    throw new Error("El contenido no es un certificado X.509.");
  }

  let offset = 0;
  const first = readElement(tbs.content, offset);
  if (first.tag === 0xa0) {
    offset = first.end;
  }

  const serial = readElement(tbs.content, offset);
  const algorithm = readElement(tbs.content, serial.end);
  const issuer = readElement(tbs.content, algorithm.end);
  const validity = readElement(tbs.content, issuer.end);
  const subject = readElement(tbs.content, validity.end);

  const notBefore = readElement(validity.content, 0);
  const notAfter = readElement(validity.content, notBefore.end);

  return {
    subject: readName(subject.content),
    issuer: readName(issuer.content),
    serialNumber: Array.from(serial.content)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .replace(/^0+/, ""),
    notBefore: readTime(notBefore),
    notAfter: readTime(notAfter),
  };
}
```

- [ ] **Step 5: Ejecutar y ajustar hasta verde**

Run: `npx vitest run tests/certificate.test.ts`
Expected: PASS, 5 pruebas. Si falla el recorrido, comparar con `openssl asn1parse -in tests/fixtures/certificate.pem` para localizar el elemento que se está leyendo mal.

- [ ] **Step 6: Excluir `web/` de la cobertura de la librería**

En `vitest.config.ts`, la clave `coverage.include` ya limita el cálculo a `src/**/*.ts`, así que no hay que tocar nada. Confirmarlo ejecutando `npm test` y comprobando que los umbrales siguen cumpliéndose.

- [ ] **Step 7: Commit**

```bash
git add web/certificate.ts tests/certificate.test.ts tests/fixtures/certificate.pem
git commit -m "Read signer certificate details for the demo"
```

---

### Task 7: Página única con demo

**Files:**

- Create: `web/index.html`
- Create: `web/styles.css`
- Create: `web/demo.ts`
- Create: `tsup.web.config.ts`
- Modify: `package.json` (script `build:web`)
- Modify: `tsconfig.json` (añadir `"web"` y `"tsup.web.config.ts"` a `include`)

**Interfaces:**

- Consumes: `AutoFirmaClient`, `loadAutoScript` de `src/index.js`; `readCertificate` de `web/certificate.js`.

- [ ] **Step 1: Escribir la página**

Crear `web/index.html` con una sola columna: título, un párrafo de qué es, la demo, la instalación, la tabla de la API y el enlace al repositorio. La demo necesita estos identificadores: `#status`, `#file`, `#format`, `#sign`, `#result`, `#certificate`, `#download`.

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>@erseco/autofirma-client</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>@erseco/autofirma-client</h1>
      <p>
        Cliente TypeScript sobre AutoScript, la API oficial de AutoFirma. Ni
        reimplementa criptografía ni valida firmas: adapta la API oficial a
        promesas tipadas.
      </p>

      <section id="demo">
        <h2>Pruébalo</h2>
        <p id="status">Comprobando si AutoFirma está instalada…</p>
        <input type="file" id="file" />
        <select id="format">
          <option value="PAdES">PAdES (PDF)</option>
          <option value="CAdES">CAdES</option>
          <option value="XAdES">XAdES</option>
        </select>
        <button id="sign" disabled>Firmar</button>
        <p id="result"></p>
        <dl id="certificate"></dl>
        <a id="download" hidden>Descargar la firma</a>
        <p>
          El fichero no sale de tu navegador: no hay ningún servidor detrás. Los
          datos que se muestran son los del certificado que ha devuelto
          AutoFirma, no una verificación de la firma: AutoScript no puede
          validar firmas, cadenas de confianza ni revocación.
        </p>
      </section>

      <section>
        <h2>Instalación</h2>
        <pre><code>npm install @erseco/autofirma-client</code></pre>
      </section>

      <script type="module" src="demo.js"></script>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Escribir la demo**

Crear `web/demo.ts`:

```ts
import { AutoFirmaClient, loadAutoScript } from "../src/index.js";
import type { SignatureFormat } from "../src/index.js";
import { readCertificate } from "./certificate.js";

const status = document.querySelector<HTMLParagraphElement>("#status");
const file = document.querySelector<HTMLInputElement>("#file");
const format = document.querySelector<HTMLSelectElement>("#format");
const signButton = document.querySelector<HTMLButtonElement>("#sign");
const result = document.querySelector<HTMLParagraphElement>("#result");
const certificate = document.querySelector<HTMLDListElement>("#certificate");
const download = document.querySelector<HTMLAnchorElement>("#download");

if (
  status &&
  file &&
  format &&
  signButton &&
  result &&
  certificate &&
  download
) {
  const autoScript = await loadAutoScript("autoscript.js");
  const client = new AutoFirmaClient({ autoScript });
  client.initialize();

  const installed = await client.isNativeAppInstalled().catch(() => false);
  status.textContent = installed
    ? "AutoFirma detectada. Elige un fichero y fírmalo."
    : "No se detecta AutoFirma. Instálala para poder firmar.";
  signButton.disabled = !installed;

  signButton.addEventListener("click", async () => {
    const selected = file.files?.[0];
    if (!selected) {
      result.textContent = "Elige un fichero primero.";
      return;
    }

    result.textContent = "Firmando…";
    certificate.replaceChildren();
    download.hidden = true;

    try {
      const signature = await client.sign({
        data: selected,
        format: format.value as SignatureFormat,
      });

      result.textContent = `Firma generada: ${signature.signature.length} caracteres en base64.`;

      if (signature.certificate) {
        const summary = readCertificate(signature.certificate);
        for (const [label, value] of [
          ["Titular", summary.subject],
          ["Emisora", summary.issuer],
          ["Número de serie", summary.serialNumber],
          ["Válido desde", summary.notBefore.toLocaleDateString("es-ES")],
          ["Válido hasta", summary.notAfter.toLocaleDateString("es-ES")],
        ]) {
          const term = document.createElement("dt");
          term.textContent = label;
          const definition = document.createElement("dd");
          definition.textContent = value;
          certificate.append(term, definition);
        }
      }

      download.href = `data:application/octet-stream;base64,${signature.signature}`;
      download.download = `${selected.name}.firma`;
      download.hidden = false;
    } catch (error) {
      result.textContent =
        error instanceof Error ? error.message : "No se pudo firmar.";
    }
  });
}
```

- [ ] **Step 3: Escribir el estilo**

Crear `web/styles.css`. Sin dependencias ni fuentes externas:

```css
:root {
  color-scheme: light dark;
  --fondo: #ffffff;
  --texto: #1a1a1a;
  --suave: #f4f4f5;
  --borde: #d4d4d8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #18181b;
    --texto: #f4f4f5;
    --suave: #27272a;
    --borde: #3f3f46;
  }
}

body {
  margin: 0;
  background: var(--fondo);
  color: var(--texto);
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;
  line-height: 1.6;
}

main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 3rem 1.25rem 6rem;
}

h1 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

#demo {
  background: var(--suave);
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  padding: 1.25rem;
}

#demo input,
#demo select,
#demo button {
  font: inherit;
  margin: 0.25rem 0.5rem 0.75rem 0;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--borde);
  border-radius: 0.375rem;
  background: var(--fondo);
  color: inherit;
}

#demo button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0.75rem 0;
}

dt {
  font-weight: 600;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

pre {
  background: var(--suave);
  border: 1px solid var(--borde);
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
}
```

- [ ] **Step 4: Añadir la construcción**

Crear `tsup.web.config.ts` aparte, porque invocar `tsup` con el fichero de
configuración de la librería presente arrastraría su `entry`, su `clean` y su
`target`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { demo: "web/demo.ts" },
  format: ["esm"],
  outDir: "site",
  target: "es2022",
  clean: true,
});
```

En `package.json`, añadir a `scripts`:

```json
"build:web": "npm run vendor && tsup --config tsup.web.config.ts && cp web/index.html web/styles.css vendor/autoscript.js site/"
```

- [ ] **Step 5: Comprobarlo en local**

Run: `npm run build:web && ls site && npx http-server site -p 8080`
Expected: `site/` contiene `demo.js`, `index.html`, `styles.css` y `autoscript.js`. Abrir `http://localhost:8080`, comprobar que el estado detecta AutoFirma y, con AutoFirma instalada, firmar un PDF de `docs/ejemplos/files/`.

- [ ] **Step 6: Commit**

```bash
git add web package.json
git commit -m "Add single page demo"
```

---

### Task 8: Retirar zensical

**Files:**

- Modify: `.github/workflows/docs.yml`
- Delete: `zensical.toml`
- Delete: `docs/index.md`, `docs/guia/`, `docs/ejemplos/index.md`, `docs/api/`, `docs/compatibilidad.md`, `docs/seguridad.md`
- Modify: `README.md`

Se conservan `docs/arquitectura/` y `docs/ejemplos/files/`.

- [ ] **Step 1: Reescribir el workflow**

Sustituir el contenido de `.github/workflows/docs.yml`:

```yaml
name: Documentation

on:
  push:
    branches: [main]
    paths:
      - "web/**"
      - "src/**"
      - "autoscript.lock.json"
      - ".github/workflows/docs.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build:web
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: site

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Publicar
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Borrar lo que ya no se genera**

```bash
git rm zensical.toml docs/index.md docs/compatibilidad.md docs/seguridad.md
git rm -r docs/guia docs/api
git rm docs/ejemplos/index.md
```

- [ ] **Step 3: Trasladar al README lo que se pierde**

En `README.md`, incorporar la instalación, el aviso de que AutoScript se sirve desde el paquete (`vendor/autoscript.js`) y no puede importarse como módulo, y el enlace a la página con la demo.

- [ ] **Step 4: Verificar**

Run: `npm run build:web && npx prettier --check .`
Expected: `site/` se genera sin Python y el formato es correcto.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Replace the documentation site with a single page"
```

---

## Fase C — Registros y publicación (tareas 9 y 10)

### Task 9: Decisiones de arquitectura

**Files:**

- Create: `docs/arquitectura/adr/ADR-0004-versionado-en-espejo.md`
- Create: `docs/arquitectura/adr/ADR-0005-empaquetar-autoscript.md`
- Create: `docs/arquitectura/adr/ADR-0006-web-de-pagina-unica.md`
- Modify: `docs/arquitectura/adr/ADR-0001-versionar-segun-autoscript.md` (solo `sustituido_por`)
- Modify: `docs/arquitectura/adr/ADR-0002-no-redistribuir-autoscript.md` (solo `sustituido_por`)
- Modify: `docs/arquitectura/adr/records.md`
- Modify: `docs/arquitectura/sdd/SDD-0002-seguimiento-upstream-y-demo.md` (estado `Implementado`)
- Modify: `AGENTS.md`

- [ ] **Step 1: Escribir los tres ADR**

Seguir `docs/arquitectura/adr/template.md`. Dejar `asistencia_ia` con las cadenas vacías del template.

ADR-0004, `sustituye: [ADR-0001]`: la versión publicada es la del tag mayor del repositorio oficial. Evidencia obligatoria en «Evidencias»: la constante interna no ordena, porque `v1.9.1` lleva 1.10.1 y `v1.9.2`, posterior, lleva 1.9.0. En «Consecuencias / Negativas»: entre tags oficiales no queda número libre para correcciones propias, y las tres alternativas están descartadas por npm (`1.9.2+1` se almacena como `1.9.2`, las preversiones ordenan por debajo y `1.9.2.1` no es semver).

ADR-0005, `sustituye: [ADR-0002]`: el repositorio git no contiene AutoScript, pero el tarball sí, verificado por `sha256`. En «Contexto», que la licencia upstream es GPL 2+ y EUPL 1.1 y la nuestra GPL-2.0-or-later, de modo que la decisión anterior era de política y no de licencia.

ADR-0006: la web es una página única sin generador; ADR y SDD se quedan como markdown en el repositorio.

- [ ] **Step 2: Marcar los ADR sustituidos**

En ADR-0001 y ADR-0002, rellenar únicamente el campo `sustituido_por` del frontmatter. No reescribir el cuerpo: `AGENTS.md` exige que los ADR aceptados se conserven como registro histórico.

- [ ] **Step 3: Actualizar índices y AGENTS.md**

Añadir las tres filas a `docs/arquitectura/adr/records.md` y cambiar el estado de SDD-0002 a `Implementado` en su frontmatter y en `docs/arquitectura/sdd/records.md`.

En `AGENTS.md`, reescribir la sección «Compatibilidad y versiones»: la versión ya no corresponde a la línea de AutoScript sino al tag mayor de AutoFirma, y el pin vive en `autoscript.lock.json`.

- [ ] **Step 4: Verificar y commit**

Run: `npx prettier --check .`

```bash
git add docs AGENTS.md
git commit -m "Record versioning, packaging and documentation decisions"
```

---

### Task 10: Publicación en espejo

**Files:**

- Modify: `.github/workflows/release.yml`
- Modify: `package.json` (`version`)

- [ ] **Step 1: Verificar el espejo en el release**

En `.github/workflows/release.yml`, sustituir el paso «Verificar versión» por:

```yaml
- name: Verificar versión y pin
  run: |
    PACKAGE_VERSION="$(node -p "require('./package.json').version")"
    LOCK_TAG="$(node -p "require('./autoscript.lock.json').tag")"
    test "v${PACKAGE_VERSION}" = "${GITHUB_REF_NAME}"
    test "v${PACKAGE_VERSION}" = "${LOCK_TAG}"
```

Y añadir, después de `npm pack`, la comprobación de que el tarball lleva el fichero verificado:

```yaml
- name: Verificar el contenido del tarball
  run: |
    TARBALL="$(ls artifacts/*.tgz)"
    tar -tzf "${TARBALL}" | grep -q "package/vendor/autoscript.js"
    tar -xzOf "${TARBALL}" package/vendor/autoscript.js | shasum -a 256 | cut -d" " -f1 > /tmp/packed.sha
    node -p "require('./autoscript.lock.json').sha256" > /tmp/pinned.sha
    diff /tmp/packed.sha /tmp/pinned.sha
```

- [ ] **Step 2: Poner la versión en espejo**

Cambiar `"version": "1.9.0"` por `"version": "1.9.2"` en `package.json`.

- [ ] **Step 3: Comprobar la cadena completa en local**

Run: `make check && npm pack --pack-destination /tmp && tar -tzf /tmp/erseco-autofirma-client-1.9.2.tgz | grep vendor`
Expected: todo en verde y el tarball incluye `package/vendor/autoscript.js`.

- [ ] **Step 4: Commit**

```bash
git add package.json .github/workflows/release.yml
git commit -m "Mirror the AutoFirma tag on release"
```

- [ ] **Step 5: Publicar (manual, fuera del plan)**

El tag lo crea la persona que publica, no el agente:

```bash
git tag v1.9.2
git push origin v1.9.2
```

---

## Orden y dependencias

- La fase A es autónoma y mezclable por sí sola: deja el pin, el empaquetado verificado y la vigilancia funcionando.
- La fase B depende de la tarea 2 (necesita `vendor/autoscript.js`) y de la tarea 3 (el cargador).
- La fase C se hace al final, cuando ya hay algo que registrar y publicar.
