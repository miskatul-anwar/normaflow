//! SQLite-backed pipeline history (in-memory by design — nothing leaves the
//! user's machine).

use crate::types::PipelineRecord;
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct DbState {
    pub pool: Arc<Mutex<Option<Pool<Sqlite>>>>,
}

impl Default for DbState {
    fn default() -> Self {
        Self {
            pool: Arc::new(Mutex::new(None)),
        }
    }
}

pub async fn init_pool(state: &DbState) -> Result<String, String> {
    let mut guard = state.pool.lock().await;
    if guard.is_none() {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect("sqlite::memory:")
            .await
            .map_err(|e| format!("Failed to create SQLite pool: {e}"))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS pipeline_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_count INTEGER NOT NULL,
                duration TEXT NOT NULL,
                erd_diagram TEXT NOT NULL,
                sql_statements TEXT NOT NULL,
                report_markdown TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to initialize database schema: {e}"))?;

        *guard = Some(pool);
    }
    Ok("Database initialized successfully".into())
}

pub async fn save_record(
    state: &DbState,
    file_count: i64,
    duration: String,
    erd_diagram: String,
    sql_statements: String,
    report_markdown: String,
) -> Result<i64, String> {
    let guard = state.pool.lock().await;
    let pool = guard.as_ref().ok_or("Database pool not initialized")?;

    let res = sqlx::query(
        "INSERT INTO pipeline_history (file_count, duration, erd_diagram, sql_statements, report_markdown)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(file_count)
    .bind(duration)
    .bind(erd_diagram)
    .bind(sql_statements)
    .bind(report_markdown)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to insert pipeline record: {e}"))?;

    Ok(res.last_insert_rowid())
}

pub async fn get_history(state: &DbState) -> Result<Vec<PipelineRecord>, String> {
    let guard = state.pool.lock().await;
    let pool = guard.as_ref().ok_or("Database pool not initialized")?;

    let records = sqlx::query_as::<_, PipelineRecord>(
        "SELECT id, file_count, duration, erd_diagram, sql_statements, report_markdown,
                datetime(created_at) AS created_at
         FROM pipeline_history
         ORDER BY id DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch pipeline history: {e}"))?;

    Ok(records)
}
