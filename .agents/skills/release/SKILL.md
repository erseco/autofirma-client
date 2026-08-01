---
name: release
description: Publicar una versión de @erseco/autofirma-client. Comprueba que tag, package.json y el pin coinciden antes de etiquetar, deja el tag en manos de una persona, y verifica que el paquete llegó a npm, a GitHub Packages y a Releases con el mismo tarball verificado. Úsala al preparar o seguir una publicación.
---

# Skill: publicar una versión

Una publicación en npm es **irreversible**: un número de versión no se puede reutilizar aunque se despublique. Todo lo que sigue va antes del tag por ese motivo.

**El tag lo crea la persona que publica, nunca el agente.** El trabajo del agente termina dejándolo todo comprobado y explicando qué orden ejecutar.

---

## 1. Comprobar la triple coincidencia

```bash
node -p "require('./package.json').version"        # p.ej. 1.9.2
node -p "require('./autoscript.lock.json').tag"    # debe ser v1.9.2
```

El tag que se va a crear debe ser esa misma versión con `v` delante. El workflow lo comprueba y aborta si no cuadra, pero descubrirlo aquí evita un release fallido y un tag que hay que borrar.

Si no coinciden, la regla que decide es el espejo (ADR-0004): manda el tag del lock, y `package.json` se ajusta a él, nunca al revés.

## 2. Pasar las mismas puertas que la CI

```bash
npm run vendor
make check
```

## 3. Comprobar el tarball antes de que exista el tag

```bash
rm -rf artifacts && mkdir artifacts && npm pack --pack-destination artifacts
TARBALL="$(ls artifacts/*.tgz)"
tar -tzf "${TARBALL}" | grep -E "package/(vendor/autoscript.js|dist/index.js)"
tar -xzOf "${TARBALL}" package/vendor/autoscript.js | shasum -a 256 | cut -d' ' -f1
node -p "require('./autoscript.lock.json').sha256"
```

Las dos huellas deben ser idénticas. Es la misma comprobación que hace el workflow, adelantada.

Recuerda que `npm pack` ejecuta `prepack`, que necesita Node ≥ 22.18; con una versión anterior falla con un error de sintaxis poco claro.

## 4. Dejar el tag a la persona

Indícale la orden y no la ejecutes:

```bash
git tag v<versión>
git push origin v<versión>
```

## 5. Seguir el workflow

`release.yml` publica **el mismo tarball verificado** en tres destinos, en este orden:

1. **GitHub Packages** — se autentica con el token del propio workflow, así que no depende de nada configurado fuera.
2. **npm** — usa Trusted Publishing con OIDC. Exige tener registrado `release.yml` como publicador de confianza del paquete; si no, falla con un 404 al hacer `PUT` sobre el registro.
3. **GitHub Releases** — adjunta el tarball con notas generadas.

```bash
gh run watch --exit-status
```

## 6. Verificar que llegó

```bash
npm view @erseco/autofirma-client version
npm view @erseco/autofirma-client dist-tags
gh release view v<versión>
```

`latest` debe apuntar a la versión publicada. Las versiones `canary`, que salen de cada push a `main`, no deben tocar `latest` nunca.

## 7. Si algo falla

- **Falla npm y GitHub Packages ya publicó**: es recuperable, porque el orden está pensado así. Arregla la causa y vuelve a lanzar el workflow; el número de versión sigue libre en npm.
- **Falla después de publicar en npm**: el número está quemado. No se reutiliza: se corrige y se publica el siguiente.
- **No modifiques una release ya publicada.** Lo dice `AGENTS.md`.
