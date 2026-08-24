//! Semantic column classification (NER-style) combining column-name evidence
//! with value-pattern evidence. Pure functions, unit-testable.

use crate::types::{ColumnProfile, EntityTag};

/// Maximum number of sample values retained per column.
pub const SAMPLE_LIMIT: usize = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityType {
    PrimaryKeyId,
    ForeignKeyRef,
    PersonName,
    Email,
    Url,
    Uuid,
    Phone,
    LocationAddress,
    DateTimestamp,
    CurrencyPrice,
    NumericMetric,
    OrganizationCompany,
    ProductItem,
    CategoryType,
    BooleanFlag,
    GeneralText,
}

impl EntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityType::PrimaryKeyId => "PRIMARY_KEY_ID",
            EntityType::ForeignKeyRef => "FOREIGN_KEY_REF",
            EntityType::PersonName => "PERSON_NAME",
            EntityType::Email => "EMAIL",
            EntityType::Url => "URL",
            EntityType::Uuid => "UUID",
            EntityType::Phone => "PHONE_NUMBER",
            EntityType::LocationAddress => "LOCATION_ADDRESS",
            EntityType::DateTimestamp => "DATE_TIMESTAMP",
            EntityType::CurrencyPrice => "CURRENCY_PRICE",
            EntityType::NumericMetric => "NUMERIC_METRIC",
            EntityType::OrganizationCompany => "ORGANIZATION_COMPANY",
            EntityType::ProductItem => "PRODUCT_ITEM",
            EntityType::CategoryType => "CATEGORY_TYPE",
            EntityType::BooleanFlag => "BOOLEAN_FLAG",
            EntityType::GeneralText => "GENERAL_TEXT",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            EntityType::PrimaryKeyId => "Primary key identifier",
            EntityType::ForeignKeyRef => "Foreign key reference",
            EntityType::PersonName => "Person name",
            EntityType::Email => "E-mail address",
            EntityType::Url => "URL / web address",
            EntityType::Uuid => "UUID identifier",
            EntityType::Phone => "Phone number",
            EntityType::LocationAddress => "Location or address component",
            EntityType::DateTimestamp => "Date or timestamp",
            EntityType::CurrencyPrice => "Currency / monetary amount",
            EntityType::NumericMetric => "Numeric measure",
            EntityType::OrganizationCompany => "Organization / company",
            EntityType::ProductItem => "Product or item title",
            EntityType::CategoryType => "Categorical label (low cardinality)",
            EntityType::BooleanFlag => "Boolean-like flag",
            EntityType::GeneralText => "Text attribute",
        }
    }
}

