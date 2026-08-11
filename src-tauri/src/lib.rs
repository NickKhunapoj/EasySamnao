mod commands;
mod certificates;
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
            set_default_signature,
            list_certificates,
            create_certificate,
            inspect_pkcs12,
            import_pkcs12,
            discover_windows_certificates,
            bind_certificate_signature,
            certificate_binding_state,
            set_certificate_status,
            export_certificate_file,
            export_certificate_pkcs12,
            remove_certificate_profile,
            delete_certificate_from_windows,
            sign_prepared_pdf,
            verify_pdf_signatures
        ])
        .run(tauri::generate_context!())
        .expect("error while running EasySamnao");
}
