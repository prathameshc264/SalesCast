# SalesCast Pro 📈

AI-powered sales forecasting, anomaly detection, receipt OCR, and business intelligence — optimized for instant deployment on **Vercel** and local execution with **Streamlit**.

Built with **JavaScript · Plotly.js · Tesseract OCR · CSS Design System** (Vercel) + **Python · Streamlit · Prophet · XGBoost · EasyOCR** (Local)

---

## ⚡ Live Vercel Deployment (1-Click)

This repository is pre-configured with [vercel.json](file:///d:/SalesCast_2/vercel.json) and [.vercelignore](file:///d:/SalesCast_2/.vercelignore) for native, high-speed static deployment on Vercel:

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Configure SalesCast Pro for Vercel deployment"
   git push origin main
   ```
2. Go to **[vercel.com/new](https://vercel.com/new)**.
3. Import your GitHub repository (`salescast-pro`).
4. Click **Deploy**!
   - Build completes in ~1 second with zero dependency bottlenecks.
   - Live URL: `https://your-project.vercel.app`

---

## ✨ Features

| # | Feature | Description | Engine |
|---|---------|-------------|--------|
| 1 | **CSV Upload + Auto-Cleaning** | Auto-detects date & sales columns, handles missing values, deduplicates | `dataEngine.js` / `cleaning.py` |
| 2 | **Interactive Dashboard** | Revenue trend, KPI cards, product & category breakdown, auto-generated insights | `analyticsEngine.js` / Plotly |
| 3 | **Forecasting** | Prophet-style additive model with trend, weekly/yearly Fourier seasonality, and 95% confidence bounds | `forecastingEngine.js` / Prophet |
| 4 | **Anomaly Detection** | Statistical IQR spike/drop detection with plain-English diagnostic explanations | `anomalyEngine.js` |
| 5 | **Bill OCR** | Upload a receipt photo → extract merchant, date, and line items → add to sales database | `ocrEngine.js` / Tesseract |
| 6 | **Explainability** | Evaluates 12 temporal, momentum, and lag features to determine what drives your sales | `explainabilityEngine.js` / SHAP |
| 7 | **Recommendations** | Restock alerts, slow-mover warnings, weekend/weekday imbalances, margin health | `recommendationsEngine.js` |

---

## 🚀 Local Development

### Option A: Open directly in Browser (Zero Install)
Double click [index.html](file:///d:/SalesCast_2/index.html) or start any local server:
```bash
python -m http.server 3000
```
Open `http://localhost:3000`.

### Option B: Run Streamlit (Python)
Double-click [launch.bat](file:///d:/SalesCast_2/launch.bat) or run:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```
Open `http://localhost:8501`.

---

## 📁 Project Structure

```
salescast-pro/
├── index.html                # Vercel entry point (Full SPA Dashboard)
├── vercel.json               # Vercel configuration
├── .vercelignore             # Prevents serverless entry point collisions
├── css/
│   └── style.css             # GitHub Dark glassmorphism design system
├── js/
│   ├── app.js                # UI state & tab controller
│   ├── dataEngine.js         # CSV cleaning & 365-day realistic generator
│   ├── analyticsEngine.js    # KPIs, summaries & Plotly charts
│   ├── forecastingEngine.js  # Additive time-series forecasting model
│   ├── anomalyEngine.js      # IQR anomaly detection & diagnostics
│   ├── explainabilityEngine.js # 12-feature drivers analysis
│   ├── recommendationsEngine.js # Business rules engine
│   └── ocrEngine.js          # Receipt OCR scanner & parser
├── assets/
│   └── sample_receipt.jpg    # Verified sample receipt for instant testing
├── app.py                    # Streamlit application
├── requirements.txt          # Python dependencies
├── launch.bat                # 1-click local Streamlit runner
├── db/                       # SQLite data layer for Python
└── utils/                    # Python modules for Streamlit
```

---

## 📄 License
MIT
