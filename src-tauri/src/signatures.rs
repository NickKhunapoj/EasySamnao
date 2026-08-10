use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::AppHandle;
use crate::storage::{app_directory, read_json, safe_signature_id, write_json};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureMetadata {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub is_default: bool,
}

fn metadata_path(app: &AppHandle) -> Result<PathBuf, String> { Ok(app_directory(app)?.join("signature-metadata.json")) }
fn signature_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_directory(app)?.join("signatures");
    fs::create_dir_all(&path).map_err(|error| format!("Unable to create the secure signature store: {error}"))?;
    Ok(path)
}
fn payload_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if !safe_signature_id(id) { return Err("Invalid signature identifier.".to_string()); }
    Ok(signature_directory(app)?.join(format!("{id}.dpapi")))
}
pub fn read_metadata(app: &AppHandle) -> Result<Vec<SignatureMetadata>, String> { Ok(read_json(&metadata_path(app)?)?.unwrap_or_default()) }
pub fn write_metadata(app: &AppHandle, items: &[SignatureMetadata]) -> Result<(), String> { write_json(&metadata_path(app)?, items) }

#[cfg(target_os = "windows")]
fn protect(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN}};
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: ptr::null_mut() };
    let succeeded = unsafe { CryptProtectData(&input, ptr::null(), ptr::null(), ptr::null(), ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) };
    if succeeded == 0 { return Err("Windows DPAPI could not encrypt the signature.".to_string()); }
    let result = unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData.cast()); }
    Ok(result)
}

#[cfg(target_os = "windows")]
fn unprotect(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN}};
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: ptr::null_mut() };
    let succeeded = unsafe { CryptUnprotectData(&input, ptr::null_mut(), ptr::null(), ptr::null(), ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) };
    if succeeded == 0 { return Err("Windows DPAPI could not decrypt this signature. It may belong to another Windows user.".to_string()); }
    let result = unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData.cast()); }
    Ok(result)
}

#[cfg(not(target_os = "windows"))]
fn protect(_: &[u8]) -> Result<Vec<u8>, String> { Err("Signature encryption is available only on Windows.".to_string()) }
#[cfg(not(target_os = "windows"))]
fn unprotect(_: &[u8]) -> Result<Vec<u8>, String> { Err("Signature decryption is available only on Windows.".to_string()) }

pub fn save(app: &AppHandle, id: String, name: String, svg: String) -> Result<SignatureMetadata, String> {
    if !safe_signature_id(&id) || name.trim().is_empty() || name.len() > 160 { return Err("The signature name or identifier is invalid.".to_string()); }
    let encrypted = protect(svg.as_bytes())?;
    fs::write(payload_path(app, &id)?, encrypted).map_err(|error| format!("Unable to save the encrypted signature: {error}"))?;
    let mut items = read_metadata(app)?;
    if items.iter().any(|item| item.id == id) { return Err("A signature with this identifier already exists.".to_string()); }
    let item = SignatureMetadata { id, name: name.trim().to_string(), created_at: chrono_like_timestamp(), is_default: items.is_empty() };
    items.push(item.clone());
    write_metadata(app, &items)?;
    Ok(item)
}

pub fn load(app: &AppHandle, id: &str) -> Result<String, String> {
    let payload = fs::read(payload_path(app, id)?).map_err(|error| format!("Unable to read the encrypted signature: {error}"))?;
    let plain = unprotect(&payload)?;
    String::from_utf8(plain).map_err(|_| "The decrypted signature is not valid UTF-8.".to_string())
}
pub fn rename(app: &AppHandle, id: &str, name: String) -> Result<(), String> {
    if name.trim().is_empty() { return Err("A signature name is required.".to_string()); }
    let mut items = read_metadata(app)?;
    let item = items.iter_mut().find(|item| item.id == id).ok_or("Signature not found.")?;
    item.name = name.trim().to_string(); write_metadata(app, &items)
}
pub fn delete(app: &AppHandle, id: &str) -> Result<(), String> {
    let mut items = read_metadata(app)?;
    let original = items.len(); items.retain(|item| item.id != id);
    if items.len() == original { return Err("Signature not found.".to_string()); }
    if !items.iter().any(|item| item.is_default) { if let Some(first) = items.first_mut() { first.is_default = true; } }
    let path = payload_path(app, id)?;
    if path.exists() { fs::remove_file(path).map_err(|error| format!("Unable to remove encrypted signature: {error}"))?; }
    write_metadata(app, &items)
}
pub fn set_default(app: &AppHandle, id: &str) -> Result<(), String> {
    let mut items = read_metadata(app)?; let mut found = false;
    for item in &mut items { item.is_default = item.id == id; found |= item.is_default; }
    if !found { return Err("Signature not found.".to_string()); } write_metadata(app, &items)
}
fn chrono_like_timestamp() -> String { format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()) }

#[cfg(test)]
mod tests {
    use super::{protect, unprotect};
    #[cfg(target_os = "windows")]
    #[test]
    fn dpapi_round_trip_keeps_signature_private_and_intact() {
        let encrypted = protect(b"<svg><path d='M0 0'/></svg>").unwrap();
        assert_ne!(encrypted, b"<svg><path d='M0 0'/></svg>");
        assert_eq!(unprotect(&encrypted).unwrap(), b"<svg><path d='M0 0'/></svg>");
    }
}
