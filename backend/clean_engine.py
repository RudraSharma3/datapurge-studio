import pandas as pd
import re
import io
import hashlib
from rapidfuzz import process, fuzz

def infer_column_types(df: pd.DataFrame) -> dict:
    col_types = {}
    for col in df.columns:
        if col in ['_row_id', '_reasons']:
            continue
        sample_series = df[col].dropna().astype(str).str.strip()
        if sample_series.empty:
            col_types[col] = "text"
            continue
            
        numeric_converted = pd.to_numeric(df[col], errors='coerce')
        if len(df) > 0 and (numeric_converted.notna().sum() / len(df)) > 0.8:
            col_types[col] = "number"
            continue

        sample_values = sample_series.head(100).tolist()
        if not sample_values:
            col_types[col] = "text"
            continue
        
        email_matches = sum(1 for val in sample_values if re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', val))
        if email_matches / len(sample_values) > 0.5:
            col_types[col] = "email"
            continue
            
        phone_matches = sum(1 for val in sample_values if re.match(r'^\+?[\d\s-]{7,15}$', val))
        if phone_matches / len(sample_values) > 0.5:
            col_types[col] = "phone"
            continue
            
        date_matches = sum(1 for val in sample_values if any(char in val for char in ['-', '/', ',']) and len(val) >= 6)
        if date_matches / len(sample_values) > 0.5:
            col_types[col] = "date"
            continue

        col_types[col] = "text"
    return col_types

def format_phone(phone_series, country):
    def clean_single_value(val):
        if pd.isnull(val) or val == "" or val is None:
            return ""
        s = str(val).strip()
        digits = "".join([ch for ch in s if ch.isdigit()])
        if not digits:
            return s

        if country == "US":
            if len(digits) == 10: return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) == 11 and digits.startswith("1"): return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        elif country == "IN":
            if len(digits) == 10: return f"+91 {digits[:5]} {digits[5:]}"
            elif len(digits) == 12 and digits.startswith("91"): return f"+91 {digits[2:7]} {digits[7:]}"
        elif country == "UK":
            if len(digits) == 11: return f"+44 {digits[1:5]} {digits[5:]}"
        elif country == "AU":
            if len(digits) == 10: return f"+61 {digits[1:4]} {digits[4:7]} {digits[7:]}"
        return s
    return phone_series.apply(clean_single_value)

def calculate_health_analytics(df: pd.DataFrame, initial_row_count: int) -> dict:
    if initial_row_count == 0:
        return {"score": 100, "clusters": [], "metrics": {"missingCells": 0, "duplicateRecords": 0, "formattingErrors": 0}}
        
    missing_cells = 0
    duplicate_rows = 0
    format_issues = 0
    error_summary = {}
    
    for reason_str in df['_reasons'].dropna():
        if not reason_str:
            continue
        reasons = [r.strip() for r in reason_str.split(';') if r.strip()]
        for r in reasons:
            error_summary[r] = error_summary.get(r, 0) + 1
            if "Missing required field" in r:
                missing_cells += 1
            elif "duplicate" in r.lower():
                duplicate_rows += 1
            else:
                format_issues += 1

    deductions = (missing_cells * 0.5) + (duplicate_rows * 2.0) + (format_issues * 1.0)
    health_score = max(5, min(100, int(100 - (deductions / max(1, initial_row_count)) * 10)))
    
    clusters = [{"issue": k, "count": v} for k, v in error_summary.items()]
    clusters = sorted(clusters, key=lambda x: x['count'], reverse=True)
    
    return {
        "score": health_score,
        "clusters": clusters[:5],
        "metrics": {
            "missingCells": missing_cells,
            "duplicateRecords": duplicate_rows,
            "formattingErrors": format_issues
        }
    }

