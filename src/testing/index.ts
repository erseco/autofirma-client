import type {
  CertificateResult,
  CheckTimeOptions,
  ExtraParameters,
  SaveOptions,
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

  public readonly saved: SaveOptions[] = [];
  public installed = true;

  public async isNativeAppInstalled(): Promise<boolean> {
    return this.installed;
  }

  public async saveDataToFile(options: SaveOptions): Promise<void> {
    this.saved.push(options);
  }

  public async checkTime(_options: CheckTimeOptions = {}): Promise<void> {
    return undefined;
  }
}
