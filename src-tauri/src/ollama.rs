//! Ollama (local LLM) client.
//!
//! - Base URL configurable via the `OLLAMA_HOST` environment variable
//!   (defaults to `http://localhost:11434`).
//! - Hard timeouts so the UI never hangs on a stalled model server.
//! - Robust JSON extraction for structured prompts: models frequently wrap
//!   JSON in Markdown code fences or add prose around it.

use crate::types::{
    FlowGenerationResult, OllamaChatRequest, OllamaChatResponse, OllamaMessage, OllamaTagsResponse,
};
use std::time::Duration;

/// The fixed operation allow-list mirrored from `src/config/operations.ts`.
pub const ALLOWED_OPERATIONS: &[&str] = &[
    "CSV Data Loader",
    "Data Cleaner",
    "Atomicity Checker",
    "Data Type Profiler",
    "NER Classifier",
    "1NF",
    "FD Miner",
    "Key Discovery",
    "Relation Detector",
    "Ollama AI Analyst",
    "Cardinality Analyzer",
    "2NF",
    "3NF",
    "Lossless Check",
    "Dependency Preservation",
    "ERD Generator",
    "Relation Generator",
    "SQL Generator",
    "Report Generator",
];

pub fn base_url() -> String {
    std::env::var("OLLAMA_HOST")
        .ok()
        .filter(|h| !h.trim().is_empty())
        .map(|h| format_base_url(&h))
        .unwrap_or_else(|| "http://localhost:11434".to_string())
}

fn format_base_url(host: &str) -> String {
    let host = host.trim_end_matches('/');
    if host.starts_with("http://") || host.starts_with("https://") {
        host.to_string()
    } else {
        format!("http://{host}")
    }
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .build()
        .unwrap_or_default()
}

/// Remove reasoning-model thinking blocks (`<think>…</think>` and the legacy
/// `<thinking>…</thinking>` variant), including unterminated ones.
pub fn strip_think_tags(input: &str) -> String {
    let mut out = input.to_string();
    for tag in ["think", "thinking"] {
        let open = format!("<{tag}>");
        let close = format!("</{tag}>");
        if let Some(start) = out.find(&open) {
            match out.find(&close) {
                Some(end) => {
                    out = format!("{}{}", &out[..start], &out[end + close.len()..]);
                }
                None => {
                    // Unterminated think block — everything after `<think>` is reasoning.
                    out = out[..start].to_string();
                }
            }
        }
    }
    out.trim().to_string()
}

/// Extract the first balanced JSON object from arbitrary LLM output,
/// respecting string literals. Returns the substring including braces.
pub fn extract_json_object(input: &str) -> Option<&str> {
    let bytes = input.as_bytes();
    let start = input.find('{')?;
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (i, &b) in bytes.iter().enumerate().skip(start) {
        if in_string {
            if escaped {
                escaped = false;
            } else if b == b'\\' {
                escaped = true;
            } else if b == b'"' {
                in_string = false;
            }
            continue;
        }
        match b {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&input[start..=i]);
                }
            }
            _ => {}
        }
    }
    None
}

/// Validate and normalize an operation list against the allow-list.
/// Matching is case-insensitive; unknown entries are dropped, and the result
/// is returned in canonical pipeline order.
pub fn normalize_operations(operations: &[String]) -> Vec<String> {
    let canon: Vec<String> = ALLOWED_OPERATIONS.iter().map(|s| s.to_string()).collect();
    canon
        .into_iter()
        .filter(|canonical| {
            operations
                .iter()
                .any(|op| op.trim().eq_ignore_ascii_case(canonical))
        })
        .collect()
}

async fn chat_raw(model: &str, messages: Vec<OllamaMessage>) -> Result<String, String> {
    let url = format!("{}/api/chat", base_url());
    let body = OllamaChatRequest {
        model: model.to_string(),
        messages,
        stream: false,
    };

    let res = client()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed ({url}): {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", res.status()));
    }

    let parsed: OllamaChatResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse chat response: {e}"))?;

    Ok(parsed.message.map(|m| m.content).unwrap_or_default())
}

