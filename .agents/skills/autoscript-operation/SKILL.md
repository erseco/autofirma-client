---
name: autoscript-operation
description: Envolver una operación de AutoScript en el cliente TypeScript. Verifica la firma real y los valores de las constantes en el vendor/autoscript.js fijado antes de escribir el wrapper, porque suponerlos ya ha producido dos fallos que llegaron a producción. Úsala al añadir cualquier método nuevo a AutoFirmaClient o a AutoScriptApi.
---

# Skill: envolver una operación de AutoScript

`AGENTS.md` lo exige y este proyecto lo ha pagado dos veces: **antes de envolver una operación hay que leer su firma real y el valor de sus constantes en `vendor/autoscript.js`, y un doble de prueba nunca debe definir el contrato.**

Los dos fallos que motivaron la regla, ambos detectados solo al cargar el fichero real en un navegador:

- `needNativeAppInstalled` se envolvió como si aceptara callback. En realidad está **deprecada**, no recibe argumentos y devuelve `true` de forma síncrona, así que la promesa **no resolvía nunca**. La prueba simulaba la firma supuesta y pasaba en verde validando el error.
- `checkTime` recibía la cadena `"CHECKTIME_RECOMMENDED"`. Los valores reales de esas constantes son `"CT_NO"`, `"CT_RECOMMENDED"` y `"CT_OBLIGATORY"`, así que la comprobación se hacía con la severidad equivocada.

---

## 1. Tener delante el fichero fijado

```bash
npm run vendor
shasum -a 256 vendor/autoscript.js | cut -d' ' -f1
node -p "require('./autoscript.lock.json').sha256"
```

Las dos huellas deben coincidir. `vendor/` está fuera de git, así que puede no existir en un clon limpio.

## 2. Leer la firma real

```bash
grep -n "function <nombre>" vendor/autoscript.js
```

Aparecerán **varias**: el fichero define tres clientes distintos (WebSocket ~1745-2607, socket 2608-3708, servidor intermedio 3709 en adelante). Lo que ve el wrapper es el objeto exportado, así que confirma que la operación está publicada:

```bash
grep -n "<nombre> *:" vendor/autoscript.js | tail -3
```

Si no aparece en esa lista final, no existe para nosotros por mucho que la función esté definida.

## 3. Comprobar tres cosas que no se ven en el nombre

- **¿Está deprecada?** Lee el docblock justo encima. Si dice `DEPRECADO`, para y pregunta antes de envolverla: puede que no informe de nada, como `needNativeAppInstalled`.
- **¿Cuántos argumentos recibe y cuáles son callbacks?** Cuéntalos en la definición, no los supongas por analogía con `sign`. Algunas operaciones no llevan ningún callback y son fuego y olvido, como `checkTime`.
- **¿Recibe constantes?** Si acepta valores tipo enumerado, busca su valor literal:

```bash
grep -nE "var [A-Z_]+ *= *\"" vendor/autoscript.js | head -20
```

El nombre de la constante casi nunca es su valor.

## 4. Escribir el wrapper

- Añade el miembro a `AutoScriptApi` en `src/types.ts` como **opcional**: el AutoScript fijado puede no exponerlo.
- En `src/client.ts`, usa el ayudante `unsupported(nombre)` para rechazar con código `UNSUPPORTED_OPERATION` cuando la operación no exista.
- Si la operación recibe un callback de error, conviértelo con `fromNativeError` para no perder `nativeType` ni `nativeMessage`.
- No inventes valores por defecto que AutoScript ya aplica por su cuenta: reenvía lo que reciba el llamante. `checkTime` es el ejemplo — AutoScript pone 300000 ms si `maxMillis` llega vacío.
- Refleja la operación en `MockAutoFirmaClient` (`src/testing/index.ts`) si amplías `SignatureClient`, o el doble dejará de cumplir el contrato.
- Exporta los tipos nuevos en `src/index.ts`.

## 5. Probarlo contra la realidad, no contra la suposición

El doble de la prueba debe **reproducir la firma real** que acabas de leer: mismo número de argumentos y mismo comportamiento síncrono o asíncrono. Cubre siempre:

- El camino de éxito, con valores distintos entre sí en cada argumento posicional, para que una transposición falle. `saveDataToFile` recibe cinco cadenas seguidas y una permuta compilaría igual.
- La guarda: cuando el objeto AutoScript no expone la operación, debe rechazar con `UNSUPPORTED_OPERATION`.

Si documentas comportamiento en el docblock —que se bloquea, que abre red, que altera estado global— cita la línea de `vendor/autoscript.js` donde lo comprobaste.

## 6. Cerrar

```bash
npm test && npm run typecheck && npx prettier --check .
```

Los umbrales de cobertura sobre `src/**` son 90 % líneas, funciones y sentencias, y 85 % ramas.
