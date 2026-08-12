"""
Smart column detection and data cleaning pipeline.

Uses keyword matching with priority levels so that:
  - "Sales" beats "Unit price" for revenue
  - "gross income" is recognised as profit
  - "Quantity" maps to units sold
  - "Product line" maps to category (not product)
"""

import pandas as pd
import numpy as np


# ---------------------------------------------------------------------------
# Exclusion patterns — things that look like revenue but aren't
# ---------------------------------------------------------------------------
_SALES_SKIP = [
    "unit price", "price per", "unit cost", "tax", "rating", "margin",
    "percentage", "gross margin", "qty", "quantity", "cogs",
    "cost of", "income", "profit", "earning",
]

_PRODUCT_IS_CATEGORY = [
    "product line", "product_line", "product category", "product type",
    "product group",
]


# ---------------------------------------------------------------------------
# Date
# ---------------------------------------------------------------------------
def detect_date_column(df: pd.DataFrame) -> str | None:
    best_col, best_score = None, 0.0
    for col in df.columns:
        if df[col].dtype not in ("object", "string") and not any(
            kw in col.lower() for kw in ("date", "time", "day", "month", "year")
        ):
            continue
        try:
            try:
                parsed = pd.to_datetime(df[col], format="mixed", errors="coerce")
            except TypeError:
                parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors="coerce")
            score = parsed.notna().sum() / len(df)
            if "date" in col.lower():
                score += 0.2
            elif any(kw in col.lower() for kw in ("time", "day", "month", "year")):
                score += 0.1
            if score > best_score:
                best_score, best_col = score, col
        except Exception:
            continue
    return best_col if best_score > 0.5 else None


# ---------------------------------------------------------------------------
# Sales / Revenue  (the TOTAL sale amount, NOT unit price)
# ---------------------------------------------------------------------------
def detect_sales_column(df: pd.DataFrame, exclude: list[str] | None = None) -> str | None:
    exclude = set(exclude or [])
    id_kw = {"id", "index", "row", "sr", "sno", "serial", "no", "num"}

    candidates = [
        c for c in df.select_dtypes(include=[np.number]).columns
        if c not in exclude and c.lower().strip() not in id_kw
    ]
    if not candidates:
        return None

    # Remove columns that are clearly not total sales
    filtered = [c for c in candidates
                if not any(pat in c.lower() for pat in _SALES_SKIP)]
    if not filtered:
        filtered = candidates

    # Tier 1: exact sale/revenue keywords
    t1 = ("sales", "revenue", "total sales", "total revenue", "turnover")
    for c in filtered:
        if any(kw in c.lower() for kw in t1):
            return c

    # Tier 2: generic totals
    t2 = ("amount", "total", "value")
    for c in filtered:
        if any(kw in c.lower() for kw in t2):
            return c

    # Tier 3: price (but not "unit price")
    for c in filtered:
        if "price" in c.lower() and "unit" not in c.lower():
            return c

    # Fallback: column with the largest range
    return max(filtered, key=lambda c: df[c].max() - df[c].min())


# ---------------------------------------------------------------------------
# Income / Profit  (net income > gross income > profit > income)
# ---------------------------------------------------------------------------
def detect_income_column(df: pd.DataFrame, exclude: list[str] | None = None) -> str | None:
    exclude = set(exclude or [])
    tiers = [
        ("net income", "net profit", "net earnings"),
        ("gross income", "gross profit", "gross earnings"),
        ("income", "profit", "earnings", "earning"),
    ]
    for keywords in tiers:
        for c in df.select_dtypes(include=[np.number]).columns:
            if c not in exclude and any(kw in c.lower() for kw in keywords):
                return c
    return None


# ---------------------------------------------------------------------------
# Cost / COGS
# ---------------------------------------------------------------------------
def detect_cost_column(df: pd.DataFrame, exclude: list[str] | None = None) -> str | None:
    exclude = set(exclude or [])
    kw = ("cogs", "cost of goods", "total cost", "cost", "expense",
          "purchase", "buying", "spend")
    skip = ("unit cost", "cost per")
    for c in df.select_dtypes(include=[np.number]).columns:
        if c not in exclude:
            name = c.lower()
            if any(s in name for s in skip):
                continue
            if any(k in name for k in kw):
                return c
    return None


# ---------------------------------------------------------------------------
# Quantity / Units
# ---------------------------------------------------------------------------
def detect_quantity_column(df: pd.DataFrame, exclude: list[str] | None = None) -> str | None:
    exclude = set(exclude or [])
    kw = ("quantity", "qty", "units sold", "units", "no of items",
          "number of", "pieces", "pcs")
    for c in df.select_dtypes(include=[np.number]).columns:
        if c not in exclude and any(k in c.lower() for k in kw):
            return c
    return None


