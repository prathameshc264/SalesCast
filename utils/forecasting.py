"""
Prophet-based sales forecasting.  Currency: Indian Rupees.
"""

import warnings
import pandas as pd
import plotly.graph_objects as go
from utils.styles import PLOTLY_LAYOUT, COLORS

warnings.filterwarnings("ignore", module="prophet")
warnings.filterwarnings("ignore", module="cmdstanpy")


def _prepare_prophet_df(df: pd.DataFrame) -> pd.DataFrame:
    daily = df.groupby(df["date"].dt.date)["sales"].sum().reset_index()
    daily.columns = ["ds", "y"]
    daily["ds"] = pd.to_datetime(daily["ds"])
    return daily.sort_values("ds").reset_index(drop=True)


def train_and_forecast(df: pd.DataFrame, periods: int = 7):
    from prophet import Prophet
    prophet_df = _prepare_prophet_df(df)
    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=True,
        yearly_seasonality=len(prophet_df) > 180,
        changepoint_prior_scale=0.05,
    )
    model.fit(prophet_df)
    future = model.make_future_dataframe(periods=periods)
    forecast = model.predict(future)
    return model, forecast, prophet_df


def get_next_day_prediction(forecast: pd.DataFrame) -> dict:
    row = forecast.iloc[-1]
    return {
        "date": row["ds"],
        "predicted": row["yhat"],
        "lower": row["yhat_lower"],
        "upper": row["yhat_upper"],
    }


def plot_forecast(historical_df: pd.DataFrame, forecast: pd.DataFrame, periods: int = 7) -> go.Figure:
    prophet_df = _prepare_prophet_df(historical_df)
    cutoff = prophet_df["ds"].max()

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=prophet_df["ds"], y=prophet_df["y"],
        mode="lines", name="Historical",
        line=dict(color=COLORS["primary"], width=2.5),
    ))

    fcast = forecast[forecast["ds"] > cutoff].copy()
    bridge = forecast[forecast["ds"] == cutoff]
    if not bridge.empty:
        fcast = pd.concat([bridge, fcast])

    fig.add_trace(go.Scatter(
        x=fcast["ds"], y=fcast["yhat"],
        mode="lines", name="Forecast",
        line=dict(color=COLORS["cyan"], width=2.5, dash="dash"),
    ))
    fig.add_trace(go.Scatter(
        x=list(fcast["ds"]) + list(fcast["ds"][::-1]),
        y=list(fcast["yhat_upper"]) + list(fcast["yhat_lower"][::-1]),
        fill="toself", fillcolor="rgba(57,210,192,0.10)",
        line=dict(color="rgba(0,0,0,0)"),
        name="95% Confidence", hoverinfo="skip",
    ))

    fig.update_layout(
        title=f"Sales Forecast  (Next {periods} Days)",
        xaxis_title="Date", yaxis_title="Sales (₹)",
        **PLOTLY_LAYOUT,
    )
    return fig
