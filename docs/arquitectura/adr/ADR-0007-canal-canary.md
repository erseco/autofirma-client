---
id: ADR-0007
titulo: "Publicar cada push a main en el canal canary"
estado: Aceptado
fecha: 2026-08-01
relacionados:
  issues: []
  prs: []
  sdds: [SDD-0002]
  adrs: [ADR-0004]
sustituye: []
sustituido_por: []
asistencia_ia:
  herramienta: ""
  modelo: ""
---

# ADR-0007: Publicar cada push a main en el canal canary

## Contexto

ADR-0004 fijó que la versión publicada espeja exactamente el tag mayor de
AutoFirma, y registró como consecuencia negativa que entre dos tags oficiales no
queda ningún número libre para publicar correcciones propias. Upstream etiqueta
una o dos veces al año.

Durante el desarrollo hace falta además poder instalar y probar lo que hay en
`main` sin esperar a un tag.

## Problema

Publicar cada push bajo `latest` haría llegar código sin revisar a quien instale
de la forma habitual. No publicar nada deja `main` sin forma de probarse fuera
del repositorio.

## Opciones consideradas

1. No publicar automáticamente y esperar siempre a un tag.
2. Publicar cada push bajo `latest`.
3. Publicar cada push bajo un dist-tag de preversión.

## Evidencias

Una preversión ordena por debajo de su propia versión, no por encima:
`semver.lt("1.9.2-canary.1", "1.9.2")` es cierto. Un canary construido sobre la
versión actual quedaría por detrás de la ya publicada pese a contener más
código, así que la base debe ser el patch siguiente:
`semver.gt("1.9.3-canary.20260801093800.c87d428", "1.9.2")` es cierto y
`semver.lt(...,"1.9.3")` también.

Los rangos habituales no aceptan preversiones:
`semver.satisfies("1.9.3-canary.20260801093800.c87d428", "^1.9.2")` es falso.
Quien instale de la forma normal no recibe estas versiones aunque sean las más
altas del registro.

## Decisión

Cada push a `main` que toque el paquete publica bajo el dist-tag `canary`, con
versión `<patch siguiente>-canary.<sello UTC>.<sha corto>`. `latest` queda
reservado a los tags de release.

El workflow repite los mismos controles y la misma verificación del `sha256` del
`vendor/autoscript.js` empaquetado que el de release: un canary no es un
artefacto de menor calidad, solo de menor compromiso.

Se descarta la opción 1 porque deja `main` sin forma de probarse, y la opción 2
porque haría llegar código sin revisar a quien no lo ha pedido.

## Consecuencias

### Positivas

- `main` es instalable y probable en un proyecto real sin esperar a un tag.
- Abre la única vía para publicar correcciones del wrapper entre dos tags de
  AutoFirma, que es la contrapartida que ADR-0004 dejó registrada.
- El sello y el sha del nombre identifican sin ambigüedad de qué commit sale
  cada publicación.

### Negativas

- El registro acumula una versión por push que toque el paquete. Las rutas del
  disparador se limitan a lo que puede cambiar el tarball para no publicar por
  un cambio de documentación.
- Cada canary consume una publicación irreversible: npm no permite reutilizar un
  número de versión aunque se despublique.

### Neutras

- Mientras no exista una versión estable no hay dist-tag `latest`, así que hasta
  el primer tag hay que instalar con `@canary`.
- El workflow nuevo debe registrarse también como publicador de confianza en
  npm; de lo contrario el paso de publicación falla por OIDC.

## Validación

`npm install @erseco/autofirma-client@canary` debe instalar la versión
correspondiente al último commit de `main`, y `npm install
@erseco/autofirma-client` no debe devolver nunca una versión canary.

## Referencias

- `.github/workflows/canary.yml`
- <https://docs.npmjs.com/adding-dist-tags-to-packages>
