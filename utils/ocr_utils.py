"""
OCR-based receipt / bill data extraction using EasyOCR.

Design decision: EasyOCR is pure-Python (no system-level Tesseract install)
and uses a lightweight deep-learning model.  We lazy-load it and cache the
reader with @st.cache_resource so the ~200 MB model downloads only once.

Parsing strategy:
  1. Run OCR → get raw text lines.
  2. Regex-hunt for a date (many common formats).
  3. Regex-hunt for "item  price" lines, filtering out subtotal/tax/total.
"""

import re
from datetime import datetime
import streamlit as st


@st.cache_resource(show_spinner="Loading OCR model (first time only)…")
def _get_reader():
    import easyocr
    return easyocr.Reader(["en"], gpu=False)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_bill_data(image_array):
    """Run OCR on a numpy image array.

    Returns (parsed_result_dict | None, raw_text_or_error_msg).
    """
    try:
        reader = _get_reader()
        results = reader.readtext(image_array)
        raw_text = "\n".join(r[1] for r in results)
        parsed = _parse_bill_text(raw_text)
        return parsed, raw_text
    except ImportError:
        return None, (
            "EasyOCR is not installed.  Run:\n"
            "```\npip install easyocr\n```"
        )
    except Exception as exc:
        return None, f"OCR failed: {exc}"


# ---------------------------------------------------------------------------
# Internal parsing helpers
# ---------------------------------------------------------------------------

def _parse_bill_text(text: str) -> dict:
    lines = text.strip().split("\n")
    return {
        "date": _extract_date(text),
        "items": _extract_items(lines),
        "raw_text": text,
    }


def _extract_date(text: str) -> str:
    """Try many common date patterns; default to today."""
    patterns = [
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})",
        r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})",
        r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{2,4})",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            for fmt in (
                "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%m-%d-%Y",
                "%d %B %Y", "%B %d, %Y", "%d %b %Y", "%b %d, %Y",
                "%m/%d/%y", "%d/%m/%y",
            ):
                try:
                    return datetime.strptime(m.group(1), fmt).strftime("%Y-%m-%d")
                except ValueError:
                    continue
    return datetime.now().strftime("%Y-%m-%d")


def _extract_items(lines: list[str]) -> list[dict]:
    """Find lines that look like 'Item name   12.34'."""
    price_re = re.compile(r"^(.+?)\s+\$?(\d+\.?\d{0,2})\s*$")
    skip = {"subtotal", "sub total", "tax", "total", "change",
            "cash", "card", "visa", "mastercard", "payment", "tip"}

    items: list[dict] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = price_re.match(line)
        if m:
            name = m.group(1).strip()
            price = float(m.group(2))
            if any(s in name.lower() for s in skip):
                continue
            if price > 0 and len(name) > 1:
                items.append({"product": name, "sales": price})
    return items
