import {
  invokeSignatureOperation,
  resolveAutoScript,
} from "./autoscript-adapter.js";
import { AutoFirmaError, fromNativeError } from "./errors.js";
import { serializeParameters } from "./parameters.js";
import { toBase64 } from "./base64.js";
import type {
  AutoFirmaClientOptions,
  AutoScriptApi,
  CertificateResult,
  ExtraParameters,
  SignatureClient,
  SignatureOperation,
  SignOptions,
  SignResult,
} from "./types.js";

const DEFAULT_ALGORITHM = "SHA256withRSA";

/**
 * Cliente moderno y fino sobre la API oficial AutoScript.
 */
export class AutoFirmaClient implements SignatureClient {
  private readonly autoScript: AutoScriptApi;

  public constructor(options: AutoFirmaClientOptions = {}) {
    this.autoScript = resolveAutoScript(options.autoScript);

    if (
      options.storageUrl &&
      options.retrieveUrl &&
      this.autoScript.setServlets
    ) {
      this.autoScript.setServlets(options.storageUrl, options.retrieveUrl);
    }
  }

  /**
   * Solicita a AutoScript que prepare o abra AutoFirma.
   */
  public initialize(): void {
    this.autoScript.cargarAppAfirma?.();
  }

  /**
   * Firma los datos proporcionados.
   */
  public sign(options: SignOptions): Promise<SignResult> {
    return this.execute(this.autoScript.sign, options);
  }

  /**
   * Añade una firma al mismo nivel cuando AutoScript expone la operación.
   */
  public coSign(options: SignOptions): Promise<SignResult> {
    return this.executeRequired("coSign", this.autoScript.coSign, options);
  }

  /**
   * Contrafirma cuando AutoScript expone la operación.
   */
  public counterSign(options: SignOptions): Promise<SignResult> {
    return this.executeRequired(
      "counterSign",
      this.autoScript.counterSign,
      options,
    );
  }

  /**
   * Abre la selección de certificado sin iniciar una firma.
   */
  public selectCertificate(
    parameters: ExtraParameters = {},
  ): Promise<CertificateResult> {
    if (!this.autoScript.selectCertificate) {
      return Promise.reject(
        new AutoFirmaError(
          "Esta versión de AutoScript no expone selectCertificate.",
          "UNSUPPORTED_OPERATION",
        ),
      );
    }

    return new Promise((resolve, reject) => {
      this.autoScript.selectCertificate?.(
        serializeParameters(parameters),
        (certificate) => resolve({ certificate }),
        (type, message) => reject(fromNativeError(type, message)),
      );
    });
  }

  /**
   * Devuelve el objeto oficial para casos que el wrapper todavía no cubra.
   */
  public get raw(): AutoScriptApi {
    return this.autoScript;
  }

  /**
   * Valida que exista la operación opcional antes de ejecutarla.
   */
  private executeRequired(
    name: string,
    operation: SignatureOperation | undefined,
    options: SignOptions,
  ): Promise<SignResult> {
    if (!operation) {
      return Promise.reject(
        new AutoFirmaError(
          `Esta versión de AutoScript no expone ${name}.`,
          "UNSUPPORTED_OPERATION",
        ),
      );
    }

    return this.execute(operation, options);
  }

  /**
   * Normaliza datos y parámetros antes de delegar en AutoScript.
   */
  private async execute(
    operation: SignatureOperation,
    options: SignOptions,
  ): Promise<SignResult> {
    return invokeSignatureOperation(
      operation,
      await toBase64(options.data),
      options.algorithm ?? DEFAULT_ALGORITHM,
      options.format,
      serializeParameters(options.parameters),
    );
  }
}
