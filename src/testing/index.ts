import type {
  CertificateResult,
  ExtraParameters,
  SignatureClient,
  SignOptions,
  SignResult,
} from "../types.js";

/**
 * Cliente determinista para pruebas de aplicaciones consumidoras.
 */
export class MockAutoFirmaClient implements SignatureClient {
  public readonly calls: SignOptions[] = [];
  private readonly result: SignResult;

  public constructor(
    result: SignResult = {
      signature: "mock-signature",
      certificate: "mock-certificate",
    },
  ) {
    this.result = result;
  }

  public async sign(options: SignOptions): Promise<SignResult> {
    this.calls.push(options);
    return this.result;
  }

  public async coSign(options: SignOptions): Promise<SignResult> {
    this.calls.push(options);
    return this.result;
  }

  public async counterSign(options: SignOptions): Promise<SignResult> {
    this.calls.push(options);
    return this.result;
  }

  public async selectCertificate(
    _parameters: ExtraParameters = {},
  ): Promise<CertificateResult> {
    return { certificate: this.result.certificate ?? "mock-certificate" };
  }
}
