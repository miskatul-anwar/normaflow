//! NormaFlow — Tauri application entry point.
//!
//! Module layout:
//! - [`types`]    — IPC DTOs shared with the frontend
//! - [`db`]       — SQLite pipeline history
//! - [`ollama`]   — local LLM client (configurable via `OLLAMA_HOST`)
//! - [`engine`]   — CSV parsing, NER, FK detection, ERD/SQL/report generation

mod db;
mod engine;
mod ner;
mod ollama;
mod types;

pub use types::*;

#[tauri::command]
async fn init_database(state: tauri::State<'_, db::DbState>) -> Result<String, String> {
    db::init_pool(&state).await
}

#[tauri::command]
async fn save_pipeline_record(
    state: tauri::State<'_, db::DbState>,
    file_count: i64,
    duration: String,
    erd_diagram: String,
    sql_statements: String,
    report_markdown: String,
) -> Result<i64, String> {
    db::save_record(
        &state,
        file_count,
        duration,
        erd_diagram,
        sql_statements,
        report_markdown,
    )
    .await
}

#[tauri::command]
async fn get_pipeline_history(
    state: tauri::State<'_, db::DbState>,
) -> Result<Vec<PipelineRecord>, String> {
    db::get_history(&state).await
}

#[tauri::command]
async fn check_ollama_status() -> Result<Vec<String>, String> {
    ollama::list_models().await
}

/// Full-conversation chat. The frontend sends the complete message history —
/// earlier revisions silently dropped it.
#[tauri::command]
async fn chat_ollama(model: String, messages: Vec<OllamaMessage>) -> Result<String, String> {
    ollama::chat(&model, messages).await
}

#[tauri::command]
async fn generate_flow_ollama(
    model: String,
    user_prompt: String,
) -> Result<FlowGenerationResult, String> {
    ollama::generate_flow(&model, &user_prompt).await
}

/// High-speed native pipeline: parse → profile → relate → generate artifacts.
#[tauri::command]
async fn process_multi_csv_rust(
    files: Vec<InputFile>,
    _selected_operations: Vec<String>,
) -> Result<PipelineResult, String> {
    // Parsing is CPU-bound; keep the async runtime responsive by offloading.
    tauri::async_runtime::spawn_blocking(move || engine::process_files(&files))
        .await
        .map_err(|e| format!("Engine worker failed: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(db::DbState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init_database,
            save_pipeline_record,
            get_pipeline_history,
            check_ollama_status,
            chat_ollama,
            generate_flow_ollama,
            process_multi_csv_rust
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
