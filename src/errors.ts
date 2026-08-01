/**
 * Error normalizado que conserva la información devuelta por AutoScript.
 */
export class AutoFirmaError extends Error {
  public readonly code: string;
  public readonly nativeType: string | undefined;
  public readonly nativeMessage: string | undefined;

  public constructor(
    message: string,
    code = "AUTOFIRMA_ERROR",
    nativeType?: string,
    nativeMessage?: string,
  ) {
    super(message);
    this.name = "AutoFirmaError";
    this.code = code;
    this.nativeType = nativeType;
    this.nativeMessage = nativeMessage;
  }
}

/**
 * Error emitido cuando no existe el objeto global AutoScript.
 */
export class AutoScriptUnavailableError extends AutoFirmaError {
  public constructor() {
    super(
      "AutoScript no está disponible en la página.",
      "AUTOSCRIPT_UNAVAILABLE",
    );
    this.name = "AutoScriptUnavailableError";
  }
}

/**
 * Convierte el error nativo sin perder sus datos originales.
 *
 * AutoScript solo emite cinco tipos nativos. Tres de ellos identifican una
 * causa concreta sobre la que quien integra puede actuar —cancelación, falta de
 * memoria y falta de respuesta— y reciben su propio código; el resto queda como
 * `NATIVE_ERROR` con el tipo y el mensaje originales intactos, porque
 * `java.lang.Exception` es el cajón donde AutoFirma mete sus códigos `SAF_xx` y
 * traducirlos aquí sería inventar categorías que no existen.
 */
export function fromNativeError(
  nativeType: string,
  nativeMessage: string,
): AutoFirmaError {
  const normalizedType = nativeType.toLowerCase();
  const normalizedMessage = nativeMessage.toLowerCase();

  if (
    normalizedType.includes("cancel") ||
    normalizedMessage.includes("cancel")
  ) {
    return new AutoFirmaError(
      "La operación de firma fue cancelada.",
      "USER_CANCELLED",
      nativeType,
      nativeMessage,
    );
  }

  // AutoFirma responde `MEMORY_ERROR` cuando los datos no le caben en memoria,
  // y AutoScript lo traduce a este tipo. No hay un tamaño máximo declarado en
  // ninguna parte: el límite lo pone la memoria de la aplicación nativa.
  if (normalizedType.includes("outofmemory")) {
    return new AutoFirmaError(
      "El fichero excede la memoria disponible de AutoFirma.",
      "DATA_TOO_LARGE",
      nativeType,
      nativeMessage,
    );
  }

  // Se agotaron los reintentos de conexión con la aplicación nativa: o no está
  // instalada, o no llegó a abrirse.
  if (normalizedType.includes("timeout")) {
    return new AutoFirmaError(
      "AutoFirma no respondió a tiempo.",
      "NATIVE_TIMEOUT",
      nativeType,
      nativeMessage,
    );
  }

  return new AutoFirmaError(
    "AutoFirma no pudo completar la operación.",
    "NATIVE_ERROR",
    nativeType,
    nativeMessage,
  );
}
