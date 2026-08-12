"""
SalesCast Pro  —  AI-Powered Sales Forecasting Dashboard
========================================================
Main Streamlit entry point.

Run:  streamlit run app.py
"""

import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="SalesCast Pro",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Imports ──────────────────────────────────────────────────────────────────
from db.database import init_db, insert_data, get_all_data, clear_data, get_row_count
from utils.cleaning import clean_data
from utils.styles import get_custom_css, kpi_card_html, fmt_inr, COLORS
from utils.dashboard import (
    compute_kpis, plot_revenue_trend, plot_top_products,
    plot_day_of_week, plot_monthly_comparison, generate_summary,
)
from utils.forecasting import train_and_forecast, get_next_day_prediction, plot_forecast
from utils.anomaly import detect_anomalies, explain_anomalies, plot_anomalies
from utils.ocr_utils import extract_bill_data
from utils.explainability import (
    train_xgboost_model, compute_shap_values, plot_feature_importance, get_top_drivers,
)
from utils.recommendations import generate_recommendations

# ── Init ─────────────────────────────────────────────────────────────────────
init_db()
st.markdown(get_custom_css(), unsafe_allow_html=True)

for key, val in {
    "last_file": None, "clean_report": None,
    "forecast_cache": None, "forecast_cache_key": None,
    "shap_cache": None,
}.items():
    st.session_state.setdefault(key, val)


# ═════════════════════════════════════════════════════════════════════════════
#  SIDEBAR
# ═════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown(
        f"<h2 style='margin-bottom:0;color:{COLORS['text']}'>SalesCast Pro</h2>"
        f"<p style='color:{COLORS['muted']};margin-top:2px;font-size:0.85rem'>"
        f"Sales Intelligence Platform</p>",
        unsafe_allow_html=True,
    )
    st.markdown("---")

    # File Upload (CSV or Excel)
    st.markdown("#### Upload Data")
    uploaded = st.file_uploader(
        "CSV or Excel with sales data",
        type=["csv", "xlsx", "xls"], key="csv_uploader",
    )

    if uploaded is not None:
        fkey = f"{uploaded.name}_{uploaded.size}"
        if st.session_state.last_file != fkey:
            with st.spinner("Processing…"):
                if uploaded.name.endswith((".xlsx", ".xls")):
                    raw = pd.read_excel(uploaded)
                else:
                    raw = pd.read_csv(uploaded)
                cleaned, report = clean_data(raw)
                if cleaned is not None:
                    clear_data()
                    insert_data(cleaned, source="csv")
                    st.session_state.last_file = fkey
                    st.session_state.clean_report = report
                    st.session_state.forecast_cache = None
                    st.session_state.shap_cache = None
                    st.success(f"{report['final_rows']} rows imported")
                    det = f"Date: `{report['date_col']}`  ·  Revenue: `{report['sales_col']}`"
                    if report.get("income_col"):
                        det += f"  ·  Profit: `{report['income_col']}`"
                    if report.get("cost_col"):
                        det += f"  ·  Cost: `{report['cost_col']}`"
                    if report.get("quantity_col"):
                        det += f"  ·  Qty: `{report['quantity_col']}`"
                    if report.get("product_col"):
                        det += f"  ·  Product: `{report['product_col']}`"
                    if report.get("category_col"):
                        det += f"  ·  Category: `{report['category_col']}`"
                    st.info(det)
                    if report["duplicates_removed"]:
                        st.caption(f"{report['duplicates_removed']} duplicates removed")
                    if report["missing_filled"]:
                        st.caption(f"{report['missing_filled']} missing values interpolated")
                else:
                    st.error(report.get("error", "Unknown error"))

    st.markdown("---")
    row_count = get_row_count()
    st.metric("Rows in Database", f"{row_count:,}")

    if st.button("Generate Sample Data", use_container_width=True):
        np.random.seed(42)
        dates = pd.date_range(end=datetime.now().date(), periods=365, freq="D")
        base = 10_000
        trend = np.linspace(0, 3000, 365)
        seasonal = 2000 * np.sin(np.arange(365) * 2 * np.pi / 365)
        weekly = 1000 * np.sin(np.arange(365) * 2 * np.pi / 7)
        noise = np.random.normal(0, 1000, 365)
        sales = np.maximum(base + trend + seasonal + weekly + noise, 500).round(2)
        costs = (sales * np.random.uniform(0.35, 0.65, 365)).round(2)
        income = (sales - costs).round(2)
        quantity = np.random.randint(1, 20, 365)

        products = np.random.choice(
            ["Laptop", "Phone", "Tablet", "Headphones", "Charger", "Case", "Monitor", "Keyboard"],
            365,
        )
        categories = [
            "Electronics" if p in ("Laptop", "Phone", "Tablet", "Monitor") else "Accessories"
            for p in products
        ]
        sample = pd.DataFrame({
            "date": dates, "sales": sales, "income": income,
            "cost": costs, "quantity": quantity,
            "product": products, "category": categories,
        })
        clear_data()
        insert_data(sample, source="sample")
        st.session_state.forecast_cache = None
        st.session_state.shap_cache = None
        st.success("365 days of sample data generated")
        st.rerun()

    if row_count > 0 and st.button("Clear All Data", use_container_width=True):
        clear_data()
        for k in ("last_file", "forecast_cache", "shap_cache"):
            st.session_state[k] = None
        st.rerun()


