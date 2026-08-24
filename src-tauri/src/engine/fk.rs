//! Cross-table foreign-key detection.
//!
//! Two-phase strategy per candidate pair:
//! 1. *Name evidence* — column/table naming conventions (`customer_id` → `customers.id`).
//! 2. *Value verification* — sampled distinct values from both columns are
//!    intersected; the overlap ratio gates acceptance and feeds confidence.
//!
//! This avoids both false positives (same column name, unrelated data) and the
//! O(n²·m²) full scans of earlier revisions.

use crate::types::{CrossTableRelationship, TableDataDto};
use std::collections::HashSet;

/// Minimum value-overlap ratio (relative to the smaller side) to accept a
/// name-based candidate.
const MIN_OVERLAP_RATIO: f64 = 0.5;

fn name_candidate_score(
    source_column: &str,
    target_table: &str,
    target_column: &str,
) -> Option<f64> {
    let src_col = source_column.to_lowercase();
    let tgt_col = target_column.to_lowercase();

    if src_col == tgt_col && (src_col.ends_with("_id") || src_col == "id") {
        // Same-named id columns across tables: plausible shared key.
        return Some(0.6);
    }

    let tgt_singular = crate::ner::singularize(target_table);
    let expected = format!("{tgt_singular}_id");
    if src_col == expected {
        return Some(0.95);
    }
    // e.g. table `order_items`, column `orders_id`
    let tgt_plural = format!("{tgt_singular}s");
    if src_col == format!("{tgt_plural}_id") || src_col == format!("{tgt_singular}es_id") {
        return Some(0.9);
    }
    // Token-based fallback: `<target>_key` / `fk_<target>` style
    if src_col == format!("{tgt_singular}_key") || src_col == format!("fk_{tgt_singular}") {
        return Some(0.85);
    }

    None
}

/// Directed containment: fraction of the referencing sample that exists in the
/// referenced set. A true FK has near-complete containment.
fn containment(referencing: &HashSet<String>, referenced: &HashSet<String>) -> f64 {
    if referencing.is_empty() || referenced.is_empty() {
        return 0.0;
    }
    let hits = referencing
        .iter()
        .filter(|v| referenced.contains(*v))
        .count();
    hits as f64 / referencing.len() as f64
}

