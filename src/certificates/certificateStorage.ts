import { invoke } from "@tauri-apps/api/core";
import type {
  CertificateBindingState,
  CertificateProfile,
  CertificateStatus,
  CreateCertificateRequest,
  PdfSignatureVerification,
} from "../types";

export const listCertificates = () =>
  invoke<CertificateProfile[]>("list_certificates");
export const createCertificate = (request: CreateCertificateRequest) =>
  invoke<CertificateProfile>("create_certificate", { request });
export const inspectPkcs12 = (path: string, password: string) =>
  invoke<CertificateProfile>("inspect_pkcs12", { path, password });
export const importPkcs12 = (
  id: string,
  displayName: string,
  path: string,
  password: string,
) =>
  invoke<CertificateProfile>("import_pkcs12", {
    id,
    displayName,
    path,
    password,
  });
export const discoverWindowsCertificates = () =>
  invoke<CertificateProfile[]>("discover_windows_certificates");
export const bindCertificateSignature = (
  certificateId: string,
  svgId: string,
) => invoke<void>("bind_certificate_signature", { certificateId, svgId });
export const certificateBindingState = (certificateId: string) =>
  invoke<CertificateBindingState>("certificate_binding_state", {
    certificateId,
  });
export const setCertificateStatus = (
  certificateId: string,
  status: Extract<CertificateStatus, "retired" | "compromised">,
) => invoke<void>("set_certificate_status", { certificateId, status });
export const removeCertificateProfile = (certificateId: string) =>
  invoke<void>("remove_certificate_profile", { certificateId });
export const deleteCertificateFromWindows = (
  certificateId: string,
  confirmation: string,
) =>
  invoke<void>("delete_certificate_from_windows", {
    certificateId,
    confirmation,
  });
export const exportCertificateFile = (certificateId: string, path: string) =>
  invoke<void>("export_certificate_file", { certificateId, path });
export const exportCertificatePkcs12 = (
  certificateId: string,
  path: string,
  password: string,
) =>
  invoke<void>("export_certificate_pkcs12", { certificateId, path, password });
export const signPreparedPdf = (certificateId: string, bytes: Uint8Array) =>
  invoke<number[]>("sign_prepared_pdf", {
    certificateId,
    bytes: Array.from(bytes),
  }).then((output) => new Uint8Array(output));
export const verifyPdfSignatures = (bytes: Uint8Array) =>
  invoke<PdfSignatureVerification[]>("verify_pdf_signatures", {
    bytes: Array.from(bytes),
  });
