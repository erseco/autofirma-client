---
name: demo-local
description: Levantar la demo en local para probar la firma con AutoFirma real y depurarla cuando falla. Cubre construirla, servirla en un puerto libre, la recarga forzada, instrumentar AutoScript para capturar el error nativo, y distinguir un fallo de certificado de uno de comunicación o de tamaño. Úsala al tocar web/ o al investigar un fallo de firma.
---

# Skill: probar y depurar la demo en local

La demo es lo único que ejercita la librería de punta a punta contra AutoFirma real, y es lo que ha destapado los fallos que ninguna prueba automática podía ver. Cuando toques `web/` o `src/`, pruébala.

---

## 1. Construir y servir

```bash
npm run vendor && npm run build:web
```

`site/` debe contener `index.html`, `styles.css`, `demo.js` y `autoscript.js`.

**Elige un puerto libre y compruébalo**, no des por hecho el 8080:

```bash
PUERTO=8137
lsof -nP -iTCP:${PUERTO} -sTCP:LISTEN | head -3   # vacío = libre
python3 -m http.server ${PUERTO} --directory site &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:${PUERTO}/
```

No abras `index.html` con `file://`: AutoScript necesita un origen HTTP.

## 2. Recarga forzada, siempre

`demo.js` se cachea con agresividad. Tras reconstruir, **⌘⇧R**. Más de un «no funciona» de este proyecto ha sido un bundle viejo en caché.

## 3. Qué esperar

- Hace falta **AutoFirma instalada**. En móvil no puede funcionar: AutoScript usa allí un servidor intermedio que una página estática no tiene, y la demo lo detecta y lo explica.
- El primer intento tarda: AutoScript sondea varios puertos hasta que la aplicación levanta el suyo.

## 4. Leer la consola sin confundirse

Estas líneas son **normales**, no el fallo:

```
Tratamos de conectar con el cliente a traves de WebSockets en los puertos 54591,53475,63324
WebSocket connection to 'wss://127.0.0.1:54591/' failed: ERR_CONNECTION_REFUSED
Procesado por defecto del error
```

Es el sondeo mientras AutoFirma arranca. Lo que indica éxito de comunicación es:

```
Se abre el socket
Respuesta obtenida de la operacion enviada
```

Si aparecen esas dos y aun así falla, **AutoFirma respondió con un error**: el problema no es de conexión.

## 5. Capturar el error nativo

La página ya muestra `nativeType` y `nativeMessage` entre paréntesis. Si necesitas más, instrumenta el objeto global en caliente desde la consola, sin tocar las fuentes:

```js
(() => {
  const original = window.AutoScript.sign;
  window.AutoScript.sign = function (...args) {
    const err = args[args.length - 1];
    args[args.length - 1] = (tipo, mensaje) => {
      console.error("[SONDA]", JSON.stringify(tipo), JSON.stringify(mensaje));
      return err(tipo, mensaje);
    };
    return original.apply(this, args);
  };
})();
```

Guarda lo que capture en una variable además de imprimirlo: la grabación de consola de las herramientas de automatización empieza cuando se conecta, y se pierde lo anterior.

## 6. Interpretar el fallo

| Señal                                 | Qué es                                                  |
| ------------------------------------- | ------------------------------------------------------- |
| `USER_CANCELLED`                      | Se cerró el diálogo o se canceló                        |
| `DATA_TOO_LARGE`                      | El fichero excede la memoria de AutoFirma               |
| `NATIVE_TIMEOUT`                      | No está instalada o no llegó a abrirse                  |
| `NATIVE_ERROR` con mensaje `SAF_xx`   | Error tipificado de AutoFirma; el código dice cuál      |
| Diálogo de AutoScript vacío, en móvil | Falta el servidor intermedio; no se puede resolver aquí |

Un certificado que no sirve para firmar llega como `NATIVE_ERROR`: el detalle nativo es lo que lo distingue, y por eso la página lo muestra.

## 7. Al terminar

Para el servidor:

```bash
kill $(lsof -nP -iTCP:${PUERTO} -sTCP:LISTEN -t)
```

`site/` está fuera de git y se regenera; no hace falta limpiarlo.
