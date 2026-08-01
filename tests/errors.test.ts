import { describe, expect, it } from "vitest";
import { fromNativeError } from "../src/errors.js";

// Los tipos y mensajes son literales de vendor/autoscript.js: si upstream los
// cambia, estas pruebas deben fallar en vez de seguir clasificando por un texto
// que ya no existe.
describe("fromNativeError", () => {
  it("clasifica la cancelación de la persona usuaria", () => {
    const error = fromNativeError(
      "es.gob.afirma.core.AOCancelledOperationException",
      "Operacion cancelada por el usuario",
    );

    expect(error.code).toBe("USER_CANCELLED");
  });

  it("clasifica el fichero demasiado grande", () => {
    const error = fromNativeError(
      "es.gob.afirma.core.OutOfMemoryError",
      "El fichero que se pretende firmar o guardar excede de la memoria disponible para aplicacion",
    );

    expect(error.code).toBe("DATA_TOO_LARGE");
    expect(error.message).toMatch(/memoria/i);
  });

  it("clasifica la falta de respuesta de la aplicación nativa", () => {
    const error = fromNativeError(
      "java.util.concurrent.TimeoutException",
      "No se ha podido conectar con AutoFirma",
    );

    expect(error.code).toBe("NATIVE_TIMEOUT");
  });

  it("deja como error genérico los códigos SAF que AutoFirma no tipifica", () => {
    const error = fromNativeError("java.lang.Exception", "SAF_19");

    expect(error.code).toBe("NATIVE_ERROR");
  });

  it("conserva intactos el tipo y el mensaje nativos en todos los casos", () => {
    const error = fromNativeError(
      "es.gob.afirma.core.OutOfMemoryError",
      "SAF_08",
    );

    expect(error.nativeType).toBe("es.gob.afirma.core.OutOfMemoryError");
    expect(error.nativeMessage).toBe("SAF_08");
  });
});
