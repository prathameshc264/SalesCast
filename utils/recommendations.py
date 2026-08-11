"""
Rule-based business recommendations.  Currency: Indian Rupees.  No emojis.
"""

import pandas as pd
import numpy as np
from utils.styles import fmt_inr


def generate_recommendations(df: pd.DataFrame, forecast_df=None) -> list[dict]:
    recs: list[dict] = []
    daily = df.groupby(df["date"].dt.date)["sales"].sum().reset_index()
    daily.columns = ["date", "sales"]
    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.sort_values("date")
    n = len(daily)

    # Overall trend
    if n >= 14:
        recent   = daily.tail(7)["sales"].mean()
        previous = daily.iloc[-14:-7]["sales"].mean()
        trend = ((recent - previous) / previous * 100) if previous > 0 else 0
        if trend > 10:
            recs.append(_r("trending", "Sales Momentum Is Strong",
                f"Revenue is up {trend:.1f}% in the last 7 days vs. the prior week. "
                f"Consider increasing inventory and marketing spend.", "high"))
        elif trend < -10:
            recs.append(_r("slow", "Sales Are Declining",
                f"Revenue is down {abs(trend):.1f}% in the last 7 days. "
                f"Review pricing, run promotions, or investigate root causes.", "high"))

    # Product level
    if "product" in df.columns:
        recs.extend(_product_recs(df))

    # Weekday vs weekend
    if n >= 14:
        dc = daily.copy()
        dc["we"] = dc["date"].dt.dayofweek >= 5
        we = dc.loc[dc["we"], "sales"].mean()
        wd = dc.loc[~dc["we"], "sales"].mean()
        if we > wd * 1.2 and not np.isnan(we):
            recs.append(_r("trending", "Weekends Outperform",
                f"Weekend avg ({fmt_inr(we)}/day) is {(we/wd-1)*100:.0f}% higher "
                f"than weekdays ({fmt_inr(wd)}/day). Ensure weekend readiness.", "medium"))
        elif wd > we * 1.2 and not np.isnan(wd):
            recs.append(_r("trending", "Weekdays Dominate",
                f"Weekday avg ({fmt_inr(wd)}/day) is {(wd/we-1)*100:.0f}% higher "
                f"than weekends ({fmt_inr(we)}/day). Focus marketing on weekdays.", "medium"))

    # Profit insight
    if "cost" in df.columns and df["cost"].notna().any():
        margin = (df["sales"].sum() - df["cost"].sum()) / df["sales"].sum() * 100
        if margin < 20:
            recs.append(_r("slow", "Low Profit Margin",
                f"Overall margin is {margin:.1f}%. Review cost structure or "
                f"adjust pricing to improve profitability.", "high"))
        elif margin > 50:
            recs.append(_r("trending", "Healthy Profit Margin",
                f"Overall margin is {margin:.1f}%. You have room for strategic "
                f"discounts or reinvestment.", "low"))

    # Forecast-based
    if forecast_df is not None and "yhat" in forecast_df.columns and n >= 7:
        last_act = daily["sales"].tail(7).mean()
        fc_mean  = forecast_df["yhat"].tail(7).mean()
        chg = ((fc_mean - last_act) / last_act * 100) if last_act > 0 else 0
        if chg > 15:
            recs.append(_r("trending", "Forecast: Revenue Expected to Rise",
                f"Model predicts a {chg:.0f}% increase next week "
                f"(~{fmt_inr(fc_mean)}/day vs current ~{fmt_inr(last_act)}/day).", "high"))
        elif chg < -15:
            recs.append(_r("slow", "Forecast: Revenue Expected to Drop",
                f"Model predicts a {abs(chg):.0f}% decrease next week "
                f"(~{fmt_inr(fc_mean)}/day vs current ~{fmt_inr(last_act)}/day).", "high"))

    if not recs:
        recs.append(_r("trending", "All Stable",
            "No actionable alerts.  Continue monitoring for emerging trends.", "low"))
    return recs


def _r(t, title, msg, pri):
    return {"type": t, "icon": "", "title": title, "message": msg, "priority": pri}


def _product_recs(df):
    recs = []
    agg = df.groupby("product").agg(total=("sales","sum"), count=("sales","count"),
                                     avg=("sales","mean")).reset_index()
    agg = agg.sort_values("total", ascending=False)
    for _, row in agg.head(min(3, len(agg))).iterrows():
        pd_data = df[df["product"] == row["product"]].sort_values("date")
        if len(pd_data) >= 4:
            mid = len(pd_data)//2
            r1 = pd_data.iloc[:mid]["sales"].sum()/max(1,mid)
            r2 = pd_data.iloc[mid:]["sales"].sum()/max(1,len(pd_data)-mid)
            if r2 > r1*1.15:
                recs.append(_r("restock", f"Restock Alert: {row['product']}",
                    f"{row['product']} is a top seller ({fmt_inr(row['total'])} total) "
                    f"with accelerating demand. Ensure sufficient stock.", "high"))
    median_s = agg["total"].median()
    for _, row in agg.tail(min(3, len(agg))).iterrows():
        if row["total"] < median_s*0.3:
            recs.append(_r("slow", f"Slow Mover: {row['product']}",
                f"{row['product']} has low sales ({fmt_inr(row['total'])} total, "
                f"{fmt_inr(row['avg'])} avg). Consider discounting or discontinuing.", "medium"))
    return recs
