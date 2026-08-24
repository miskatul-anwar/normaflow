//! Mermaid ERD generation with strict identifier sanitization.

use crate::types::{CrossTableRelationship, TableDataDto};

/// True when the string looks like a calendar date in a common format.
pub fn is_date_like(v: &str) -> bool {
    let bytes = v.as_bytes();
    if v.len() >= 10
        && bytes.get(4) == Some(&b'-')
        && bytes.get(7) == Some(&b'-')
        && v[..4].chars().all(|c| c.is_ascii_digit())
    {
        return true;
    }
    if v.len() == 10 && (bytes.get(2) == Some(&b'/') || bytes.get(4) == Some(&b'/')) {
        return v
            .split(['/', '.'])
            .filter(|p| !p.is_empty())
            .all(|p| p.chars().all(|c| c.is_ascii_digit()));
    }
    false
}

/// Mermaid identifiers may only contain word characters.
pub fn sanitize_ident(s: &str) -> String {
    let out: String = s
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = out.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "col".to_string()
    } else {
        trimmed
    }
}

/// Mermaid attribute types are single word-like tokens; map inferred SQL types.
fn mermaid_type(sql_type: &str) -> String {
    match sql_type {
        "INTEGER" => "int".to_string(),
        "BIGINT" => "bigint".to_string(),
        "REAL" => "float".to_string(),
        "DATE" => "date".to_string(),
        _ => "varchar".to_string(),
    }
}

fn cardinality_symbol(cardinality: &str) -> &'static str {
    match cardinality {
        "1:1" => "||--||",
        "N:M" => "}o--o{",
        // default one-to-many: many side open circle
        _ => "}o--||",
    }
}

pub fn generate_erd(tables: &[TableDataDto], relationships: &[CrossTableRelationship]) -> String {
    let mut out = String::from("erDiagram\n");

    for table in tables {
        let t_name = sanitize_ident(&table.table_name);
        out.push_str(&format!("    {t_name} {{\n"));
        for (idx, header) in table.headers.iter().enumerate() {
            let col = sanitize_ident(header);
            let col_type = mermaid_type(
                table
                    .column_types
                    .get(idx)
                    .map(String::as_str)
                    .unwrap_or("TEXT"),
            );
            let mut key_tag = "";
            if table.primary_key.iter().any(|pk| sanitize_ident(pk) == col) {
                key_tag = " PK";
            } else if relationships.iter().any(|r| {
                r.source_table == table.table_name && sanitize_ident(&r.source_column) == col
            }) {
                key_tag = " FK";
            }
            out.push_str(&format!("        {col_type} {col}{key_tag}\n"));
        }
        out.push_str("    }\n");
    }

    for rel in relationships {
        let src = sanitize_ident(&rel.source_table);
        let tgt = sanitize_ident(&rel.target_table);
        let label = format!(
            "{} to {}",
            sanitize_ident(&rel.source_column),
            sanitize_ident(&rel.target_column)
        );
        out.push_str(&format!(
            "    {src} {} {tgt} : \"{label}\"\n",
            cardinality_symbol(&rel.cardinality)
        ));
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::EntityTag;

    fn sample_table() -> TableDataDto {
        TableDataDto {
            table_name: "customers".into(),
            file_name: "customers.csv".into(),
            headers: vec!["id".into(), "full name".into(), "email".into()],
            row_count: 3,
            skipped_rows: 0,
            primary_key: vec!["id".into()],
            ner_tags: vec![
                EntityTag {
                    column_name: "id".into(),
                    table_name: "customers".into(),
                    entity_type: "PRIMARY_KEY_ID".into(),
                    confidence: 0.95,
                    sample_values: vec![],
                    description: "Primary key identifier".into(),
                },
                EntityTag {
                    column_name: "full name".into(),
                    table_name: "customers".into(),
                    entity_type: "PERSON_NAME".into(),
                    confidence: 0.8,
                    sample_values: vec![],
                    description: "Person name".into(),
                },
                EntityTag {
                    column_name: "email".into(),
                    table_name: "customers".into(),
                    entity_type: "EMAIL".into(),
                    confidence: 0.9,
                    sample_values: vec![],
                    description: "E-mail address".into(),
                },
            ],
            column_types: vec!["INTEGER".into(), "TEXT".into(), "TEXT".into()],
            value_samples: vec![vec![], vec![], vec![]],
        }
    }

    #[test]
    fn erd_is_sanitized_and_typed() {
        let erd = generate_erd(&[sample_table()], &[]);
        assert!(erd.contains("erDiagram"));
        assert!(erd.contains("int id PK")); // no trailing space before newline
        assert!(erd.contains("varchar full_name"));
        assert!(!erd.contains("PK \n")); // regression: trailing space after empty tag
        assert!(!erd.contains("full name")); // spaces sanitized
    }

    #[test]
    fn relationship_lines_use_symbols() {
        let rel = CrossTableRelationship {
            source_table: "orders".into(),
            source_column: "customer_id".into(),
            target_table: "customers".into(),
            target_column: "id".into(),
            cardinality: "1:N".into(),
            confidence: 0.9,
            match_ratio: 1.0,
            detected_by: "VALUE_OVERLAP".into(),
        };
        let erd = generate_erd(&[], &[rel]);
        assert!(
            erd.contains("orders }o--|| customers : \"customer_id to id\""),
            "{erd}"
        );
    }

    #[test]
    fn date_like_helpers() {
        assert!(is_date_like("2025-01-01"));
        assert!(!is_date_like("nope"));
    }
}