pub async fn list_models() -> Result<Vec<String>, String> {
    let url = format!("{}/api/tags", base_url());
    let res = client()
        .get(&url)
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Ollama offline ({url}): {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Ollama service returned HTTP {}", res.status()));
    }

    let tags: OllamaTagsResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse tags JSON: {e}"))?;

    Ok(tags
        .models
        .unwrap_or_default()
        .into_iter()
        .map(|m| m.name)
        .collect())
}

pub async fn chat(model: &str, messages: Vec<OllamaMessage>) -> Result<String, String> {
    let raw = chat_raw(model, messages).await?;
    Ok(strip_think_tags(&raw))
}

pub async fn generate_flow(model: &str, user_prompt: &str) -> Result<FlowGenerationResult, String> {
    let system_prompt = r#"You are NormaFlow Engine. Map the user's natural-language request to database normalization pipeline operations.

Allowed operations (use EXACT names):
CSV Data Loader, Data Cleaner, Atomicity Checker, Data Type Profiler, NER Classifier, 1NF, FD Miner, Key Discovery, Relation Detector, Ollama AI Analyst, Cardinality Analyzer, 2NF, 3NF, Lossless Check, Dependency Preservation, ERD Generator, Relation Generator, SQL Generator, Report Generator.

Respond with ONLY a JSON object, no prose, no code fences:
{"operations": ["CSV Data Loader", "..."], "explanation": "Short summary."}"#;

    let messages = vec![
        OllamaMessage {
            role: "system".into(),
            content: system_prompt.into(),
        },
        OllamaMessage {
            role: "user".into(),
            content: user_prompt.into(),
        },
    ];

    let raw = chat_raw(model, messages).await?;
    let cleaned = strip_think_tags(&raw);

    // Try direct parse first, then fenced/prose-wrapped extraction.
    let candidate = serde_json::from_str::<FlowGenerationResult>(&cleaned)
        .ok()
        .or_else(|| {
            extract_json_object(&cleaned)
                .and_then(|slice| serde_json::from_str::<FlowGenerationResult>(slice).ok())
        });

    if let Some(mut result) = candidate {
        result.operations = normalize_operations(&result.operations);
        if !result.operations.is_empty() {
            return Ok(result);
        }
    }

    Err(format!(
        "Model did not return a usable operation list. Raw response: {}",
        truncate(&raw, 300)
    ))
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let cut = s.char_indices().nth(max).map(|(i, _)| i).unwrap_or(max);
        format!("{}…", &s[..cut])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_think_tags_both_variants() {
        assert_eq!(strip_think_tags("<think>reasoning</think>answer"), "answer");
        assert_eq!(strip_think_tags("<thinking>r</thinking>ok"), "ok");
        assert_eq!(strip_think_tags("<think>dangling"), ""); // unterminated → nothing usable after
        assert_eq!(strip_think_tags("plain"), "plain");
    }

    #[test]
    fn extracts_json_from_fences_and_prose() {
        let fenced = "```json\n{\"a\": 1}\n```";
        assert_eq!(extract_json_object(fenced), Some("{\"a\": 1}"));

        let prose = "Sure! Here is your JSON: {\"ops\": [\"1NF\"]} hope that helps";
        assert_eq!(extract_json_object(prose), Some("{\"ops\": [\"1NF\"]}"));

        let nested = "{\"outer\": {\"inner\": \"has } brace\"}, \"after\": 1}";
        assert_eq!(
            extract_json_object(nested),
            Some("{\"outer\": {\"inner\": \"has } brace\"}, \"after\": 1}")
        );

        assert_eq!(extract_json_object("no json here"), None);
    }

    #[test]
    fn normalizes_operations_case_insensitively_in_canonical_order() {
        let ops: Vec<String> = vec![
            "sql generator".into(),
            "3nf".into(),
            "Bogus Op".into(),
            "csv data loader".into(),
        ];
        let normalized = normalize_operations(&ops);
        assert_eq!(normalized, vec!["CSV Data Loader", "3NF", "SQL Generator"]);
    }

    #[test]
    fn base_url_formatting() {
        assert_eq!(format_base_url("myhost:9999"), "http://myhost:9999");
        assert_eq!(format_base_url("http://h/"), "http://h");
        assert_eq!(format_base_url("https://secure:1"), "https://secure:1");
    }
}
