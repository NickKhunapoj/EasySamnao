mod commands;
mod signatures;
mod storage;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            read_selected_file,
            read_text_file,
            read_font_bytes,
            write_export_file,
            find_preferred_font,
            validate_font_path,
            list_signatures,
            save_signature,
            read_signature,
            rename_signature,
            delete_signature,
            set_default_signature
        ])
        .run(tauri::generate_context!())
        .expect("error while running EasySamnao");
}
