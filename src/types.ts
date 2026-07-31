/**
 * Formatos de firma admitidos directamente por AutoScript.
 */
export type SignatureFormat = "PAdES" | "CAdES" | "XAdES" | "FacturaE";

/**
 * Algoritmos habituales de firma. Se permiten cadenas adicionales para no
 * bloquear algoritmos incorporados por versiones futuras de AutoScript.
 */
export type SignatureAlgorithm =
  "SHA256withRSA" | "SHA384withRSA" | "SHA512withRSA" | (string & {});

/**
 * Datos aceptados por el cliente.
 */
export type SignableData = string | ArrayBuffer | Uint8Array | Blob;

/**
 * Parámetros extra serializables por AutoScript.
 */
export type ExtraParameters = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

/**
 * Opciones comunes de una operación de firma.
 */
export interface SignOptions {
  readonly data: SignableData;
  readonly algorithm?: SignatureAlgorithm;
  readonly format: SignatureFormat;
  readonly parameters?: ExtraParameters;
}

/**
 * Resultado normalizado de una firma.
 */
export interface SignResult {
  readonly signature: string;
  readonly certificate?: string;
  readonly extraData?: string;
}

/**
 * Resultado de la selección de certificado.
 */
export interface CertificateResult {
  readonly certificate: string;
}

/**
 * Configuración del cliente.
 */
export interface AutoFirmaClientOptions {
  readonly autoScript?: AutoScriptApi;
  readonly storageUrl?: string;
  readonly retrieveUrl?: string;
}

/**
 * Superficie mínima del objeto global oficial AutoScript.
 */
export interface AutoScriptApi {
  cargarAppAfirma?: () => void;
  setServlets?: (storageUrl: string, retrieveUrl: string) => void;
  sign: SignatureOperation;
  coSign?: SignatureOperation;
  counterSign?: SignatureOperation;
  selectCertificate?: (
    parameters: string,
    success: (certificate: string) => void,
    failure: NativeFailureCallback,
  ) => void;
}

/**
 * Callback nativo de error de AutoScript.
 */
export type NativeFailureCallback = (
  errorType: string,
  errorMessage: string,
) => void;

/**
 * Operación nativa basada en callbacks.
 */
export type SignatureOperation = (
  data: string,
  algorithm: string,
  format: string,
  parameters: string,
  success: (
    signature: string,
    certificate?: string,
    extraData?: string,
  ) => void,
  failure: NativeFailureCallback,
) => void;

/**
 * Contrato desacoplado que facilita sustituir el cliente en pruebas.
 */
export interface SignatureClient {
  sign(options: SignOptions): Promise<SignResult>;
  coSign(options: SignOptions): Promise<SignResult>;
  counterSign(options: SignOptions): Promise<SignResult>;
  selectCertificate(parameters?: ExtraParameters): Promise<CertificateResult>;
}