# ---------------------------------------------------------------------------
# Product (individual item name / SKU, NOT "product line")
# ---------------------------------------------------------------------------
def detect_product_column(df: pd.DataFrame, exclude: list[str] | None = None) -> str | None:
    exclude = set(exclude or [])
    kw = ("product", "item", "name", "sku", "goods", "merchandise")
    for c in df.columns:
        if c not in exclude and df[c].dtype == "object":
            name = c.lower()
            if any(pat in name for pat in _PRODUCT_IS_CATEGORY):
                continue          # "Product line" → skip, it's a category
            if any(k in name for k in kw):
                return c
    return None


# ---------------------------------------------------------------------------
# Category  ("product line", "category", "segment", …)
# ---------------------------------------------------------------------------
def detect_category_column(df: pd.DataFrame, exclude: list[str] | None = None) -> str | None:
    exclude = set(exclude or [])

    # Tier 1 — specific category keywords
    specific = ("category", "product line", "product_line", "product category",
                "segment", "department", "dept")
    for c in df.columns:
        if c not in exclude and df[c].dtype == "object":
            if any(k in c.lower() for k in specific):
                return c

    # Tier 2 — generic (but skip customer/payment/date columns)
    generic = ("type", "class", "group", "line", "division")
    skip = ("customer", "payment", "invoice", "date", "time", "id", "gender",
            "branch", "city")
    for c in df.columns:
        if c not in exclude and df[c].dtype == "object":
            name = c.lower()
            if any(s in name for s in skip):
                continue
            if any(k in name for k in generic):
                return c
    return None


# ---------------------------------------------------------------------------
# Main cleaning pipeline
# ---------------------------------------------------------------------------

def clean_data(df: pd.DataFrame) -> tuple[pd.DataFrame | None, dict]:
    report = {
        "original_rows": len(df),
        "duplicates_removed": 0,
        "missing_filled": 0,
        "date_col": None,
        "sales_col": None,
        "income_col": None,
        "cost_col": None,
        "quantity_col": None,
        "product_col": None,
        "category_col": None,
    }

    # 1 — Detect columns (order matters — each detection excludes prior picks)
    date_col = detect_date_column(df)
    if date_col is None:
        return None, {"error": "Could not detect a date column. "
                      "Ensure your file has a column with dates."}

    sales_col = detect_sales_column(df, exclude=[date_col])
    if sales_col is None:
        return None, {"error": "Could not detect a sales/revenue column. "
                      "Ensure your file has a numeric column with sale amounts."}

    used = [date_col, sales_col]

    income_col = detect_income_column(df, exclude=used)
    if income_col:
        used.append(income_col)

    cost_col = detect_cost_column(df, exclude=used)
    if cost_col:
        used.append(cost_col)

    quantity_col = detect_quantity_column(df, exclude=used)
    if quantity_col:
        used.append(quantity_col)

    product_col = detect_product_column(df, exclude=used)
    if product_col:
        used.append(product_col)

    category_col = detect_category_column(df, exclude=used)

    report.update(
        date_col=date_col, sales_col=sales_col, income_col=income_col,
        cost_col=cost_col, quantity_col=quantity_col,
        product_col=product_col, category_col=category_col,
    )

    # 2 — Parse dates
    try:
        df[date_col] = pd.to_datetime(df[date_col], format="mixed", errors="coerce")
    except TypeError:
        df[date_col] = pd.to_datetime(df[date_col], infer_datetime_format=True, errors="coerce")
    df = df.dropna(subset=[date_col])

    # 3 — Coerce numerics
    num_cols = [c for c in (sales_col, income_col, cost_col, quantity_col) if c]
    for col in num_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # 4 — Deduplicate
    before = len(df)
    df = df.drop_duplicates()
    report["duplicates_removed"] = before - len(df)

    # 5 — Fill missing
    for col in num_cols:
        missing = int(df[col].isna().sum())
        if missing > 0:
            df[col] = df[col].interpolate(method="linear").bfill().ffill()
            report["missing_filled"] += missing

    # 6 — Sort
    df = df.sort_values(date_col).reset_index(drop=True)

    # 7 — Build clean DataFrame with canonical column names
    cleaned = pd.DataFrame()
    cleaned["date"]  = df[date_col]
    cleaned["sales"] = df[sales_col]
    if income_col:
        cleaned["income"] = df[income_col]
    if cost_col:
        cleaned["cost"] = df[cost_col]
    if quantity_col:
        cleaned["quantity"] = df[quantity_col]
    if product_col:
        cleaned["product"] = df[product_col]
    if category_col:
        cleaned["category"] = df[category_col]

    report["final_rows"] = len(cleaned)
    return cleaned, report