pub fn detect_relationships(tables: &[TableDataDto]) -> Vec<CrossTableRelationship> {
    let mut relationships: Vec<CrossTableRelationship> = Vec::new();

    let sets: Vec<Vec<HashSet<String>>> = tables
        .iter()
        .map(|t| {
            t.value_samples
                .iter()
                .map(|vals| vals.iter().cloned().collect())
                .collect()
        })
        .collect();

    for (si, source) in tables.iter().enumerate() {
        for (ti, target) in tables.iter().enumerate() {
            if si == ti {
                continue;
            }

            for (ci, s_col) in source.headers.iter().enumerate() {
                let s_lower = s_col.to_lowercase();
                for (cj, t_col) in target.headers.iter().enumerate() {
                    let t_lower = t_col.to_lowercase();

                    // Orientation: does this column reference the OTHER table,
                    // or vice versa? Evaluate both directions and keep the
                    // stronger evidence so we never emit backwards FKs.
                    let fwd = name_candidate_score(&s_lower, &target.table_name, &t_lower);
                    let rev = name_candidate_score(&t_lower, &source.table_name, &s_lower);

                    let Some(base_confidence) = fwd else { continue };
                    if rev.unwrap_or(0.0) > base_confidence + f64::EPSILON {
                        continue; // reversed orientation is stronger; handle it there
                    }

                    // Tie-break equal name scores (same-name columns) with
                    // directed value containment.
                    if let Some(rev_score) = rev {
                        if (rev_score - base_confidence).abs() <= f64::EPSILON {
                            let fwd_containment = containment(&sets[si][ci], &sets[ti][cj]);
                            let rev_containment = containment(&sets[ti][cj], &sets[si][ci]);
                            if rev_containment > fwd_containment {
                                continue;
                            }
                        }
                    }

                    let verified = !sets[si][ci].is_empty() && !sets[ti][cj].is_empty();
                    if verified {
                        let dir = containment(&sets[si][ci], &sets[ti][cj]);
                        if dir < MIN_OVERLAP_RATIO {
                            continue; // name matched but data disagrees
                        }
                    }

                    let confidence = if verified {
                        (base_confidence * 0.7 + containment(&sets[si][ci], &sets[ti][cj]) * 0.3)
                            .min(0.99)
                    } else {
                        base_confidence
                    };

                    // Cardinality from sample uniqueness of the referencing side.
                    let src_sampled = source.value_samples.get(ci).map(Vec::len).unwrap_or(0);
                    let unique_src = sets[si][ci].len();
                    let dir_ratio = containment(&sets[si][ci], &sets[ti][cj]);
                    let cardinality = if verified
                        && src_sampled > 0
                        && unique_src == src_sampled
                        && dir_ratio > 0.95
                    {
                        "1:1"
                    } else {
                        "1:N"
                    };

                    // Deduplicate symmetric duplicates.
                    let duplicate = relationships.iter().any(|existing| {
                        existing.source_table == target.table_name
                            && existing.target_table == source.table_name
                            && existing.source_column == *t_col
                            && existing.target_column == *s_col
                    });
                    if duplicate {
                        continue;
                    }

                    relationships.push(CrossTableRelationship {
                        source_table: source.table_name.clone(),
                        source_column: s_col.clone(),
                        target_table: target.table_name.clone(),
                        target_column: t_col.clone(),
                        cardinality: cardinality.to_string(),
                        confidence,
                        match_ratio: if verified {
                            containment(&sets[si][ci], &sets[ti][cj])
                        } else {
                            0.0
                        },
                        detected_by: if verified {
                            "NAME_AND_VALUE_OVERLAP".to_string()
                        } else {
                            "NAME_HEURISTIC".to_string()
                        },
                    });
                }
            }
        }
    }

    // Keep the strongest evidence per (source, source_column) pair.
    relationships.sort_by(|a, b| {
        b.confidence
            .partial_cmp(&a.confidence)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut seen: HashSet<(String, String)> = HashSet::new();
    relationships.retain(|r| seen.insert((r.source_table.clone(), r.source_column.clone())));

    relationships
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{EntityTag, InputFile};

    fn make_table(name: &str, headers: &[&str], samples: &[Vec<&str>]) -> TableDataDto {
        TableDataDto {
            table_name: name.into(),
            file_name: format!("{name}.csv"),
            headers: headers.iter().map(|s| s.to_string()).collect(),
            row_count: samples.first().map(|v| v.len()).unwrap_or(0),
            skipped_rows: 0,
            primary_key: vec![headers.first().map(|s| s.to_string()).unwrap_or_default()],
            ner_tags: Vec::<EntityTag>::new(),
            column_types: vec!["TEXT".into(); headers.len()],
            value_samples: samples
                .iter()
                .map(|col| col.iter().map(|s| s.to_string()).collect())
                .collect(),
        }
    }

    #[test]
    fn detects_fk_with_value_verification() {
        let customers = make_table(
            "customers",
            &["customer_id", "name"],
            &[vec!["1", "2", "3", "4"], vec!["a", "b", "c", "d"]],
        );
        let orders = make_table(
            "orders",
            &["order_id", "customer_id"],
            &[vec!["10", "11", "12", "13"], vec!["1", "1", "3", "9"]],
        );
        let rels = detect_relationships(&[customers, orders]);
        assert_eq!(rels.len(), 1, "{rels:?}");
        assert_eq!(rels[0].source_table, "orders");
        assert_eq!(rels[0].target_table, "customers");
        assert_eq!(rels[0].cardinality, "1:N");
        assert!(rels[0].detected_by.contains("VALUE"));
    }

    #[test]
    fn rejects_same_name_unrelated_values() {
        // Both tables have an `id`; values don't overlap at all except one.
        let a = make_table("employees", &["id"], &[vec!["100", "101", "102"]]);
        let b = make_table("products", &["id"], &[vec!["900", "901", "102"]]);
        let rels = detect_relationships(&[a, b]);
        // Overlap 1/3 < 0.5 → rejected despite matching name.
        assert!(rels.is_empty(), "{rels:?}");
    }

    #[test]
    fn deduplicates_symmetric_pairs() {
        let a = make_table("t1", &["x_id"], &[vec!["1", "2"]]);
        let b = make_table("t2", &["x_id"], &[vec!["1", "2"]]);
        let rels = detect_relationships(&[a.clone(), b.clone()]);
        assert_eq!(rels.len(), 1);
        let _ = InputFile {
            name: String::new(),
            content: String::new(),
        };
    }
}
