//! Optional natural-language support: embeddings from a **local** Ollama server.
//!
//! This is the only network use in the app and it is restricted to loopback
//! addresses. Only the user's command text and fixed example phrases are sent;
//! never CSV contents, headers or file names (the webview never passes them).

use reqwest::Url;
use std::net::IpAddr;
use std::time::Duration;

#[derive(serde::Deserialize)]
struct EmbedResp {
    embeddings: Vec<Vec<f32>>,
}

/// True only for plain-`http` URLs to `localhost`, `127.x.x.x` or `[::1]`
/// without embedded credentials.
pub fn is_loopback_url(url: &Url) -> bool {
    if url.scheme() != "http" || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    match url.host_str() {
        Some(host) if host.eq_ignore_ascii_case("localhost") => true,
        Some(host) => host
            .trim_start_matches('[')
            .trim_end_matches(']')
            .parse::<IpAddr>()
            .map(|ip| ip.is_loopback())
            .unwrap_or(false),
        None => false,
    }
}

/// Embed `inputs` with `model` through Ollama's `/api/embed`.
#[tauri::command]
pub async fn embed_texts(
    base_url: String,
    model: String,
    inputs: Vec<String>,
) -> Result<Vec<Vec<f32>>, String> {
    let base = Url::parse(&base_url).map_err(|e| format!("Invalid Ollama URL: {e}"))?;
    if !is_loopback_url(&base) {
        return Err(
            "Only loopback Ollama hosts (http://localhost, 127.0.0.1, [::1]) are allowed".into(),
        );
    }
    if inputs.is_empty() {
        return Ok(Vec::new());
    }
    let endpoint = base.join("api/embed").map_err(|e| e.to_string())?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(endpoint)
        .json(&serde_json::json!({ "model": model, "input": inputs }))
        .send()
        .await
        .map_err(|e| format!("Ollama unreachable: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "Ollama returned {} (is the model pulled? `ollama pull {}`)",
            resp.status(),
            model
        ));
    }
    let body = resp.json::<EmbedResp>().await.map_err(|e| e.to_string())?;
    if body.embeddings.len() != inputs.len() {
        return Err("Ollama returned an unexpected number of embeddings".into());
    }
    Ok(body.embeddings)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(s: &str) -> bool {
        is_loopback_url(&Url::parse(s).unwrap())
    }

    #[test]
    fn accepts_loopback_hosts() {
        assert!(ok("http://localhost:11434"));
        assert!(ok("http://LOCALHOST:11434/"));
        assert!(ok("http://127.0.0.1:11434"));
        assert!(ok("http://127.1.2.3:11434"));
        assert!(ok("http://[::1]:11434"));
    }

    #[test]
    fn rejects_everything_else() {
        assert!(!ok("http://example.com"));
        assert!(!ok("http://192.168.1.5:11434"));
        assert!(!ok("http://0.0.0.0:11434"));
        assert!(!ok("https://localhost:11434"));
        assert!(!ok("http://localhost.evil.com"));
        assert!(!ok("http://user:pw@localhost:11434"));
        assert!(!ok("http://127.0.0.1.evil.com"));
    }
}
