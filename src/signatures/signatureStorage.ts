import { invoke } from "@tauri-apps/api/core";
import type { SignatureMetadata } from "../types";

export async function listSignatures(): Promise<SignatureMetadata[]> {
  return invoke<SignatureMetadata[]>("list_signatures");
}

export async function saveSignature(id: string, name: string, sanitizedSvg: string): Promise<SignatureMetadata> {
  return invoke<SignatureMetadata>("save_signature", { id, name, svg: sanitizedSvg });
}

export async function readSignatureSvg(id: string): Promise<string> {
  return invoke<string>("read_signature", { id });
}

export async function removeSignature(id: string): Promise<void> {
  await invoke("delete_signature", { id });
}

export async function renameSignature(id: string, name: string): Promise<void> {
  await invoke("rename_signature", { id, name });
}

export async function setDefaultSignature(id: string): Promise<void> {
  await invoke("set_default_signature", { id });
}
