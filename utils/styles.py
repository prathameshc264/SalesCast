"""
Design system — professional dark theme, currency formatting, Plotly layout.

Design decision: Centralised styling gives a consistent, polished look.
The colour palette is GitHub-dark inspired — minimal, professional, and
easy on the eyes.  Indian Rupee formatting uses proper lakh/crore comma
grouping (12,34,567 instead of 1,234,567).
"""

# ---------------------------------------------------------------------------
# Colour palette (GitHub dark-inspired)
# ---------------------------------------------------------------------------
COLORS = {
    "primary": "#58A6FF",
    "green":   "#3FB950",
    "orange":  "#D29922",
    "red":     "#F85149",
    "purple":  "#BC8CFF",
    "cyan":    "#39D2C0",
    "surface": "#161B22",
    "card":    "#1C2128",
    "border":  "#30363D",
    "text":    "#E6EDF3",
    "muted":   "#8B949E",
}

# ---------------------------------------------------------------------------
# Plotly layout defaults
# ---------------------------------------------------------------------------
PLOTLY_LAYOUT = dict(
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="Inter, sans-serif", color=COLORS["text"]),
    margin=dict(l=40, r=40, t=60, b=40),
    xaxis=dict(gridcolor="rgba(255,255,255,0.05)"),
    yaxis=dict(gridcolor="rgba(255,255,255,0.05)"),
    legend=dict(bgcolor="rgba(0,0,0,0)"),
)


# ---------------------------------------------------------------------------
# Indian Rupee formatter  (₹12,34,567)
# ---------------------------------------------------------------------------
def fmt_inr(value: float, decimals: int = 0) -> str:
    """Format a number as Indian Rupees with lakh/crore comma grouping."""
    neg = value < 0
    value = abs(value)
    int_part = int(value)

    s = str(int_part)
    if len(s) <= 3:
        formatted = s
    else:
        result = s[-3:]          # last three digits
        s = s[:-3]
        while s:                 # then groups of two
            result = s[-2:] + "," + result
            s = s[:-2]
        formatted = result

    if decimals > 0:
        dec_str = f"{value:.{decimals}f}".split(".")[1]
        formatted += "." + dec_str

    return f"{'-' if neg else ''}₹{formatted}"


# ---------------------------------------------------------------------------
# KPI card HTML
# ---------------------------------------------------------------------------
_ACCENT_MAP = {
    "blue":   COLORS["primary"],
    "green":  COLORS["green"],
    "orange": COLORS["orange"],
    "red":    COLORS["red"],
    "purple": COLORS["purple"],
    "cyan":   COLORS["cyan"],
}


def kpi_card_html(label: str, value: str, *, subtitle: str = "", accent: str = "blue") -> str:
    """Return an HTML snippet for a clean, bordered KPI card."""
    color = _ACCENT_MAP.get(accent, COLORS["primary"])
    sub = (
        f'<div style="font-size:0.8rem;color:{COLORS["muted"]};margin-top:4px;">'
        f"{subtitle}</div>"
        if subtitle else ""
    )
    return f"""
    <div style="
        background:{COLORS['card']};
        border:1px solid {COLORS['border']};
        border-top:3px solid {color};
        border-radius:10px;
        padding:18px 20px;
        margin-bottom:10px;
    ">
        <div style="font-size:0.72rem;color:{COLORS['muted']};
                    text-transform:uppercase;letter-spacing:0.9px;
                    font-weight:600;">{label}</div>
        <div style="font-size:1.6rem;font-weight:700;color:{COLORS['text']};
                    margin:6px 0 0;white-space:nowrap;">{value}</div>
        {sub}
    </div>
    """


# ---------------------------------------------------------------------------
# Full-page custom CSS
# ---------------------------------------------------------------------------
def get_custom_css() -> str:
    return """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

    .main .block-container { padding-top: 1.2rem; max-width: 1360px; }

    /* Summary / insight box */
    .summary-box {
        background: """ + COLORS["surface"] + """;
        border: 1px solid """ + COLORS["border"] + """;
        border-radius: 10px;
        padding: 20px 24px;
        line-height: 1.75;
        font-size: 0.95rem;
        color: """ + COLORS["text"] + """;
        margin: 8px 0 16px 0;
    }

    /* Recommendation cards */
    .rec-card {
        background: """ + COLORS["card"] + """;
        border: 1px solid """ + COLORS["border"] + """;
        border-radius: 10px;
        padding: 18px 22px;
        margin: 8px 0;
        border-left: 4px solid;
        transition: background 0.2s ease;
    }
    .rec-card:hover { background: #22272E; }
    .rec-card.restock  { border-left-color: """ + COLORS["red"] + """; }
    .rec-card.slow     { border-left-color: """ + COLORS["orange"] + """; }
    .rec-card.trending { border-left-color: """ + COLORS["green"] + """; }

    .rec-card h3 { margin:0 0 6px;font-size:1.05rem;color:""" + COLORS["text"] + """; }
    .rec-card p  { margin:0 0 6px;color:""" + COLORS["muted"] + """;line-height:1.55;font-size:0.92rem; }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] { gap:4px; border-bottom:1px solid """ + COLORS["border"] + """; }
    .stTabs [data-baseweb="tab"] {
        padding:10px 20px; border-radius:6px 6px 0 0;
        font-weight:500; font-size:0.88rem;
    }

    /* Headings */
    h2 { font-weight:600 !important; letter-spacing:-0.3px; }

    /* Hide Streamlit chrome (keep header for sidebar toggle) */
    #MainMenu, footer { visibility:hidden; }
    </style>
    """
