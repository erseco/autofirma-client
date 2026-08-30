export { AutoFirmaClient } from "./client.js";
export { loadAutoScript } from "./loader.js";
export type { LoadOptions } from "./loader.js";
export { AutoFirmaError, AutoScriptUnavailableError } from "./errors.js";
export { isAutoScriptAvailable } from "./autoscript-adapter.js";
export { serializeParameters } from "./parameters.js";
export { fromBase64, toBase64 } from "./base64.js";
export type {
  AutoFirmaClientOptions,
  AutoScriptApi,
  CertificateResult,
  CheckTimeOptions,
  ExtraParameters,
  SaveOptions,
  SignableData,
  SignatureAlgorithm,
  SignatureClient,
  SignatureFormat,
  SignOptions,
  SignResult,
} from "./types.js";