# ═════════════════════════════════════════════════════════════════════════════
#  MAIN CONTENT
# ═════════════════════════════════════════════════════════════════════════════
data = get_all_data()

if data.empty:
    st.markdown(f"""
    <div style="text-align:center;padding:80px 20px 40px;">
        <h1 style="font-size:2.8rem;color:{COLORS['text']};margin-bottom:12px;">
            SalesCast Pro
        </h1>
        <p style="font-size:1.15rem;color:{COLORS['muted']};max-width:600px;margin:0 auto 28px;">
            Upload a CSV or generate sample data to unlock dashboards, forecasts,
            anomaly detection, OCR bill scanning, SHAP explainability, and
            smart recommendations.
        </p>
        <p style="color:{COLORS['muted']};">Use the sidebar to get started</p>
    </div>
    """, unsafe_allow_html=True)
    st.stop()


# ── Tabs ─────────────────────────────────────────────────────────────────────
tab_dash, tab_fc, tab_an, tab_bill, tab_ex, tab_rec = st.tabs([
    "Dashboard", "Forecast", "Anomalies",
    "Bill Upload", "Explainability", "Recommendations",
])


# ═════════════════════════════════════════════════════════════════════════════
#  TAB 1 — Dashboard
# ═════════════════════════════════════════════════════════════════════════════
with tab_dash:
    st.markdown("## Sales Dashboard")

    # ── Filter bar ───────────────────────────────────────────────────────
    fc1, fc2, fc3 = st.columns([2, 2, 2])

    with fc1:
        range_opts = ["Last 7 days", "Last 30 days", "Last 90 days",
                      "Last 6 months", "Last 1 year", "All time"]
        date_range = st.selectbox("Date Range", range_opts, index=5, key="dash_range")

    has_product  = "product"  in data.columns and data["product"].notna().any()
    has_category = "category" in data.columns and data["category"].notna().any()

    with fc2:
        sel_products = []
        if has_product:
            all_products = sorted(data["product"].dropna().unique())
            sel_products = st.multiselect("Products", all_products, key="dash_prod")

    with fc3:
        sel_categories = []
        if has_category:
            all_categories = sorted(data["category"].dropna().unique())
            sel_categories = st.multiselect("Categories", all_categories, key="dash_cat")

    # Apply filters
    filtered = data.copy()
    delta_map = {
        "Last 7 days": timedelta(days=7),
        "Last 30 days": timedelta(days=30),
        "Last 90 days": timedelta(days=90),
        "Last 6 months": timedelta(days=180),
        "Last 1 year": timedelta(days=365),
    }
    if date_range in delta_map:
        cutoff = pd.Timestamp(datetime.now()) - delta_map[date_range]
        filtered = filtered[filtered["date"] >= cutoff]
    if sel_products:
        filtered = filtered[filtered["product"].isin(sel_products)]
    if sel_categories:
        filtered = filtered[filtered["category"].isin(sel_categories)]

    if filtered.empty:
        st.warning("No data matches the selected filters.")
        st.stop()

    kpis = compute_kpis(filtered)

    # ── KPI cards (dynamic based on available data) ────────────────────
    kpi_items = [
        ("Total Revenue", fmt_inr(kpis["total_sales"]), "", "blue"),
    ]
    if kpis["has_profit"] and kpis["total_profit"] is not None:
        kpi_items.append(("Total Profit", fmt_inr(kpis["total_profit"]),
                          "", "green" if kpis["total_profit"] >= 0 else "red"))
        kpi_items.append(("Profit Margin", f"{kpis['margin_pct']:.1f}%",
                          "", "green" if kpis["margin_pct"] >= 20 else "orange"))
    kpi_items.append(("Avg Daily Sales", fmt_inr(kpis["avg_daily"]), "", "purple"))
    kpi_items.append(("Days Tracked", str(kpis["num_days"]), "", "orange"))
    if kpis.get("has_quantity") and kpis["total_quantity"]:
        kpi_items.append(("Units Sold", f"{kpis['total_quantity']:,}", "", "cyan"))

    cols = st.columns(len(kpi_items))
    for col, (label, value, sub, accent) in zip(cols, kpi_items):
        with col:
            st.markdown(kpi_card_html(label, value, subtitle=sub, accent=accent),
                        unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Revenue / Profit trend ───────────────────────────────────────────
    st.plotly_chart(plot_revenue_trend(filtered), use_container_width=True)

    # ── Day-of-week + Monthly ────────────────────────────────────────────
    col_dw, col_mo = st.columns(2)
    with col_dw:
        st.plotly_chart(plot_day_of_week(filtered), use_container_width=True)
    with col_mo:
        st.plotly_chart(plot_monthly_comparison(filtered), use_container_width=True)

    # ── Product / Category breakdown ─────────────────────────────────────
    col_a, col_b = st.columns(2)
    with col_a:
        fig = plot_top_products(filtered, "product")
        if fig:
            st.plotly_chart(fig, use_container_width=True)
    with col_b:
        fig = plot_top_products(filtered, "category")
        if fig:
            st.plotly_chart(fig, use_container_width=True)

    # ── Auto-summary ─────────────────────────────────────────────────────
    st.markdown("### Insights")
    st.markdown(
        f'<div class="summary-box">{generate_summary(filtered, kpis)}</div>',
        unsafe_allow_html=True,
    )

    with st.expander("View Raw Data"):
        st.dataframe(
            filtered.drop(columns=["id", "created_at"], errors="ignore"),
            use_container_width=True,
        )


# ═════════════════════════════════════════════════════════════════════════════
#  TAB 2 — Forecast
# ═════════════════════════════════════════════════════════════════════════════
with tab_fc:
    st.markdown("## Sales Forecast")

    daily_count = data["date"].dt.date.nunique()
    if daily_count < 14:
        st.warning(f"Only {daily_count} unique days — need at least 14 for forecasting.")
    else:
        periods = st.slider("Forecast horizon (days)", 1, 30, 7, key="fc_slider")
        run_fc = st.button("Run Forecast", type="primary", use_container_width=True)

        ckey = f"{len(data)}_{periods}"
        has_cache = (st.session_state.forecast_cache is not None
                     and st.session_state.forecast_cache_key == ckey)

        if run_fc or has_cache:
            with st.spinner("Fitting Prophet model…"):
                if not has_cache:
                    try:
                        _, forecast, _ = train_and_forecast(data, periods)
                        st.session_state.forecast_cache = forecast
                        st.session_state.forecast_cache_key = ckey
                    except Exception as e:
                        st.error(f"Forecasting failed: {e}")
                        st.stop()
                forecast = st.session_state.forecast_cache

            st.plotly_chart(plot_forecast(data, forecast, periods), use_container_width=True)

            nxt = get_next_day_prediction(forecast)
            nc1, nc2, nc3 = st.columns(3)
            with nc1:
                st.markdown(kpi_card_html("Next-Day Prediction", fmt_inr(nxt["predicted"]),
                                          accent="cyan"), unsafe_allow_html=True)
            with nc2:
                st.markdown(kpi_card_html("Lower Bound", fmt_inr(nxt["lower"]),
                                          accent="orange"), unsafe_allow_html=True)
            with nc3:
                st.markdown(kpi_card_html("Upper Bound", fmt_inr(nxt["upper"]),
                                          accent="green"), unsafe_allow_html=True)

            st.markdown("### Detailed Forecast")
            hist_max = data.groupby(data["date"].dt.date)["sales"].sum().reset_index()
            hist_max.columns = ["date", "sales"]
            hist_max["date"] = pd.to_datetime(hist_max["date"])
            cutoff = hist_max["date"].max()
            ft = forecast.loc[forecast["ds"] > cutoff, ["ds","yhat","yhat_lower","yhat_upper"]].copy()
            ft.columns = ["Date", "Predicted (₹)", "Lower (₹)", "Upper (₹)"]
            for c in ft.columns[1:]:
                ft[c] = ft[c].round(2)
            st.dataframe(ft, use_container_width=True, hide_index=True)


# ═════════════════════════════════════════════════════════════════════════════
#  TAB 3 — Anomalies
# ═════════════════════════════════════════════════════════════════════════════
with tab_an:
    st.markdown("## Anomaly Detection")
    st.caption("Flags unusual spikes or drops using the IQR method.")

    sens = st.slider("Sensitivity  (lower = more sensitive)", 1.0, 3.0, 1.5, 0.1,
                     key="an_sens")
    daily_data, anomalies = detect_anomalies(data, threshold=sens)
    st.plotly_chart(plot_anomalies(daily_data, anomalies), use_container_width=True)

    if len(anomalies):
        ct = len(anomalies)
        st.markdown(f"### {ct} Anomal{'y' if ct == 1 else 'ies'} Detected")
        for exp in explain_anomalies(anomalies, daily_data):
            st.markdown(exp)
    else:
        st.success("No anomalies at this sensitivity level.")


# ═════════════════════════════════════════════════════════════════════════════
#  TAB 4 — Bill Upload (OCR)
# ═════════════════════════════════════════════════════════════════════════════
with tab_bill:
    st.markdown("## Bill / Receipt Upload")
    st.markdown("Upload a receipt photo to extract items via OCR and add them to your data.")

    bill_file = st.file_uploader("Upload bill image", type=["png","jpg","jpeg","webp"],
                                 key="bill_up")
    if bill_file is not None:
        from PIL import Image
        image = Image.open(bill_file)
        ci, cr = st.columns(2)
        with ci:
            st.image(image, caption="Uploaded Receipt", use_container_width=True)
        with cr:
            with st.spinner("Running OCR…"):
                result, raw = extract_bill_data(np.array(image))
            if result is None:
                st.error(raw)
            else:
                st.markdown("### Extracted Data")
                st.markdown(f"**Date:** {result['date']}")
                if result["items"]:
                    items_df = pd.DataFrame(result["items"])
                    edited = st.data_editor(items_df, use_container_width=True, num_rows="dynamic")
                    if st.button("Add to Database", type="primary", key="add_ocr"):
                        for _, item in edited.iterrows():
                            row = pd.DataFrame([{
                                "date": pd.to_datetime(result["date"]),
                                "sales": float(item["sales"]),
                                "product": item.get("product", "Unknown"),
                            }])
                            insert_data(row, source="ocr")
                        st.session_state.forecast_cache = None
                        st.session_state.shap_cache = None
                        st.success(f"Added {len(edited)} items")
                        st.rerun()
                else:
                    st.warning("Could not extract items. Try a clearer image or add manually below.")
                with st.expander("Raw OCR Text"):
                    st.code(result["raw_text"])

    st.markdown("---")
    st.markdown("### Manual Entry")
    with st.form("manual", clear_on_submit=True):
        mc1, mc2, mc3 = st.columns(3)
        with mc1:
            m_date = st.date_input("Date", value=datetime.now().date())
        with mc2:
            m_product = st.text_input("Product / Item")
        with mc3:
            m_amount = st.number_input("Amount (₹)", min_value=0.0, step=0.01, format="%.2f")
        if st.form_submit_button("Add Entry", type="primary"):
            if m_amount > 0:
                row = pd.DataFrame([{
                    "date": pd.to_datetime(m_date),
                    "sales": m_amount,
                    "product": m_product or "Manual Entry",
                }])
                insert_data(row, source="manual")
                st.session_state.forecast_cache = None
                st.session_state.shap_cache = None
                st.success("Entry added")
                st.rerun()
            else:
                st.warning("Amount must be greater than 0")


# ═════════════════════════════════════════════════════════════════════════════
#  TAB 5 — Explainability
# ═════════════════════════════════════════════════════════════════════════════
with tab_ex:
    st.markdown("## Forecast Explainability")
    st.markdown(
        "An XGBoost model is trained on time-based features and SHAP "
        "shows which factors matter most."
    )
    dc_ex = data["date"].dt.date.nunique()
    if dc_ex < 35:
        st.warning(f"Only {dc_ex} unique days — need at least 35 for SHAP analysis.")
    else:
        run_sh = st.button("Run SHAP Analysis", type="primary", use_container_width=True)
        if run_sh or st.session_state.shap_cache is not None:
            with st.spinner("Computing SHAP values…"):
                if st.session_state.shap_cache is None:
                    try:
                        model, X, y, feats = train_xgboost_model(data)
                        sv, _ = compute_shap_values(model, X)
                        st.session_state.shap_cache = {"shap_values": sv, "features": feats}
                    except Exception as e:
                        st.error(f"SHAP failed: {e}")
                        st.stop()
            cache = st.session_state.shap_cache
            st.plotly_chart(
                plot_feature_importance(cache["shap_values"], cache["features"]),
                use_container_width=True,
            )
            drivers = get_top_drivers(cache["shap_values"], cache["features"])
            st.markdown("### Key Takeaways")
            st.markdown(
                f'<div class="summary-box">'
                f"The top factors driving predictions are "
                f"<b>{drivers[0]}</b>, <b>{drivers[1]}</b>, and <b>{drivers[2]}</b>. "
                f"Sales are most influenced by recent momentum and temporal patterns. "
                f"Use these insights to plan inventory and staffing."
                f"</div>",
                unsafe_allow_html=True,
            )


# ═════════════════════════════════════════════════════════════════════════════
#  TAB 6 — Recommendations
# ═════════════════════════════════════════════════════════════════════════════
with tab_rec:
    st.markdown("## Smart Recommendations")
    st.caption("Rule-based alerts derived from sales velocity, trends, and forecasts.")

    recs = generate_recommendations(data, st.session_state.get("forecast_cache"))
    for rec in recs:
        st.markdown(
            f'<div class="rec-card {rec["type"]}">'
            f'<h3>{rec["title"]}</h3>'
            f'<p>{rec["message"]}</p>'
            f'<span style="font-size:0.78rem;text-transform:uppercase;'
            f'color:{COLORS["muted"]};">Priority: {rec["priority"]}</span>'
            f"</div>",
            unsafe_allow_html=True,
        )
    st.markdown("<br>", unsafe_allow_html=True)
    st.info("Run a Forecast first to unlock forecast-based recommendations.")
