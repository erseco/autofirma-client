export { AutoFirmaClient } from "./client.js";
export { AutoFirmaError, AutoScriptUnavailableError } from "./errors.js";
export { serializeParameters } from "./parameters.js";
export { toBase64 } from "./base64.js";
export type {
  AutoFirmaClientOptions,
  AutoScriptApi,
  CertificateResult,
  ExtraParameters,
  SignableData,
  SignatureAlgorithm,
  SignatureClient,
  SignatureFormat,
  SignOptions,
  SignResult,
} from "./types.js";
