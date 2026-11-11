//! NormaFlow — Tauri application entry point.
//!
//! All analysis (CSV parsing, functional-dependency mining, normalization,
//! foreign-key detection, ERD/SQL/report generation) runs in the TypeScript
//! engine inside the webview, so one implementation serves the desktop app
//! and browser development. The native shell only hosts the window.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
