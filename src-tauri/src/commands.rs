use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};
use tauri::AppHandle;
use ttf_parser::Face;
use crate::{signatures::{self, SignatureMetadata}, storage::{app_directory, read_json, write_json}};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_template: String,
    pub default_text_color: String,
    pub default_line_color: String,
    pub default_signature_color: String,
    pub default_opacity: f32,
    pub default_rotation: f32,
    pub default_date_format: String,
    pub font_path: Option<String>,
    pub font_name: Option<String>,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_language() -> String { "en".to_string() }
fn default_theme() -> String { "light".to_string() }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontValidation { pub name: String, pub supports_thai: bool }
#[derive(Serialize)]
pub struct PreferredFont { pub path: String, pub name: String }

fn extension(path: &str) -> Option<String> { Path::new(path).extension().and_then(|item| item.to_str()).map(|item| item.to_ascii_lowercase()) }
fn require_extension(path: &str, allowed: &[&str]) -> Result<(), String> {
    if allowed.iter().any(|item| Some(*item) == extension(path).as_deref()) { Ok(()) } else { Err("This file type is not permitted for this operation.".to_string()) }
}
fn settings_path(app: &AppHandle) -> Result<PathBuf, String> { Ok(app_directory(app)?.join("settings.json")) }

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Option<AppSettings>, String> { read_json(&settings_path(&app)?) }
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> { write_json(&settings_path(&app)?, &settings) }

#[tauri::command]
pub fn read_selected_file(path: String) -> Result<Vec<u8>, String> {
    require_extension(&path, &["pdf", "png"])?;
    fs::read(path).map_err(|error| format!("Unable to read the selected document: {error}"))
}
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    require_extension(&path, &["svg"])?;
    fs::read_to_string(path).map_err(|error| format!("Unable to read the selected SVG: {error}"))
}
#[tauri::command]
pub fn read_font_bytes(path: String) -> Result<Vec<u8>, String> {
    require_extension(&path, &["ttf", "otf"])?;
    fs::read(path).map_err(|error| format!("Unable to read the selected font: {error}"))
}
#[tauri::command]
pub fn write_export_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    require_extension(&path, &["pdf", "png"])?;
    if bytes.is_empty() { return Err("The export data is empty.".to_string()); }
    fs::write(path, bytes).map_err(|error| format!("Unable to write the export. Choose another location or verify write permission: {error}"))
}

fn validate_font(path: &str) -> Result<FontValidation, String> {
    require_extension(path, &["ttf", "otf"])?;
    let bytes = fs::read(path).map_err(|error| format!("Unable to read the font: {error}"))?;
    let face = Face::parse(&bytes, 0).map_err(|_| "The selected file is not a supported TTF/OTF font.".to_string())?;
    let required = ['ก', 'ำ', 'ส', 'ถ', 'ู', 'ก', 'ต'];
    let supports_thai = required.iter().all(|character| face.glyph_index(*character).is_some());
    let name = Path::new(path).file_stem().and_then(|item| item.to_str()).unwrap_or("Selected font").to_string();
    Ok(FontValidation { name, supports_thai })
}
#[tauri::command]
pub fn validate_font_path(path: String) -> Result<FontValidation, String> { validate_font(&path) }
#[tauri::command]
pub fn find_preferred_font() -> Option<PreferredFont> {
    let base = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
    let font_directory = Path::new(&base).join("Fonts");
    // Prefer TH Sarabun New, but Windows installations do not always include it.
    // These common Thai-capable Windows fonts keep exports working without setup.
    for file in ["THSarabunNew.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New.ttf", "LeelawUI.ttf", "LeelawUIb.ttf", "Tahoma.ttf"] {
        let path = font_directory.join(file);
        if path.exists() && validate_font(path.to_string_lossy().as_ref()).map(|font| font.supports_thai).unwrap_or(false) {
            return Some(PreferredFont { path: path.to_string_lossy().to_string(), name: path.file_stem()?.to_string_lossy().to_string() });
        }
    }
    // As a final fallback, locate any installed Thai-capable TTF/OTF font.
    for entry in fs::read_dir(&font_directory).ok()?.flatten() {
        let path = entry.path();
        let supported_type = path.extension().and_then(|item| item.to_str()).map(|item| matches!(item.to_ascii_lowercase().as_str(), "ttf" | "otf")).unwrap_or(false);
        if supported_type && validate_font(path.to_string_lossy().as_ref()).map(|font| font.supports_thai).unwrap_or(false) {
            return Some(PreferredFont { path: path.to_string_lossy().to_string(), name: path.file_stem()?.to_string_lossy().to_string() });
        }
    }
    None
}

#[tauri::command]
pub fn list_signatures(app: AppHandle) -> Result<Vec<SignatureMetadata>, String> { signatures::read_metadata(&app) }
#[tauri::command]
pub fn save_signature(app: AppHandle, id: String, name: String, svg: String) -> Result<SignatureMetadata, String> { signatures::save(&app, id, name, svg) }
#[tauri::command]
pub fn read_signature(app: AppHandle, id: String) -> Result<String, String> { signatures::load(&app, &id) }
#[tauri::command]
pub fn rename_signature(app: AppHandle, id: String, name: String) -> Result<(), String> { signatures::rename(&app, &id, name) }
#[tauri::command]
pub fn delete_signature(app: AppHandle, id: String) -> Result<(), String> { signatures::delete(&app, &id) }
#[tauri::command]
pub fn set_default_signature(app: AppHandle, id: String) -> Result<(), String> { signatures::set_default(&app, &id) }

#[cfg(test)]
mod tests {
    use super::require_extension;
    #[test]
    fn filesystem_commands_only_accept_expected_file_types() {
        assert!(require_extension("a.pdf", &["pdf", "png"]).is_ok());
        assert!(require_extension("a.exe", &["pdf", "png"]).is_err());
    }
}
