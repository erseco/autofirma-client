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
  CheckTimeOptions,
  ExtraParameters,
  SaveOptions,
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
      return this.unsupported("selectCertificate");
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
   * Pide a AutoFirma que guarde datos en un fichero elegido por la persona
   * usuaria.
   */
  public saveDataToFile(options: SaveOptions): Promise<void> {
    const operation = this.autoScript.saveDataToFile;
    if (!operation) {
      return this.unsupported("saveDataToFile");
    }

    return new Promise((resolve, reject) => {
      operation(
        options.data,
        options.title,
        options.filename,
        options.extension,
        options.description,
        () => resolve(),
        (type, message) => reject(fromNativeError(type, message)),
      );
    });
  }

  /**
   * Comprueba la sincronía del reloj del equipo contra un servidor.
   *
   * AutoScript lo implementa con una petición XHR **síncrona** que bloquea el
   * hilo principal (`xhr.open('GET', url, false)`) hasta obtener respuesta.
   * Si no se indica `checkUrl`, la petición se envía contra
   * `document.URL + '/' + Math.random()`: una URL inventada contra el propio
   * origen de la página, un acceso de red no documentado en ningún otro sitio
   * y que este método no evita ni controla, pese a que esta librería no hace
   * ningún acceso de red propio.
   *
   * El único efecto observable de un desfase es un `alert()` nativo; AutoScript
   * captura y silencia cualquier error (por ejemplo, que la petición falle).
   * Por eso la promesa devuelta nunca informa del resultado de la
   * comprobación: se resuelve siempre que la operación exista, haya o no
   * desfase y haya o no error de red.
   *
   * Con `checkType: "CT_OBLIGATORY"` y un desfase detectado, AutoScript marca
   * un estado interno (`severeTimeDelay`) que hace que su función de carga
   * (`cargarAppAfirma`, a la que invoca `initialize()`) registre un aviso y
   * retorne sin hacer nada la siguiente vez que se ejecute. El orden de
   * llamadas importa y no está documentado: invocar
   * `checkTime({ checkType: "CT_OBLIGATORY" })` antes de `initialize()` puede
   * convertir `initialize()` en un no-op silencioso; invocarlo después de
   * `initialize()` no afecta a una carga que ya se ha iniciado.
   *
   * Si no se indica `maxMillis`, se reenvía tal cual: AutoScript aplica
   * entonces su propio valor por defecto (300000 ms, 5 minutos) en vez de uno
   * impuesto aquí.
   */
  public checkTime(options: CheckTimeOptions = {}): Promise<void> {
    const operation = this.autoScript.checkTime;
    if (!operation) {
      return this.unsupported("checkTime");
    }

    operation(
      options.checkType ?? "CT_RECOMMENDED",
      options.maxMillis,
      options.checkUrl,
    );
    return Promise.resolve();
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
      return this.unsupported(name);
    }

    return this.execute(operation, options);
  }

  /**
   * Rechazo homogéneo para operaciones ausentes en la versión fijada.
   */
  private unsupported<T>(name: string): Promise<T> {
    return Promise.reject(
      new AutoFirmaError(
        `Esta versión de AutoScript no expone ${name}.`,
        "UNSUPPORTED_OPERATION",
      ),
    );
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
