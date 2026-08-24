//! NormaFlow Rust core engine — orchestrates CSV parsing, NER tagging,
//! cross-table FK detection and artifact generation.
//!
//! Files are parsed **in parallel** using blocking worker threads; results are
//! streamed back as structured DTOs over the Tauri IPC bridge.

pub mod csv;
pub mod erd;
pub mod fk;
pub mod report;
pub mod sql;

use crate::types::{InputFile, OllamaInsight, PipelineResult};
use std::time::Instant;

/// Upper bound on file size we accept per CSV (32 MiB) to avoid OOM.
const MAX_FILE_BYTES: usize = 32 * 1024 * 1024;

fn process_one(file: &InputFile) -> Result<crate::types::TableDataDto, String> {
    if file.content.len() > MAX_FILE_BYTES {
        return Err(format!(
            "File '{}' exceeds the {} MiB limit",
            file.name,
            MAX_FILE_BYTES / (1024 * 1024)
        ));
    }
    csv::parse_table(file)
}

pub fn process_files(files: &[InputFile]) -> Result<PipelineResult, String> {
    let start = Instant::now();
    let mut logs = vec![format!(
        "[INFO] Rust Core Engine processing {} file(s)…",
        files.len()
    )];

    // Parallel parse: each file gets its own blocking thread.
    let handles: Vec<_> = files
        .iter()
        .map(|file| {
            let owned = file.clone();
            std::thread::spawn(move || process_one(&owned))
        })
        .collect();

    let mut tables = Vec::with_capacity(files.len());
    for handle in handles {
        match handle.join() {
            Ok(Ok(table)) => {
                logs.push(format!(
                    "[SUCCESS] Parsed '{}' as table '{}' ({} rows{}, {} columns)",
                    table.file_name,
                    table.table_name,
                    table.row_count,
                    if table.skipped_rows > 0 {
                        format!(", {} malformed rows skipped", table.skipped_rows)
                    } else {
                        String::new()
                    },
                    table.headers.len()
                ));
                tables.push(table);
            }
            Ok(Err(err)) => logs.push(format!("[WARN] Skipped file: {err}")),
            Err(_) => logs.push("[WARN] A parser worker panicked".to_string()),
        }
    }

    if tables.is_empty() {
        return Err("No valid CSV files could be parsed".to_string());
    }

    // Cross-table relationships (value-verified).
    let relationships = fk::detect_relationships(&tables);
    logs.push(format!(
        "[SUCCESS] Foreign-key detector found {} cross-table relationship(s)",
        relationships.len()
    ));

    // Artifacts.
    let erd_diagram = erd::generate_erd(&tables, &relationships);
    let sql_statements = sql::generate_sql(&tables, &relationships);
    let report_markdown = report::generate_report(&tables, &relationships);

    let duration = format!("{:.2}s", start.elapsed().as_secs_f64());
    logs.push(format!("[SUCCESS] Rust pipeline finished in {duration}"));

    let output_files = vec![
        crate::types::OutputFileDto {
            name: format!("{}_erd.mmd", tables[0].table_name),
            file_type: "mermaid".into(),
            description: "Entity-relationship diagram (Mermaid)".into(),
            size: erd_diagram.len(),
            category: "ERD".into(),
            content: erd_diagram.clone(),
        },
        crate::types::OutputFileDto {
            name: "consolidated_schema.sql".into(),
            file_type: "sql".into(),
            description: "Consolidated SQL DDL".into(),
            size: sql_statements.len(),
            category: "SQL".into(),
            content: sql_statements.clone(),
        },
        crate::types::OutputFileDto {
            name: "normalization_report.md".into(),
            file_type: "markdown".into(),
            description: "Normalization & relationship report".into(),
            size: report_markdown.len(),
            category: "Report".into(),
            content: report_markdown.clone(),
        },
    ];

    let insights = vec![OllamaInsight {
        insight_type: "RUST_ENGINE".into(),
        title: "Native engine summary".into(),
        summary: format!(
            "Parsed {} table(s), inferred column types from sampled values and verified foreign keys via value overlap.",
            tables.len()
        ),
        confidence: 0.99,
    }];

    Ok(PipelineResult {
        success: true,
        is_multi_table: tables.len() > 1,
        tables,
        cross_table_relationships: relationships,
        ollama_insights: insights,
        output_files,
        erd_diagram,
        sql_statements,
        report_markdown,
        duration,
        logs,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::InputFile;

    #[test]
    fn end_to_end_two_tables() {
        let files = vec![
            InputFile {
                name: "customers.csv".into(),
                content: "customer_id,name,email\n1,Alice,a@x.com\n2,Bob,b@x.com\n".into(),
            },
            InputFile {
                name: "orders.csv".into(),
                content: "order_id,customer_id,total\n100,1,9.99\n101,1,5.00\n102,2,7.25\n".into(),
            },
        ];
        let result = process_files(&files).expect("pipeline succeeds");
        assert!(result.success);
        assert_eq!(result.tables.len(), 2);
        assert!(!result.cross_table_relationships.is_empty());
        assert!(result.erd_diagram.starts_with("erDiagram"));
        assert!(result.sql_statements.contains("CREATE TABLE customers"));
        assert!(result.report_markdown.contains("# "));
        assert_eq!(
            result
                .tables
                .iter()
                .find(|t| t.table_name == "orders")
                .unwrap()
                .column_types,
            vec!["INTEGER", "INTEGER", "REAL"]
        );
    }

    #[test]
    fn fails_cleanly_with_no_valid_files() {
        let files = vec![InputFile {
            name: "x.csv".into(),
            content: String::new(),
        }];
        assert!(process_files(&files).is_err());
    }
}
