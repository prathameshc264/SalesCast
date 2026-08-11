"""
Dashboard logic — KPIs, trend charts, breakdowns, auto-summary.

Profit source priority:
  1. Use the `income` column directly (gross income / net income from CSV)
  2. Fall back to sales − cost if only cost column exists
  3. Hide profit metrics if neither is available
"""

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from utils.styles import PLOTLY_LAYOUT, COLORS, fmt_inr


# ---------------------------------------------------------------------------
# Helper: determine profit source
# ---------------------------------------------------------------------------

def _profit_info(df: pd.DataFrame) -> dict:
    """Return profit availability flags and daily profit Series."""
    has_income = "income" in df.columns and df["income"].notna().any()
    has_cost   = "cost"   in df.columns and df["cost"].notna().any()
    has_profit = has_income or has_cost
    return {"has_income": has_income, "has_cost": has_cost, "has_profit": has_profit}


def _daily_profit(daily: pd.DataFrame, pi: dict) -> pd.Series | None:
    if pi["has_income"] and "income" in daily.columns:
        return daily["income"]
    if pi["has_cost"] and "cost" in daily.columns:
        return daily["sales"] - daily["cost"]
    return None


# ---------------------------------------------------------------------------
# KPI computation
# ---------------------------------------------------------------------------

def compute_kpis(df: pd.DataFrame) -> dict:
    total_sales = df["sales"].sum()
    daily = df.groupby(df["date"].dt.date)["sales"].sum()
    avg_daily = daily.mean()

    # Period-over-period growth (split at midpoint)
    df_sorted = df.sort_values("date")
    mid = df_sorted["date"].min() + (df_sorted["date"].max() - df_sorted["date"].min()) / 2
    first  = df_sorted.loc[df_sorted["date"] <= mid, "sales"].sum()
    second = df_sorted.loc[df_sorted["date"] >  mid, "sales"].sum()
    growth = ((second - first) / first * 100) if first > 0 else 0.0

    pi = _profit_info(df)
    has_quantity = "quantity" in df.columns and df["quantity"].notna().any()

    # Profit — prefer income column, fall back to sales−cost
    if pi["has_income"]:
        total_profit = df["income"].sum()
    elif pi["has_cost"]:
        total_profit = total_sales - df["cost"].sum()
    else:
        total_profit = None

    margin = (total_profit / total_sales * 100) if total_profit is not None and total_sales > 0 else None
    total_quantity = int(df["quantity"].sum()) if has_quantity else None

    return {
        "total_sales":    total_sales,
        "avg_daily":      avg_daily,
        "growth_pct":     growth,
        "num_days":       int(daily.index.nunique()),
        "date_range":     (df["date"].min(), df["date"].max()),
        "has_profit":     pi["has_profit"],
        "total_profit":   total_profit,
        "margin_pct":     margin,
        "has_quantity":    has_quantity,
        "total_quantity":  total_quantity,
    }


# ---------------------------------------------------------------------------
# Revenue (+ optional Profit) trend
# ---------------------------------------------------------------------------

def plot_revenue_trend(df: pd.DataFrame) -> go.Figure:
    pi = _profit_info(df)

    agg = {"sales": "sum"}
    if pi["has_income"]:
        agg["income"] = "sum"
    elif pi["has_cost"]:
        agg["cost"] = "sum"

    daily = df.groupby(df["date"].dt.date).agg(agg).reset_index()
    daily.columns = ["date"] + list(agg.keys())

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=daily["date"], y=daily["sales"],
        mode="lines", name="Revenue",
        line=dict(color=COLORS["primary"], width=2.5),
        fill="tozeroy", fillcolor="rgba(88,166,255,0.08)",
    ))

    profit = _daily_profit(daily, pi)
    if profit is not None:
        fig.add_trace(go.Scatter(
            x=daily["date"], y=profit,
            mode="lines", name="Profit",
            line=dict(color=COLORS["green"], width=2),
        ))

    fig.update_layout(
        title="Revenue & Profit Trend",
        xaxis_title="Date", yaxis_title="Amount (₹)",
        **PLOTLY_LAYOUT,
    )
    return fig


# ---------------------------------------------------------------------------
# Top products / categories
# ---------------------------------------------------------------------------

def plot_top_products(df: pd.DataFrame, col: str = "product", top_n: int = 10) -> go.Figure | None:
    if col not in df.columns or not df[col].notna().any():
        return None
    top = df.dropna(subset=[col]).groupby(col)["sales"].sum().nlargest(top_n).sort_values().reset_index()
    fig = px.bar(
        top, x="sales", y=col, orientation="h",
        labels={"sales": "Total Revenue (₹)", col: col.title()},
        color="sales",
        color_continuous_scale=[COLORS["primary"], COLORS["purple"]],
    )
    fig.update_layout(
        title=f"Top {min(top_n, len(top))} {col.title()}s by Revenue",
        coloraxis_showscale=False,
        **PLOTLY_LAYOUT,
    )
    return fig


