---
id: SDD-0002
titulo: "Seguimiento del AutoScript oficial, empaquetado y demo pública"
estado: Borrador
fecha: 2026-07-31
adrs: [ADR-0004, ADR-0005, ADR-0006]
asistencia_ia:
  herramienta: ""
  modelo: ""
---

# SDD-0002: Seguimiento del AutoScript oficial, empaquetado y demo pública

## Resumen

El paquete pasa a fijar una versión concreta de `autoscript.js`, a distribuirla
en el tarball de npm, a vigilar automáticamente el repositorio oficial y a
publicar una demo ejecutable en una página única.

## Objetivos

- Versionar el paquete en paralelo a las versiones publicadas de AutoFirma.
- Que quien instale la librería reciba `autoscript.js` sin pasos manuales.
- Detectar sin intervención cuándo el proyecto oficial publica una versión
  nueva.
- Enseñar en la web qué hace la librería, ejecutándola de verdad.

## Fuera de alcance

Validación de firmas, firma por lotes, redistribución de AutoScript en el
repositorio git y cualquier lógica criptográfica propia.

## Diseño

### Origen y hallazgos que lo condicionan

`autoscript.js` existe en una única ruta del proyecto oficial:
`afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js`.

Cuatro hechos verificados condicionan todo lo demás:

1. **La constante interna no ordena.** El fichero declara su propia
   `var VERSION`, pero no crece con los tags: `v1.9.1` (2026-04-29) lleva
   `1.10.1` y `v1.9.2` (2026-05-12, posterior) lleva `1.9.0`, porque `v1.9.2`
   cuelga de otra línea (`diverged, ahead 1, behind 211` respecto a `master`).
   Una clave que retrocede no sirve para versionar releases.
2. **El tag sí representa lo distribuido.** El `autoscript.js` del paquete
   oficial descargado de `clienteafirma-1.9.2` y el del tag git `v1.9.2` son
   idénticos byte a byte (sha256 `567998128f1c…0439`).
3. **Es un script clásico.** No tiene UMD, ni `module.exports`, ni `define()`,
   y nunca asigna `window.AutoScript`: depende de que su `var` de nivel
   superior se convierta en global. Procesado como módulo por un empaquetador,
   el global no llega a existir.
4. **AutoScript no verifica firmas.** No hay ninguna operación de verificación
   ni validación en el fichero. Los únicos `check*` públicos son `checkTime`
   y comprobaciones internas de configuración.

### Versionado

La versión del paquete es la del tag mayor por orden semver entre los que
siguen el patrón `vX.Y[.Z]` del repositorio oficial, normalizando `v1.9` a
`1.9.0` y descartando el legado (`OT_*`, `Version_*`). Hoy corresponde
publicar `1.9.2`.

Se acepta la contrapartida: entre dos tags oficiales no queda ningún número
libre para publicar correcciones propias. Las tres alternativas están
descartadas por la herramienta, no por criterio: npm elimina los metadatos de
build (`1.9.2+1` se almacena como `1.9.2`), las preversiones ordenan por debajo
y `^1.9.2` no las acepta, y un cuarto número no es semver válido
(`npm error Invalid version: 1.9.2.1`).

### Fijación del origen

Un fichero versionado, `autoscript.lock.json`, registra el origen exacto:
repositorio, tag, commit, ruta, `sha256` y las tres constantes leídas del
fichero (`VERSION`, `VERSION_CODE`, `PROTOCOL_VERSION`). Es la única fuente de
verdad sobre qué AutoScript corresponde a cada versión publicada.

### Empaquetado

El repositorio git sigue sin contener `autoscript.js`: `vendor/` se ignora en
git y se incluye en el tarball.

Un script propio descarga el fichero del commit fijado, **verifica su `sha256`
contra el lock y aborta si no coincide**. No descarga nada si la copia local ya
existe y su huella coincide, de modo que construir en local no exige red salvo
la primera vez. Se invoca desde `prepack`, que es lo que garantiza que ningún
tarball se genere sin el fichero verificado, y está disponible como script
suelto para la demo y para el desarrollo.

El campo `files` incorpora `vendor` y `exports` publica la ruta para que la
aplicación consumidora pueda resolverla y servirla.

La librería añade un cargador que inserta la etiqueta `<script>` y resuelve
cuando `window.AutoScript` existe. La documentación indica explícitamente que
importar el fichero como módulo no funciona, con el motivo.

### Vigilancia del proyecto oficial

Un workflow programado resuelve el tag mayor, descarga el fichero, calcula su
`sha256` y lo compara con el lock. Si difiere, actualiza el lock y abre un pull
request cuyo cuerpo indica tag, commit, las tres constantes, el `sha256` nuevo y
un resumen del cambio.

