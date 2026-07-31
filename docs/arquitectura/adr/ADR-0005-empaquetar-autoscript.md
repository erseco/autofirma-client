---
id: ADR-0005
titulo: "Empaquetar AutoScript en el tarball"
estado: Aceptado
fecha: 2026-07-31
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0002]
  adrs: []
sustituye: [ADR-0002]
sustituido_por: []
asistencia_ia:
  herramienta: ""
  modelo: ""
---

# ADR-0005: Empaquetar AutoScript en el tarball

## Contexto

ADR-0002 decidió no incluir `autoscript.js` en el paquete para no mezclar el
ciclo de actualización y las condiciones de distribución de dos proyectos
distintos. El repositorio oficial `ctt-gob-es/clienteafirma` es software libre
con licencia GPL 2+ y EUPL 1.1; este paquete es GPL-2.0-or-later. Ambas
licencias permiten la redistribución del fichero: la decisión anterior era una
elección de política sobre cadencia de actualización y procedencia, no una
imposibilidad legal.

## Problema

Exigir un paso manual adicional para obtener `autoscript.js` complica la
instalación y deja en manos de cada aplicación consumidora acertar con una
copia compatible con el pin que la librería espera.

## Opciones consideradas

1. Mantener ADR-0002: la aplicación consumidora aporta su propia copia.
2. Redistribuir `autoscript.js` en el repositorio git.
3. Descargar el fichero fijado durante el empaquetado, verificarlo y
   distribuirlo únicamente en el tarball de npm.

## Evidencias

El repositorio git sigue sin contener `autoscript.js`: `vendor/` está en
`.gitignore` y `git ls-files vendor/` no lista nada. `package.json` incorpora
`vendor` a `files` y publica `exports["./autoscript.js"]` apuntando a
`./vendor/autoscript.js`. El script `scripts/vendor-autoscript.ts` descarga el
fichero del commit fijado en `autoscript.lock.json`, comprueba su `sha256`
contra el lock y aborta si no coincide, y se invoca desde `prepack`.

## Decisión

Se adopta la opción 3. El repositorio git sigue sin contener `autoscript.js`.
El script de empaquetado no repite la descarga si la copia local ya tiene la
huella esperada, de modo que construir en local no exige red salvo la
primera vez. `exports` publica `./autoscript.js` apuntando a
`./vendor/autoscript.js` para que la aplicación consumidora pueda resolverlo y
servirlo.

## Consecuencias

### Positivas

- Quien instala el paquete recibe `autoscript.js` sin pasos manuales.
- El fichero distribuido queda atado por `sha256` a un commit concreto del
  repositorio oficial, verificado en cada empaquetado.
- El repositorio git conserva su tamaño y su historial libres del fichero
  vendido.

### Negativas

- El primer `npm run vendor` en un entorno sin la copia local exige red.
- Un cambio en el contenido publicado por el commit fijado (poco probable,
  pero posible si el proyecto oficial reescribe un tag) hace fallar el
  empaquetado en vez de publicar en silencio un fichero distinto.

### Neutras

- La licencia del paquete no cambia: sigue siendo GPL-2.0-or-later, distinta
  de las licencias del fichero vendido, que conserva las suyas.

## Validación

`npm pack --dry-run` debe listar `vendor/autoscript.js`. La verificación del
`sha256` contra el lock ocurre antes de empaquetar, en el propio script de
`prepack`, que aborta si no coincide; el workflow de release comprueba además
que el tarball generado contiene `vendor/autoscript.js`. Pruebas de Vitest
cubren `verifyOrDownload`: acepta la copia local cuando la huella coincide y
rechaza un contenido descargado que no coincida con el `sha256` del lock.

## Referencias

- <https://github.com/ctt-gob-es/clienteafirma>
- `docs/arquitectura/sdd/SDD-0002-seguimiento-upstream-y-demo.md`
- `scripts/vendor-autoscript.ts`
- `autoscript.lock.json`
- `package.json`
