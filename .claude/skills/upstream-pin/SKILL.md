---
name: upstream-pin
description: Revisar y adoptar el pull request que abre el vigilante semanal cuando el proyecto oficial clienteafirma publica un tag nuevo. Cubre lanzar los checks a mano (el PR nace sin ellos), verificar el sha256 y las constantes, detectar si la superficie de AutoScript cambió bajo el wrapper, y decidir versión y tag. Úsala ante cualquier PR de rama upstream/*.
---

# Skill: revisar el PR del vigilante upstream

`.github/workflows/upstream.yml` corre cada lunes, compara el tag mayor de `ctt-gob-es/clienteafirma` con `autoscript.lock.json` y, si difieren, abre un PR que actualiza el pin.

**Ese PR nace sin comprobaciones ejecutadas.** Es deliberado: se empuja con el `GITHUB_TOKEN` por defecto, que no dispara workflows, y se descartó introducir un token personal. Lanzarlas es el primer paso de esta revisión, no un descuido.

---

## 1. Lanzar los checks a mano

Desde la pestaña Actions, ejecuta el workflow **CI** sobre la rama del PR. Sin esto no hay ninguna señal automática sobre ese cambio.

## 2. Verificar que el pin es coherente consigo mismo

```bash
gh pr diff <N> -- autoscript.lock.json
```

Contrasta cada campo contra el origen real, sin fiarte del cuerpo del PR:

```bash
TAG=<tag nuevo>
curl -sL "https://raw.githubusercontent.com/ctt-gob-es/clienteafirma/${TAG}/afirma-ui-miniapplet-deploy/src/main/webapp/js/autoscript.js" -o /tmp/nuevo.js
shasum -a 256 /tmp/nuevo.js | cut -d' ' -f1     # debe ser el sha256 del lock
grep -m3 -E 'var VERSION = |var VERSION_CODE = |var PROTOCOL_VERSION = ' /tmp/nuevo.js
```

Las tres constantes deben coincidir con el bloque `autoscript` del lock. El script de empaquetado aborta si no, pero es mejor saberlo aquí.

## 3. Mirar qué cambió de verdad

El fichero pasa de 200 KB, así que no lo leas entero. Lo que importa es si **la superficie pública cambió bajo nuestro wrapper**:

```bash
api() { grep -oE "^\s+[A-Za-z_]+ : [A-Za-z_]+,?$" "$1" | tr -d ' ' | cut -d: -f1 | sort -u; }
api vendor/autoscript.js > /tmp/api-viejo.txt
api /tmp/nuevo.js > /tmp/api-nuevo.txt
comm -13 /tmp/api-viejo.txt /tmp/api-nuevo.txt   # aparece en la versión nueva
comm -23 /tmp/api-viejo.txt /tmp/api-nuevo.txt   # DESAPARECE: esto es lo peligroso
```

Comprueba después que ninguna operación que usamos esté en la segunda lista:

```bash
grep -rhoE "autoScript\.[a-zA-Z]+" src/ | sort -u
```

Revisa también si cambió el valor de alguna constante que pasemos como parámetro (las `CT_*` de `checkTime`, por ejemplo) y si `PROTOCOL_VERSION` se movió, porque eso afecta a la compatibilidad con la aplicación instalada.

## 4. Decidir la versión

La regla es el espejo (ADR-0004): `package.json` debe valer exactamente lo que el campo `tag` del lock, sin la `v`. El PR del vigilante **no toca `package.json`**, así que si vas a publicar, actualízalo en el mismo PR. El workflow de release comprueba que tag, `package.json` y lock coinciden, y falla si no.

Ojo con una trampa real de este upstream: los tags no ordenan el contenido. `v1.9.1` lleva AutoScript 1.10.1 y `v1.9.2`, posterior, lleva 1.9.0, porque cuelga de una línea divergente. Que el tag suba no garantiza que el AutoScript empaquetado sea más nuevo. Deja constancia en el PR de qué versión de AutoScript entra realmente.

## 5. Antes de mezclar

```bash
npm run vendor && npm test && npm run typecheck && npx prettier --check .
```

`npm run vendor` descargará el fichero nuevo y verificará su huella contra el lock actualizado.

Si la demo usa alguna operación afectada, pruébala a mano con AutoFirma instalada: es el único camino que ha detectado los fallos de contrato de este proyecto.

## 6. Después de mezclar

El tag lo crea una persona, nunca el agente. Si la adopción del pin va a publicarse, sigue la skill `release`.