def process_cleaning_rules(df: pd.DataFrame, cfg: dict) -> tuple:
    df['_reasons'] = ""

    # ── FEATURE: SMART DATE NORMALIZATION ENGINE ──
    if cfg.get("standardiseDates") and cfg.get("dateCols"):
        for col in cfg["dateCols"]:
            if col in df.columns:
                # Upgraded to robust mixed parsing to handle multiple formats seamlessly
                converted_dates = pd.to_datetime(df[col], errors='coerce', format='mixed')
                fail_mask = df[col].notna() & (df[col].astype(str).str.strip() != "") & converted_dates.isna()
                df.loc[fail_mask, '_reasons'] += f"Invalid date structure format in {col}; "
                df[col] = converted_dates.apply(lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else "")

    # Anonymization & Masking
    if cfg.get("anonymizeCols") and cfg.get("anonymizeFields"):
        for col in cfg["anonymizeFields"]:
            if col in df.columns:
                df[col] = df[col].astype(str).apply(
                    lambda x: hashlib.sha256(x.encode()).hexdigest()[:12] if x.strip() and x.lower() != 'none' else x
                )

    # Vectorized Transformations
    if cfg.get("trimWhitespace"):
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].astype(str).str.strip()

    if cfg.get("standardiseEmail") and cfg.get("emailCols"):
        for col in cfg["emailCols"]:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip().str.lower()

    if cfg.get("removeSalutations") and cfg.get("salutationCols"):
        salutations_regex = r'^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Mr|Mrs|Ms|Dr|Prof)\s+'
        for col in cfg["salutationCols"]:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace(salutations_regex, '', regex=True)

    if cfg.get("standardisePhone") and cfg.get("phoneCols"):
        for col in cfg["phoneCols"]:
            if col in df.columns:
                df[col] = format_phone(df[col], cfg.get("phoneCountry", "IN"))

    if cfg.get("fixDataTypes") and cfg.get("numberCols"):
        for col in cfg["numberCols"]:
            if col in df.columns and col not in cfg.get("colTypeOverrides", {}):
                df[col] = pd.to_numeric(df[col], errors='coerce')

    # Destructive Flagging Operations (Null Rows/Columns Drop)
    if cfg.get("removeNulls"):
        mode = cfg.get("nullMode", "rows")
        if mode in ["columns", "both"]:
            threshold = cfg.get("nullColumnThreshold", 20) / 100.0
            null_pct = df.isnull().mean()
            cols_to_drop = null_pct[null_pct >= threshold].index.tolist()
            cols_to_drop = [c for c in cols_to_drop if c not in ['_row_id', '_reasons']]
            df.drop(columns=cols_to_drop, inplace=True, errors='ignore')

        if mode in ["rows", "both"] and cfg.get("nullCols"):
            for col in cfg["nullCols"]:
                if col in df.columns:
                    null_mask = df[col].isna() | (df[col].astype(str).str.strip() == "") | (df[col].astype(str).str.strip().str.lower() == "null")
                    df.loc[null_mask, '_reasons'] += f"Missing required field: {col}; "

    # ── FEATURE: GOLDEN RECORD DEDUPLICATION & SURVIVORSHIP WIZARD ──
    if cfg.get("removeDuplicates") and cfg.get("dupCols"):
        valid_dup_cols = [c for c in cfg["dupCols"] if c in df.columns]
        if valid_dup_cols:
            df["_group_key"] = df[valid_dup_cols].apply(
                lambda row: "|".join([str(val).lower().strip() for val in row]), axis=1
            )
            
            def calculate_row_completeness(row):
                score = 0
                for col in df.columns:
                    if col in ["_row_id", "_reasons", "_group_key", "_completeness_score"]:
                        continue
                    val = str(row[col]).strip().lower()
                    if pd.notnull(row[col]) and val not in ["", "none", "nan", "null", "unknown", "n/a", "na"]:
                        score += 1
                return score

            df["_completeness_score"] = df.apply(calculate_row_completeness, axis=1)
            
            dup_strategy = cfg.get("dupStrategy", "density")
            if dup_strategy == "recent" and "timestamp" in [c.lower() for c in df.columns]:
                ts_col = [c for c in df.columns if c.lower() == "timestamp"][0]
                df["_parsed_ts"] = pd.to_datetime(df[ts_col], errors='coerce')
                df = df.sort_values(by=["_group_key", "_parsed_ts"], ascending=[True, False])
                df.drop(columns=["_parsed_ts"], inplace=True)
            else:
                df = df.sort_values(by=["_group_key", "_completeness_score"], ascending=[True, False])

            if dup_strategy == "merge":
                # ── VEctored GENESIS SUB-MATRIX REPLACEMENT ENGINE ──
                # Use fbill and bfill to merge row attributes instantaneously
                feature_cols = [c for c in df.columns if c not in ["_row_id", "_reasons", "_group_key", "_completeness_score"]]
                # Replace empty string formats with true None types for padding
                for c in feature_cols:
                    df[c] = df[c].replace(r'^\s*$', None, regex=True).astype(object)
                
                merged_matrix = df.groupby("_group_key", as_index=False)[feature_cols].bfill().ffill()
                df[feature_cols] = merged_matrix[feature_cols]
                
                dup_mask = df.duplicated(subset=["_group_key"], keep='first')
                df.loc[dup_mask, '_reasons'] += "Duplicate record attributes merged into Golden Record copy; "
            else:
                dup_mask = df.duplicated(subset=["_group_key"], keep='first')
                df.loc[dup_mask, '_reasons'] += "Exact duplicate row (Weaker metrics copy); "
            
            df.drop(columns=["_group_key", "_completeness_score"], inplace=True, errors='ignore')
            df = df.sort_values(by="_row_id")

    if cfg.get("removeFuzzyDups") and cfg.get("fuzzyCols"):
        for col in cfg["fuzzyCols"]:
            if col in df.columns:
                unique_vals = df[col].dropna().unique().tolist()
                checked = set()
                for val in unique_vals:
                    if val in checked: continue
                    matches = process.extract(val, unique_vals, scorer=fuzz.token_set_ratio, score_cutoff=cfg.get("fuzzyThreshold", 80))
                    for match_val, score, idx in matches:
                        if match_val != val:
                            checked.add(match_val)
                            df.loc[df[col] == match_val, '_reasons'] += f"Fuzzy duplicate of [{val}] ({int(score)}% match); "

    # Clean up empty strings back to safe storage fallbacks
    df.fillna("", inplace=True)
    
    clean_df = df[df['_reasons'] == ""]
    flagged_df = df[df['_reasons'] != ""]
    
    return clean_df, flagged_df