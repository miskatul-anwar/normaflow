//! Shared data-transfer types serialized across the Tauri IPC boundary.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct PipelineRecord {
    pub id: i64,
    pub file_count: i64,
    pub duration: String,
    pub erd_diagram: String,
    pub sql_statements: String,
    pub report_markdown: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InputFile {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EntityTag {
    pub column_name: String,
    pub table_name: String,
    pub entity_type: String,
    pub confidence: f64,
    pub sample_values: Vec<String>,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrossTableRelationship {
    pub source_table: String,
    pub source_column: String,
    pub target_table: String,
    pub target_column: String,
    pub cardinality: String,
    pub confidence: f64,
    pub match_ratio: f64,
    pub detected_by: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaInsight {
    pub insight_type: String,
    pub title: String,
    pub summary: String,
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutputFileDto {
    pub name: String,
    pub file_type: String,
    pub description: String,
    pub content: String,
    pub size: usize,
    pub category: String,
}

/// Per-column statistics gathered in a single streaming pass over a CSV.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ColumnProfile {
    pub null_or_empty: usize,
    pub distinct_estimate: usize,
    pub integer_count: usize,
    pub numeric_count: usize,
    pub date_count: usize,
    pub filled: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableDataDto {
    pub table_name: String,
    pub file_name: String,
    pub headers: Vec<String>,
    pub row_count: usize,
    pub skipped_rows: usize,
    pub primary_key: Vec<String>,
    pub ner_tags: Vec<EntityTag>,
    /// Inferred SQL type per header (same order as `headers`).
    pub column_types: Vec<String>,
    /// Bounded distinct-value sample per header (used for FK verification).
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub value_samples: Vec<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PipelineResult {
    pub success: bool,
    pub is_multi_table: bool,
    pub tables: Vec<TableDataDto>,
    pub cross_table_relationships: Vec<CrossTableRelationship>,
    pub ollama_insights: Vec<OllamaInsight>,
    pub output_files: Vec<OutputFileDto>,
    pub erd_diagram: String,
    pub sql_statements: String,
    pub report_markdown: String,
    pub duration: String,
    pub logs: Vec<String>,
}

// ---------------------------------------------------------------------------
// Ollama DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaTagsResponse {
    pub models: Option<Vec<OllamaModelItem>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModelItem {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaChatRequest {
    pub model: String,
    pub messages: Vec<OllamaMessage>,
    #[serde(default)]
    pub stream: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaChatResponse {
    pub message: Option<OllamaMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FlowGenerationResult {
    pub operations: Vec<String>,
    pub explanation: String,
}
