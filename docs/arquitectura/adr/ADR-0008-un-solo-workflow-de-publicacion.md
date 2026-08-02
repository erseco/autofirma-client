---
id: ADR-0008
titulo: "Publicar release y canary desde un solo workflow"
estado: Aceptado
fecha: 2026-08-02
relacionados:
  issues: []
  prs: []
  sdds: []
  adrs: [ADR-0007]
sustituye: []
sustituido_por: []
asistencia_ia:
  herramienta: "Claude Code"
  modelo: "Opus 5"
---

# ADR-0008: Publicar release y canary desde un solo workflow

## Contexto

Las dos publicaciones vivían en ficheros separados, `release.yml` y
`canary.yml`, cada uno con su disparador y su dist-tag.

## Problema

npm identifica al publicador de confianza por el **nombre del fichero de
workflow**, y su documentación es explícita: «Each package can only have one
trusted publisher configured at a time». Con dos ficheros publicando en npm,
uno de los dos falla siempre con un 404 al hacer `PUT` sobre el registro, y el
error no explica la causa.

## Opciones consideradas

1. **Registrar solo uno y renunciar al otro canal en npm.** Deja de publicarse
   una de las dos cosas donde la gente la busca.
2. **Usar un token npm para el que no esté registrado.** Contradice la decisión
   de no guardar tokens de npm en el repositorio ni en los workflows.
3. **Fusionar ambos en un `publish.yml`.** Un solo fichero que registrar, y las
   dos publicaciones conservadas.

## Decisión

Un único `publish.yml` con dos disparadores: un tag `v*` publica bajo `latest`
y crea la release de GitHub; un push a `main` publica una preversión bajo
`canary`. Los pasos que solo corresponden a uno de los dos casos se condicionan
con `github.ref_type`.

Se retira el filtro `paths` que tenía `canary.yml`. Un mismo `on.push` no puede
filtrar por rutas solo para las ramas: el filtro se combinaría en conjunción con
el de tags y una release dejaría de publicarse. Publicar una preversión de más
cuando el cambio no altera el paquete es ruido barato; que no salga una release
no lo es.

## Consecuencias

- Hay un solo fichero que dar de alta en npm, y con el entorno `npm`.
- Cambiar el nombre del fichero obliga a actualizar ese registro.
- Cada push a `main` publica una preversión, aunque no cambie el tarball.
- La lógica común —controles, empaquetado y verificación del `sha256`— deja de
  estar duplicada, así que no puede divergir entre canales.

## Referencias

- `.github/workflows/publish.yml`
- [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)
