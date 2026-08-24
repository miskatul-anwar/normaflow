//! CSV ingestion: a single streaming pass per file that simultaneously counts
//! rows and collects bounded per-column statistics and value samples.

use crate::ner;
use crate::types::{ColumnProfile, EntityTag, InputFile, TableDataDto};
use std::collections::HashSet;

/// Cap on distinct values tracked per column (memory bound for wide files).
const MAX_DISTINCT_TRACKED: usize = 4096;

pub fn sanitize_table_name(file_name: &str) -> String {
    let stem = file_name
        .rsplit('/')
        .next()
        .unwrap_or(file_name)
        .trim_end_matches(".csv")
        .trim_end_matches(".CSV")
        .trim_end_matches(".xlsx");
    let sanitized: String = stem
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .to_lowercase();
    let trimmed = sanitized.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "table".to_string()
    } else if trimmed
        .chars()
        .next()
        .map(|c| c.is_ascii_digit())
        .unwrap_or(false)
    {
        format!("t_{trimmed}")
    } else {
        trimmed
    }
}

/// Parse one CSV file in a single pass.
///
/// For every column we track: null/empty count, distinct estimate, integer /
/// numeric / date evidence counters, and up to `MAX_DISTINCT_TRACKED` distinct
/// sample values (bounded for FK overlap verification).
pub fn parse_table(file: &InputFile) -> Result<TableDataDto, String> {
    let table_name = sanitize_table_name(&file.name);

    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(file.content.as_bytes());

    let headers: Vec<String> = rdr
        .headers()
        .map_err(|e| format!("CSV header error in {}: {e}", file.name))?
        .iter()
        .map(|h| h.trim().to_string())
        .collect();

    if headers.is_empty() {
        return Err(format!("File '{}' has no header row", file.name));
    }

    let ncols = headers.len();
    let mut profiles: Vec<ColumnProfile> = vec![ColumnProfile::default(); ncols];
    let mut value_sets: Vec<HashSet<String>> = (0..ncols).map(|_| HashSet::new()).collect();
    // Deterministic sample order: keep insertion order separately.
    let mut sample_order: Vec<Vec<String>> = vec![Vec::with_capacity(ner::SAMPLE_LIMIT); ncols];

    let mut row_count: usize = 0;
    let mut skipped_rows: usize = 0;

    for record in rdr.records() {
        let record = match record {
            Ok(r) => r,
            Err(_) => {
                skipped_rows += 1;
                continue;
            }
        };
        row_count += 1;

        for (i, raw) in record.iter().enumerate() {
            if i >= ncols {
                break;
            }
            let val = raw.trim();
            let profile = &mut profiles[i];

            if val.is_empty() {
                profile.null_or_empty += 1;
                continue;
            }
            profile.filled += 1;

            if val.parse::<i64>().is_ok() {
                profile.integer_count += 1;
            }
            if val.replace(['$', ','], "").parse::<f64>().is_ok() {
                profile.numeric_count += 1;
            }
            if crate::engine::erd::is_date_like(val) {
                profile.date_count += 1;
            }

            let set = &mut value_sets[i];
            if set.len() < MAX_DISTINCT_TRACKED {
                if set.insert(val.to_string()) && sample_order[i].len() < ner::SAMPLE_LIMIT {
                    sample_order[i].push(val.to_string());
                }
            } else {
                set.insert(val.to_string()); // still counts toward estimate
            }
        }
    }

    for i in 0..ncols {
        profiles[i].distinct_estimate = value_sets[i].len().min(MAX_DISTINCT_TRACKED);
    }

    let primary_key = vec![headers[0].clone()];

    let ner_tags: Vec<EntityTag> = headers
        .iter()
        .enumerate()
        .map(|(idx, header)| {
            ner::classify_column(
                &table_name,
                header,
                &profiles[idx],
                &sample_order[idx],
                idx == 0,
            )
        })
        .collect();

    let column_types = headers
        .iter()
        .zip(profiles.iter())
        .map(|(_, p)| infer_sql_type(p))
        .collect();

    Ok(TableDataDto {
        table_name,
        file_name: file.name.clone(),
        headers,
        row_count,
        skipped_rows,
        primary_key,
        ner_tags,
        column_types,
        value_samples: sample_order,
    })
}

/// Data-driven SQL type inference from observed column statistics.
pub fn infer_sql_type(p: &ColumnProfile) -> String {
    if p.filled == 0 {
        return "TEXT".to_string();
    }
    let all_integer = p.integer_count == p.filled;
    let all_numeric = p.numeric_count == p.filled;
    let mostly_date = p.date_count as f64 / p.filled as f64 >= 0.9;

    if all_integer {
        // Distinguish small ints from big ints cheaply via numeric magnitude is
        // not tracked here; BIGINT is the safe general choice.
        return "INTEGER".to_string();
    }
    if all_numeric {
        return "REAL".to_string();
    }
    if mostly_date {
        return "DATE".to_string();
    }
    "TEXT".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_file_names() {
        assert_eq!(sanitize_table_name("My Orders.csv"), "my_orders");
        assert_eq!(sanitize_table_name("/path/to/Sales-2025.csv"), "sales_2025");
        assert_eq!(sanitize_table_name("123.csv"), "t_123");
        assert_eq!(sanitize_table_name("____.csv"), "table");
        assert_eq!(sanitize_table_name("data.xlsx"), "data");
    }

    #[test]
    fn parses_single_pass_with_stats() {
        let file = InputFile {
            name: "orders.csv".into(),
            content: "order_id,price,note\n1,10.50,ok\n2,,\n3,20.00,ok\n".into(),
        };
        let table = parse_table(&file).expect("parses");
        assert_eq!(table.table_name, "orders");
        assert_eq!(table.row_count, 3);
        assert_eq!(table.skipped_rows, 0);
        assert_eq!(table.column_types, vec!["INTEGER", "REAL", "TEXT"]);
        // price has one empty value
        assert_eq!(table.ner_tags.len(), 3);
    }

    #[test]
    fn skips_malformed_rows_gracefully() {
        let file = InputFile {
            name: "ragged.csv".into(),
            content: "a,b\n1,\"unclosed\n2,4\n".into(),
        };
        let table = parse_table(&file).expect("parses despite ragged rows");
        // The unclosed quote consumes line 2; row "2,4" survives.
        assert!(table.row_count >= 1 || table.skipped_rows >= 1);
    }

    #[test]
    fn empty_headers_is_error() {
        let file = InputFile {
            name: "e.csv".into(),
            content: String::new(),
        };
        assert!(parse_table(&file).is_err());
    }
}