El pull request nace sin comprobaciones ejecutadas, porque un workflow abierto
con el `GITHUB_TOKEN` por defecto no dispara CI y se descarta introducir un
token personal. La ejecución se lanza a mano al revisar el pull request, que es
el mismo momento en el que hay que decidir el tag.

### Superficie de la librería

Se añaden dos operaciones que ya existen en el AutoScript fijado:
`saveDataToFile` y `checkTime`. La firma por lotes queda fuera.

Se evaluó añadir también `needNativeAppInstalled`, pero el AutoScript fijado
(1.9.0) la tiene deprecada y su implementación real siempre devuelve `true`
de forma síncrona, sin aceptar callback: no informa de nada. Declararla en la
API pública habría sido una afirmación de compatibilidad falsa, que
`AGENTS.md` prohíbe expresamente. Se retira de `AutoScriptApi`,
`SignatureClient`, `AutoFirmaClient` y `MockAutoFirmaClient`. Los valores
reales de `checkType` en `checkTime` son también distintos de los asumidos
inicialmente: `CT_NO`, `CT_RECOMMENDED` y `CT_OBLIGATORY` (no
`CHECKTIME_NO`/`CHECKTIME_RECOMMENDED`/`CHECKTIME_OBLIGATORY`), y `maxMillis`
se reenvía sin imponer un valor por defecto propio, porque AutoScript ya
aplica el suyo (300000 ms) cuando no recibe ninguno.

El AutoScript fijado (1.9.0) no expone `getErrorCode`, `getErrorCodeNumber`,
`setServiceTimeout` ni `enableProgressDialog`, que aparecen en 1.10.1. La
librería no debe depender de ellas mientras el pin siga en esta línea.

### Web y demo

La documentación deja de generarse con zensical y pasa a ser una página única
construida a mano, con la demo arriba. El trabajo de Python desaparece del
workflow de publicación. Los ADR y SDD se quedan como markdown en el
repositorio, que GitHub ya renderiza.

La demo no comprueba de antemano si AutoFirma está instalada —no hay ninguna
operación fiable en el AutoScript fijado para eso, ver más arriba—: permite
elegir un fichero y un formato desde el primer momento y, al pulsar firmar,
delega en AutoFirma con el certificado que elija la persona usuaria y ofrece
la descarga del resultado. Si AutoFirma no está instalada o no responde, es
el propio AutoScript quien muestra su diálogo de error con enlace de
descarga; la demo se limita a mostrar el mensaje de error resultante. Muestra
además los datos del certificado firmante
—titular, emisora, vigencia y número de serie— parseando en el navegador el
X.509 que devuelve AutoScript. Ese parseo vive en la página, nunca en la
librería.

## Seguridad y privacidad

El fichero ni el resultado salen del navegador: no hay endpoint de subida. Los
datos del certificado se presentan como lo que son, lo que ha devuelto
AutoFirma, y en ningún caso como una verificación: la página lo dice
expresamente, porque AutoScript no puede validar firmas, cadenas de confianza ni
revocación.

La descarga de `autoscript.js` en la construcción se verifica por `sha256`
contra el lock, de modo que ni un cambio en el repositorio oficial ni una
respuesta manipulada pueden entrar en un paquete publicado sin que falle la
construcción.

## Compatibilidad

Servir el AutoScript fijado a una AutoFirma instalada distinta no rompe la
comunicación: `PROTOCOL_VERSION` es 4 tanto en 1.9.0 como en 1.10.1, y la
aplicación nativa solo advierte cuando el código de versión del JavaScript es
menor que su mínimo, que vale 1 en `master`, `v1.9` y `v1.9.2`
(`MIN_JAVASCRIPT_VERSION_CODE_NEEDED = 1` en `ProtocolInvocationLauncher.java`).

## Plan de pruebas

Se prueban con Vitest las partes puras: selección del tag mayor por semver
—incluida la normalización de `v1.9` y el descarte del legado—, lectura de las
tres constantes del fichero, verificación del `sha256` y el cargador con DOM
simulado, comprobando que rechaza cuando el global no aparece.

La demo no se puede probar automáticamente porque exige AutoFirma instalada:
se verifica a mano antes de publicar.

## Despliegue

La publicación en npm sigue usando Trusted Publishing y no incorpora tokens. El
workflow de release verifica, además de la coincidencia entre tag y versión, que
el tarball contiene `vendor/autoscript.js` con el `sha256` del lock.

## Riesgos

- Entre tags oficiales no hay forma de publicar una corrección propia. Es una
  consecuencia aceptada del versionado en espejo.
- El proyecto oficial etiqueta desde líneas divergentes, así que el tag mayor
  puede traer un `autoscript.js` anterior al de un tag previo. El lock deja
  constancia del contenido exacto en cada caso.
- La demo depende de que quien la visite tenga AutoFirma instalada. La rama de
  no detectada forma parte de lo que la página enseña.
