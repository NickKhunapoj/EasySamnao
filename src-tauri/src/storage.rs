use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

pub fn app_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| format!("Unable to resolve the local application-data folder: {error}"))?;
    fs::create_dir_all(&directory).map_err(|error| format!("Unable to create the local application-data folder: {error}"))?;
    Ok(directory)
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() { return Ok(None); }
    let text = fs::read_to_string(path).map_err(|error| format!("Unable to read local settings: {error}"))?;
    serde_json::from_str(&text).map(Some).map_err(|error| format!("Local settings are invalid: {error}"))
}

pub fn write_json<T: serde::Serialize + ?Sized>(path: &Path, value: &T) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|error| format!("Unable to encode local settings: {error}"))?;
    fs::write(path, text).map_err(|error| format!("Unable to write local settings: {error}"))
}

pub fn safe_signature_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.chars().all(|character| character.is_ascii_alphanumeric() || character == '-')
}

#[cfg(test)]
mod tests {
    use super::safe_signature_id;
    #[test]
    fn signature_ids_cannot_escape_the_storage_folder() {
        assert!(safe_signature_id("signature-abc-123"));
        assert!(!safe_signature_id("../signature"));
        assert!(!safe_signature_id("signature/other"));
        assert!(!safe_signature_id(""));
    }
}
