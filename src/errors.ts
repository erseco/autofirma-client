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
 */
export function fromNativeError(
  nativeType: string,
  nativeMessage: string,
): AutoFirmaError {
  const normalizedType = nativeType.toLowerCase();
  const normalizedMessage = nativeMessage.toLowerCase();
  const cancelled =
    normalizedType.includes("cancel") || normalizedMessage.includes("cancel");

  return new AutoFirmaError(
    cancelled
      ? "La operación de firma fue cancelada."
      : "AutoFirma no pudo completar la operación.",
    cancelled ? "USER_CANCELLED" : "NATIVE_ERROR",
    nativeType,
    nativeMessage,
  );
}