# ---------------------------------------------------------------------------
# Day-of-week analysis
# ---------------------------------------------------------------------------

def plot_day_of_week(df: pd.DataFrame) -> go.Figure:
    daily = df.groupby(df["date"].dt.date)["sales"].sum().reset_index()
    daily.columns = ["date", "sales"]
    daily["date"] = pd.to_datetime(daily["date"])
    daily["dow"] = daily["date"].dt.day_name()
    daily["dow_n"] = daily["date"].dt.dayofweek

    avg = daily.groupby(["dow", "dow_n"])["sales"].mean().reset_index().sort_values("dow_n")
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    colors = [COLORS["primary"]] * 5 + [COLORS["green"]] * 2

    fig = go.Figure(go.Bar(
        x=avg["dow"], y=avg["sales"],
        marker_color=colors,
        text=[fmt_inr(v) for v in avg["sales"]],
        textposition="outside",
    ))
    fig.update_layout(**PLOTLY_LAYOUT)
    fig.update_layout(
        title="Average Sales by Day of Week",
        xaxis=dict(categoryorder="array", categoryarray=day_order,
                   gridcolor="rgba(255,255,255,0.05)"),
        yaxis_title="Avg Sales (₹)",
    )
    return fig


# ---------------------------------------------------------------------------
# Monthly comparison
# ---------------------------------------------------------------------------

def plot_monthly_comparison(df: pd.DataFrame) -> go.Figure:
    df_copy = df.copy()
    df_copy["month"] = df_copy["date"].dt.to_period("M").astype(str)
    monthly = df_copy.groupby("month")["sales"].sum().reset_index()

    fig = go.Figure(go.Bar(
        x=monthly["month"], y=monthly["sales"],
        marker_color=COLORS["primary"],
        text=[fmt_inr(v) for v in monthly["sales"]],
        textposition="outside",
    ))
    fig.update_layout(**PLOTLY_LAYOUT)
    fig.update_layout(
        title="Monthly Revenue",
        xaxis_title="Month", yaxis_title="Total Revenue (₹)",
    )
    return fig


# ---------------------------------------------------------------------------
# Auto-generated summary
# ---------------------------------------------------------------------------

def generate_summary(df: pd.DataFrame, kpis: dict) -> str:
    start = kpis["date_range"][0].strftime("%d %b %Y")
    end   = kpis["date_range"][1].strftime("%d %b %Y")
    direction = "grown" if kpis["growth_pct"] >= 0 else "declined"

    s = (
        f"Your data spans <b>{start}</b> to <b>{end}</b> "
        f"({kpis['num_days']} days). "
        f"Total revenue is <b>{fmt_inr(kpis['total_sales'])}</b> "
        f"with an average daily figure of <b>{fmt_inr(kpis['avg_daily'])}</b>. "
        f"Period-over-period, sales have {direction} by "
        f"<b>{abs(kpis['growth_pct']):.1f}%</b>."
    )

    if kpis["has_profit"] and kpis["total_profit"] is not None:
        s += (
            f" Total profit is <b>{fmt_inr(kpis['total_profit'])}</b>"
            f" at a margin of <b>{kpis['margin_pct']:.1f}%</b>."
        )

    if kpis["has_quantity"] and kpis["total_quantity"]:
        s += f" Total units sold: <b>{kpis['total_quantity']:,}</b>."

    daily = df.groupby(df["date"].dt.date)["sales"].sum()
    peak, low = daily.idxmax(), daily.idxmin()
    s += (
        f" Peak day: <b>{peak}</b> ({fmt_inr(daily.max())}). "
        f"Lowest day: <b>{low}</b> ({fmt_inr(daily.min())})."
    )

    if "product" in df.columns and df["product"].notna().any():
        ps = df.groupby("product")["sales"].sum()
        if not ps.empty:
            top = ps.idxmax()
            s += f" <b>{top}</b> leads revenue at {ps.max() / kpis['total_sales'] * 100:.1f}% of total."
    elif "category" in df.columns and df["category"].notna().any():
        cs = df.groupby("category")["sales"].sum()
        if not cs.empty:
            top = cs.idxmax()
            s += f" <b>{top}</b> leads revenue at {cs.max() / kpis['total_sales'] * 100:.1f}% of total."

    return s