/// Tokenize a column/table name: snake_case, kebab-case, camelCase and spaces.
pub fn tokenize_name(name: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    for ch in name.chars() {
        if ch == '_' || ch == '-' || ch == ' ' || ch == '.' {
            if !current.is_empty() {
                tokens.push(current.to_lowercase());
                current.clear();
            }
        } else if ch.is_uppercase() && !current.is_empty() {
            tokens.push(current.to_lowercase());
            current.clear();
            current.push(ch);
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        tokens.push(current.to_lowercase());
    }
    tokens.retain(|t| !t.is_empty());
    tokens
}

/// Naive English singularization — strips ONLY a trailing plural 's' when the
/// word is long enough to remain meaningful.
pub fn singularize(word: &str) -> String {
    let lower = word.to_lowercase();
    if lower.len() > 3
        && lower.ends_with('s')
        && !lower.ends_with("ss")
        && !lower.ends_with("us")
        && !lower.ends_with("is")
    {
        lower[..lower.len() - 1].to_string()
    } else {
        lower
    }
}

fn is_likely_id_token(tokens: &[String]) -> bool {
    tokens.iter().any(|t| {
        t == "id"
            || t == "uuid"
            || t == "guid"
            || t == "key"
            || t == "code"
            || t == "no"
            || t == "num"
            || t == "number"
    })
}

fn name_score(table: &str, column: &str) -> (EntityType, f64) {
    let col_tokens = tokenize_name(column);
    if col_tokens.is_empty() {
        return (EntityType::GeneralText, 0.3);
    }

    let table_singular = singularize(table);
    let joined = col_tokens.join("_");

    // Primary key: exactly `id`, `<table>_id`, or `<table>_<something>_id`.
    if joined == "id" {
        return (EntityType::PrimaryKeyId, 0.95);
    }
    if col_tokens.last().map(|t| t.as_str()) == Some("id") {
        // e.g. customer_id inside table `customers` → PK of that table
        if joined == format!("{table_singular}_id")
            || col_tokens.len() == 2 && col_tokens[0] == table_singular
        {
            return (EntityType::PrimaryKeyId, 0.9);
        }
        return (EntityType::ForeignKeyRef, 0.9);
    }
    if is_likely_id_token(&col_tokens) {
        return (EntityType::ForeignKeyRef, 0.75);
    }

    let has = |needles: &[&str]| col_tokens.iter().any(|t| needles.contains(&t.as_str()));

    if has(&["email", "mail", "e_mail"]) {
        return (EntityType::Email, 0.95);
    }
    if has(&["url", "link", "website", "homepage"]) {
        return (EntityType::Url, 0.9);
    }
    if has(&["uuid", "guid"]) {
        return (EntityType::Uuid, 0.95);
    }
    if has(&["phone", "mobile", "tel", "telephone", "fax"]) {
        return (EntityType::Phone, 0.92);
    }
    if has(&[
        "first_name",
        "lastname",
        "last_name",
        "fullname",
        "full_name",
    ]) || col_tokens.contains(&"name".to_string())
        && !has(&[
            "product", "item", "company", "file", "table", "column", "field",
        ])
    {
        return (EntityType::PersonName, 0.85);
    }
    if has(&[
        "date",
        "time",
        "created",
        "updated",
        "deleted",
        "timestamp",
        "dob",
        "birthday",
        "expires",
        "expiry",
    ]) || joined.ends_with("_at")
        || joined.ends_with("_on")
        || joined.ends_with("_date")
        || joined.ends_with("_time")
    {
        return (EntityType::DateTimestamp, 0.9);
    }
    if has(&[
        "price", "amount", "cost", "total", "subtotal", "revenue", "salary", "fee", "payment",
        "discount", "balance",
    ]) {
        return (EntityType::CurrencyPrice, 0.88);
    }
    if has(&[
        "city",
        "state",
        "country",
        "address",
        "street",
        "zip",
        "zipcode",
        "postal",
        "location",
        "latitude",
        "longitude",
        "region",
    ]) {
        return (EntityType::LocationAddress, 0.85);
    }
    if has(&[
        "company",
        "org",
        "organization",
        "vendor",
        "supplier",
        "brand",
        "manufacturer",
        "publisher",
        "studio",
    ]) {
        return (EntityType::OrganizationCompany, 0.85);
    }
    if has(&[
        "product", "item", "title", "sku", "book", "movie", "song", "article",
    ]) {
        return (EntityType::ProductItem, 0.8);
    }
    if has(&[
        "type", "category", "status", "kind", "genre", "priority", "level", "tier", "stage",
        "severity",
    ]) {
        return (EntityType::CategoryType, 0.78);
    }
    if has(&[
        "is_",
        "has_",
        "active",
        "enabled",
        "verified",
        "deleted_flag",
    ]) || joined.starts_with("is_")
        || joined.starts_with("has_")
    {
        return (EntityType::BooleanFlag, 0.7);
    }
    if has(&[
        "count",
        "qty",
        "quantity",
        "stock",
        "score",
        "rating",
        "age",
        "year",
        "views",
        "likes",
        "downloads",
    ]) {
        return (EntityType::NumericMetric, 0.8);
    }

    // Fallback: same token as the table name suggests an entity-titled text col.
    let table_tokens = tokenize_name(&table_singular);
    if col_tokens.iter().any(|t| table_tokens.contains(t)) {
        return (EntityType::ProductItem, 0.6);
    }

    (EntityType::GeneralText, 0.4)
}

fn looks_like_email(v: &str) -> bool {
    let parts: Vec<&str> = v.split('@').collect();
    parts.len() == 2
        && !parts[0].is_empty()
        && parts[1].contains('.')
        && !v.contains(char::is_whitespace)
}

fn looks_like_url(v: &str) -> bool {
    v.starts_with("http://") || v.starts_with("https://") || v.starts_with("www.")
}

fn looks_like_uuid(v: &str) -> bool {
    v.len() == 36
        && v.chars().enumerate().all(|(i, c)| {
            if matches!(i, 8 | 13 | 18 | 23) {
                c == '-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
}

fn looks_like_phone(v: &str) -> bool {
    let digits = v.chars().filter(|c| c.is_ascii_digit()).count();
    (7..=15).contains(&digits)
        && v.chars()
            .all(|c| c.is_ascii_digit() || "+()- .".contains(c))
}

fn looks_like_date(v: &str) -> bool {
    // ISO yyyy-mm-dd[ hh:mm[:ss]]
    let bytes = v.as_bytes();
    if v.len() >= 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && v[..4].chars().all(|c| c.is_ascii_digit())
        && v[5..7].chars().all(|c| c.is_ascii_digit())
        && v[8..10].chars().all(|c| c.is_ascii_digit())
    {
        return true;
    }
    // dd/mm/yyyy or mm/dd/yyyy
    if v.len() == 10 && (bytes[2] == b'/' || bytes[4] == b'/') {
        return v
            .split(['/', '.'])
            .filter(|p| !p.is_empty())
            .all(|p| p.chars().all(|c| c.is_ascii_digit()));
    }
    // RFC-ish textual month, e.g. "Jan 5, 2025"
    if v.len() >= 8
        && v.chars()
            .next()
            .map(|c| c.is_ascii_alphabetic())
            .unwrap_or(false)
        && v.contains(',')
    {
        return true;
    }
    false
}

fn looks_like_integer(v: &str) -> bool {
    let s = v.strip_prefix(['+', '-']).unwrap_or(v);
    !s.is_empty() && s.chars().all(|c| c.is_ascii_digit())
}

fn looks_like_numeric(v: &str) -> bool {
    let cleaned = v.replace(['$', ','], "");
    cleaned.parse::<f64>().is_ok() && cleaned.chars().any(|c| c.is_ascii_digit())
}

fn looks_like_boolean(v: &str) -> bool {
    matches!(
        v.to_lowercase().as_str(),
        "true" | "false" | "yes" | "no" | "y" | "n" | "0" | "1"
    )
}

/// Value-based evidence: returns candidate types with a ratio of matching samples.
fn value_scores(
    samples: &[String],
    filled: usize,
    distinct_estimate: usize,
) -> Vec<(EntityType, f64)> {
    if filled == 0 || samples.is_empty() {
        return vec![];
    }
    let n = samples.len() as f64;
    let mut scores = Vec::new();
    let ratio = |count: usize| count as f64 / n;

    let email = samples.iter().filter(|s| looks_like_email(s)).count();
    if email > 0 {
        scores.push((EntityType::Email, ratio(email)));
    }
    let url = samples.iter().filter(|s| looks_like_url(s)).count();
    if url > 0 {
        scores.push((EntityType::Url, ratio(url)));
    }
    let uuid = samples.iter().filter(|s| looks_like_uuid(s)).count();
    if uuid > 0 {
        scores.push((EntityType::Uuid, ratio(uuid)));
    }
    let phone = samples.iter().filter(|s| looks_like_phone(s)).count();
    if phone > 0 {
        scores.push((EntityType::Phone, ratio(phone)));
    }
    let date = samples.iter().filter(|s| looks_like_date(s)).count();
    if date > 0 {
        scores.push((EntityType::DateTimestamp, ratio(date)));
    }
    let boolean = samples.iter().filter(|s| looks_like_boolean(s)).count();
    if boolean > 0 {
        scores.push((EntityType::BooleanFlag, ratio(boolean)));
    }
    let numeric = samples.iter().filter(|s| looks_like_numeric(s)).count();
    if numeric > 0 {
        scores.push((EntityType::NumericMetric, ratio(numeric)));
    }

    // Low cardinality relative to filled rows → categorical.
    if distinct_estimate > 0
        && distinct_estimate <= 32
        && (distinct_estimate as f64) < (filled as f64 * 0.25)
    {
        scores.push((EntityType::CategoryType, 0.85));
    }
    // Very high cardinality integer columns behave like identifiers.
    let integers = samples.iter().filter(|s| looks_like_integer(s)).count();
    if integers > 0
        && ratio(integers) >= 0.95
        && distinct_estimate > 0
        && (distinct_estimate as f64) > (filled as f64 * 0.85)
    {
        scores.push((EntityType::ForeignKeyRef, 0.55));
    }

    scores
}

/// Fuse name-based prior with value-based evidence into one classification.
pub fn classify_column(
    table: &str,
    column: &str,
    profile: &ColumnProfile,
    samples: &[String],
    is_first_column: bool,
) -> EntityTag {
    let (name_type, name_conf) = name_score(table, column);

    // A unique first column that also looks like a numeric id is a strong PK signal.
    let high_cardinality = profile.distinct_estimate > 0
        && (profile.distinct_estimate as f64) >= (profile.filled.max(1) as f64) * 0.95;

    let mut best_type = name_type;
    let mut confidence = name_conf;

    for (vt, vscore) in value_scores(samples, profile.filled, profile.distinct_estimate) {
        // Value evidence can only boost/confirm; it overrides weak name guesses
        // only with near-certain evidence (>= 0.9).
        let fused = name_conf * 0.6 + vscore * 0.4;
        let fused_if_override = vscore;
        if vt == name_type {
            confidence = (confidence + 0.35).min(0.99); // corroborating evidence
        } else if fused > confidence || fused_if_override >= 0.9 && confidence < 0.8 {
            best_type = vt;
            confidence = fused.max(fused_if_override.min(0.97));
        }
    }

    // Structural override: first column with ~unique values behaves like a PK.
    if is_first_column
        && high_cardinality
        && best_type != EntityType::Email
        && best_type != EntityType::Url
        && matches!(
            best_type,
            EntityType::ForeignKeyRef
                | EntityType::NumericMetric
                | EntityType::GeneralText
                | EntityType::CategoryType
        )
    {
        best_type = EntityType::PrimaryKeyId;
        confidence = confidence.max(0.85);
    }

    // PK/FK consistency: a confirmed-unique *_id column in its own table is PK.
    if best_type == EntityType::ForeignKeyRef && high_cardinality {
        let tokens = tokenize_name(column);
        let tbl = singularize(table);
        if tokens.last().map(String::as_str) == Some("id") {
            let stem = tokens
                .get(tokens.len().wrapping_sub(2))
                .cloned()
                .unwrap_or_default();
            if stem == tbl || tokens.len() == 1 {
                best_type = EntityType::PrimaryKeyId;
                confidence = confidence.max(0.88);
            }
        }
    }

    let confidence = confidence.clamp(0.05, 0.99);

    EntityTag {
        column_name: column.to_string(),
        table_name: table.to_string(),
        entity_type: best_type.as_str().to_string(),
        confidence,
        sample_values: samples.iter().take(SAMPLE_LIMIT).cloned().collect(),
        description: best_type.description().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn singularize_only_strips_trailing_s() {
        assert_eq!(singularize("customers"), "customer");
        assert_eq!(singularize("address"), "address"); // regression: no mid-word strip
        assert_eq!(singularize("class"), "class");
        assert_eq!(singularize("status"), "status");
        assert_eq!(singularize("bus"), "bus");
        assert_eq!(singularize("order_items"), "order_item");
    }

    #[test]
    fn tokenize_handles_common_cases() {
        assert_eq!(tokenize_name("customer_id"), vec!["customer", "id"]);
        assert_eq!(tokenize_name("firstName"), vec!["first", "name"]);
        assert_eq!(tokenize_name("Created-At"), vec!["created", "at"]);
        assert_eq!(tokenize_name(""), Vec::<String>::new());
    }

    #[test]
    fn email_detected_from_values_over_weak_name() {
        let profile = ColumnProfile {
            filled: 3,
            distinct_estimate: 3,
            ..Default::default()
        };
        let tag = classify_column(
            "orders",
            "contact_info",
            &profile,
            &["a@b.com".into(), "c@d.org".into(), "e@f.net".into()],
            false,
        );
        assert_eq!(tag.entity_type, "EMAIL");
        assert!(tag.confidence > 0.7);
    }

    #[test]
    fn first_unique_numeric_column_is_primary_key() {
        let profile = ColumnProfile {
            filled: 100,
            distinct_estimate: 100,
            integer_count: 100,
            numeric_count: 100,
            ..Default::default()
        };
        let tag = classify_column(
            "orders",
            "order_no",
            &profile,
            &["1".into(), "2".into()],
            true,
        );
        assert_eq!(tag.entity_type, "PRIMARY_KEY_ID");
    }

    #[test]
    fn customer_id_in_customers_table_is_pk() {
        let profile = ColumnProfile {
            filled: 50,
            distinct_estimate: 50,
            integer_count: 50,
            numeric_count: 50,
            ..Default::default()
        };
        let tag = classify_column("customers", "customer_id", &profile, &[], false);
        assert_eq!(tag.entity_type, "PRIMARY_KEY_ID");
    }

    #[test]
    fn low_cardinality_becomes_category() {
        let profile = ColumnProfile {
            filled: 40,
            distinct_estimate: 3,
            ..Default::default()
        };
        let tag = classify_column(
            "orders",
            "mystery_field",
            &profile,
            &["a".into(), "b".into(), "a".into(), "b".into()],
            false,
        );
        assert_eq!(tag.entity_type, "CATEGORY_TYPE");
    }

    #[test]
    fn iso_dates_detected() {
        assert!(looks_like_date("2025-01-15"));
        assert!(looks_like_date("2025-01-15T10:30:00Z"));
        assert!(looks_like_date("01/15/2025"));
        assert!(!looks_like_date("hello world"));
    }

    #[test]
    fn uuid_and_emails() {
        assert!(looks_like_uuid("550e8400-e29b-41d4-a716-446655440000"));
        assert!(!looks_like_uuid("not-a-uuid"));
        assert!(looks_like_email("alice@example.com"));
        assert!(!looks_like_email("alice example.com"));
    }
}
