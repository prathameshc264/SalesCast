"""
SQLite database helpers.

Schema stores: sales (revenue), income (profit), cost, quantity.
Migration adds columns that may be missing from older schema versions.
"""

import sqlite3
import os
import tempfile
import pandas as pd

# Use /tmp/ on Streamlit Cloud (read-only filesystem), local path otherwise
_local_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "sales.db",
)
_cloud = not os.access(os.path.dirname(_local_path) or ".", os.W_OK)
DB_PATH = os.path.join(tempfile.gettempdir(), "sales.db") if _cloud else _local_path


def _get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    return conn


def init_db():
    conn = _get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sales_data (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            date       TEXT    NOT NULL,
            sales      REAL    NOT NULL,
            income     REAL,
            cost       REAL,
            quantity   REAL,
            product    TEXT,
            category   TEXT,
            source     TEXT    DEFAULT 'csv',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    _migrate(conn)
    conn.commit()
    conn.close()


def _migrate(conn):
    """Add columns that may be missing from older schema versions."""
    existing = {row[1] for row in conn.execute("PRAGMA table_info(sales_data)").fetchall()}
    for col in ("cost", "income", "quantity"):
        if col not in existing:
            conn.execute(f"ALTER TABLE sales_data ADD COLUMN {col} REAL")


def _val(row, col):
    """Safely extract a float from a DataFrame row, or None."""
    if col in row.index and pd.notna(row.get(col)):
        return float(row[col])
    return None


def insert_data(df: pd.DataFrame, source: str = "csv"):
    conn = _get_connection()
    for _, row in df.iterrows():
        conn.execute(
            "INSERT INTO sales_data "
            "(date, sales, income, cost, quantity, product, category, source) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                str(row["date"]),
                float(row["sales"]),
                _val(row, "income"),
                _val(row, "cost"),
                _val(row, "quantity"),
                row.get("product") if "product" in row.index else None,
                row.get("category") if "category" in row.index else None,
                source,
            ),
        )
    conn.commit()
    conn.close()


def get_all_data() -> pd.DataFrame:
    conn = _get_connection()
    df = pd.read_sql_query("SELECT * FROM sales_data ORDER BY date", conn)
    conn.close()
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df


def get_row_count() -> int:
    conn = _get_connection()
    count = conn.execute("SELECT COUNT(*) FROM sales_data").fetchone()[0]
    conn.close()
    return count


def clear_data():
    conn = _get_connection()
    conn.execute("DELETE FROM sales_data")
    conn.commit()
    conn.close()
