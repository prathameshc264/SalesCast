"""
Anomaly detection using the IQR method.  Currency: Indian Rupees.
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
from utils.styles import PLOTLY_LAYOUT, COLORS, fmt_inr


def detect_anomalies(df: pd.DataFrame, threshold: float = 1.5):
    daily = df.groupby(df["date"].dt.date)["sales"].sum().reset_index()
    daily.columns = ["date", "sales"]
    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.sort_values("date").reset_index(drop=True)

    q1, q3 = daily["sales"].quantile(0.25), daily["sales"].quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - threshold * iqr, q3 + threshold * iqr

    daily["is_anomaly"] = (daily["sales"] < lower) | (daily["sales"] > upper)
    daily["anomaly_type"] = "normal"
    daily.loc[daily["sales"] > upper, "anomaly_type"] = "high"
    daily.loc[daily["sales"] < lower, "anomaly_type"] = "low"
    daily["upper_bound"] = upper
    daily["lower_bound"] = lower

    return daily, daily[daily["is_anomaly"]].copy()


def explain_anomalies(anomalies: pd.DataFrame, daily: pd.DataFrame) -> list[str]:
    avg = daily["sales"].mean()
    explanations: list[str] = []
    for _, row in anomalies.iterrows():
        d = row["date"].strftime("%d %b %Y")
        pct = abs((row["sales"] - avg) / avg * 100)
        val = fmt_inr(row["sales"])
        avg_str = fmt_inr(avg)
        if row["anomaly_type"] == "high":
            explanations.append(
                f"**{d}** — Revenue of **{val}** was **{pct:.0f}% above** the "
                f"average ({avg_str}).  Possible cause: promotion, seasonal peak, or bulk order."
            )
        else:
            explanations.append(
                f"**{d}** — Revenue of **{val}** was **{pct:.0f}% below** the "
                f"average ({avg_str}).  Possible cause: supply disruption, holiday, or market dip."
            )
    return explanations


def plot_anomalies(daily: pd.DataFrame, anomalies: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=daily["date"], y=daily["sales"],
        mode="lines", name="Daily Sales",
        line=dict(color=COLORS["primary"], width=2),
    ))
    fig.add_trace(go.Scatter(
        x=daily["date"], y=daily["upper_bound"],
        mode="lines", name="Upper Bound",
        line=dict(color="rgba(248,81,73,0.4)", width=1, dash="dot"),
    ))
    fig.add_trace(go.Scatter(
        x=daily["date"], y=daily["lower_bound"],
        mode="lines", name="Lower Bound",
        line=dict(color="rgba(210,153,34,0.4)", width=1, dash="dot"),
        fill="tonexty", fillcolor="rgba(88,166,255,0.04)",
    ))
    high = anomalies[anomalies["anomaly_type"] == "high"]
    if not high.empty:
        fig.add_trace(go.Scatter(
            x=high["date"], y=high["sales"],
            mode="markers", name="Spike",
            marker=dict(color=COLORS["red"], size=10, symbol="triangle-up",
                        line=dict(width=1.5, color="white")),
        ))
    low = anomalies[anomalies["anomaly_type"] == "low"]
    if not low.empty:
        fig.add_trace(go.Scatter(
            x=low["date"], y=low["sales"],
            mode="markers", name="Drop",
            marker=dict(color=COLORS["orange"], size=10, symbol="triangle-down",
                        line=dict(width=1.5, color="white")),
        ))
    fig.update_layout(
        title="Anomaly Detection  (IQR Method)",
        xaxis_title="Date", yaxis_title="Sales (₹)",
        **PLOTLY_LAYOUT,
    )
    return fig
