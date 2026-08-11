# SalesCast Pro 📈

AI-powered sales forecasting, anomaly detection, and business intelligence — all from a simple CSV upload.

Built with Python · Streamlit · Prophet · XGBoost · SHAP · EasyOCR · SQLite

---

## ✨ Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **CSV Upload + Auto-Cleaning** | Auto-detects date & sales columns, handles missing values, deduplicates |
| 2 | **Dashboard** | Revenue trend, KPI cards, product breakdown, auto-generated insights |
| 3 | **Forecasting** | Prophet-based 1–30 day forecast with confidence intervals |
| 4 | **Anomaly Detection** | IQR-based spike/drop detection with plain-English explanations |
| 5 | **Bill OCR** | Upload a receipt photo → extract items via EasyOCR → add to database |
| 6 | **Explainability** | SHAP feature importance showing what drives each prediction |
| 7 | **Recommendations** | Restock alerts, slow-mover flags, trend & forecast insights |

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/salescast-pro.git
cd salescast-pro
```

### 2. Create a virtual environment (recommended)
```bash
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the app
```bash
streamlit run app.py
```

The app opens at `http://localhost:8501`. Click **🎲 Generate Sample Data** in the sidebar to explore all features instantly.

---

## 📁 Project Structure

```
salescast-pro/
├── app.py                    # Main Streamlit app (entry point)
├── requirements.txt          # Python dependencies
├── .streamlit/
│   └── config.toml           # Dark theme configuration
├── db/
│   ├── __init__.py
│   └── database.py           # SQLite CRUD helpers
├── utils/
│   ├── __init__.py
│   ├── cleaning.py           # Column auto-detection + data cleaning
│   ├── dashboard.py          # KPIs, charts, auto-summary
│   ├── forecasting.py        # Prophet forecasting
│   ├── anomaly.py            # IQR anomaly detection
│   ├── ocr_utils.py          # EasyOCR receipt extraction
│   ├── explainability.py     # XGBoost + SHAP analysis
│   ├── recommendations.py    # Rule-based business alerts
│   └── styles.py             # CSS + Plotly theme constants
├── data/
│   └── .gitkeep              # SQLite DB is created here at runtime
└── .gitignore
```

---

## 🧠 Key Design Decisions

- **Auto-detection over hardcoding** — The app scores each CSV column with heuristics (parse success rate, keyword matching) instead of requiring specific column names.
- **SQLite for persistence** — Zero-config, file-based database that survives Streamlit reruns. Gives a real "data layer" to talk about in interviews.
- **Prophet for forecasting** — Handles seasonality, trends, and missing data out of the box. Minimal tuning needed for a demo.
- **XGBoost + SHAP for explainability** — Since Prophet doesn't expose features SHAP can consume, we engineer 12 time-based features and train XGBoost as an interpretable proxy model.
- **Rule-based recommendations** — Transparent logic (if velocity > X → restock) that's easy to debug and explain.

---

## ☁️ Deploy to Streamlit Cloud

1. Push this repo to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your repo → set `app.py` as the entry point
4. Deploy!

---

## 📄 License

MIT
