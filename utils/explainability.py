"""
SHAP-based forecast explainability (XGBoost proxy model).
"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from utils.styles import PLOTLY_LAYOUT, COLORS

_NAME_MAP = {
    "day_of_week":      "Day of Week",
    "month":            "Month",
    "day_of_month":     "Day of Month",
    "week_of_year":     "Week of Year",
    "is_weekend":       "Weekend",
    "quarter":          "Quarter",
    "days_since_start": "Trend (Time)",
    "lag_1":            "Previous Day Sales",
    "lag_7":            "Same Day Last Week",
    "rolling_mean_7":   "7-Day Average",
    "rolling_std_7":    "7-Day Volatility",
    "rolling_mean_30":  "30-Day Average",
}
FEATURE_COLS = list(_NAME_MAP.keys())


def create_features(df: pd.DataFrame) -> pd.DataFrame:
    daily = df.groupby(df["date"].dt.date)["sales"].sum().reset_index()
    daily.columns = ["date", "sales"]
    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.sort_values("date").reset_index(drop=True)

    daily["day_of_week"]      = daily["date"].dt.dayofweek
    daily["month"]            = daily["date"].dt.month
    daily["day_of_month"]     = daily["date"].dt.day
    daily["week_of_year"]     = daily["date"].dt.isocalendar().week.astype(int)
    daily["is_weekend"]       = (daily["day_of_week"] >= 5).astype(int)
    daily["quarter"]          = daily["date"].dt.quarter
    daily["days_since_start"] = (daily["date"] - daily["date"].min()).dt.days
    daily["lag_1"]            = daily["sales"].shift(1)
    daily["lag_7"]            = daily["sales"].shift(7)
    daily["rolling_mean_7"]   = daily["sales"].rolling(7).mean()
    daily["rolling_std_7"]    = daily["sales"].rolling(7).std()
    daily["rolling_mean_30"]  = daily["sales"].rolling(30).mean()
    return daily.dropna().reset_index(drop=True)


def train_xgboost_model(df):
    from xgboost import XGBRegressor
    featured = create_features(df)
    avail = [f for f in FEATURE_COLS if f in featured.columns]
    X, y = featured[avail], featured["sales"]
    model = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model.fit(X, y)
    return model, X, y, avail


def compute_shap_values(model, X):
    import shap
    explainer = shap.TreeExplainer(model)
    return explainer.shap_values(X), explainer


def plot_feature_importance(shap_values, feature_names):
    importance = np.abs(shap_values).mean(axis=0)
    idx = np.argsort(importance)
    names = [_NAME_MAP.get(feature_names[i], feature_names[i]) for i in idx]
    vals = importance[idx]

    fig = go.Figure(go.Bar(
        x=vals, y=names, orientation="h",
        marker=dict(color=vals, colorscale=[[0, COLORS["primary"]], [1, COLORS["purple"]]]),
    ))
    fig.update_layout(
        title="Feature Importance  (SHAP Analysis)",
        xaxis_title="Mean |SHAP Value|",
        yaxis_title="", height=420,
        **PLOTLY_LAYOUT,
    )
    return fig


def get_top_drivers(shap_values, feature_names, top_n=3):
    importance = np.abs(shap_values).mean(axis=0)
    top = np.argsort(importance)[::-1][:top_n]
    return [_NAME_MAP.get(feature_names[i], feature_names[i]) for i in top]
