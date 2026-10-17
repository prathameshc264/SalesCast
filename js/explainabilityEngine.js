/**
 * SalesCast Pro — AI Explainability Engine
 * Feature engineering and feature importance ranking (SHAP-style proxy analysis)
 * revealing the drivers behind sales forecasts.
 */

const ExplainabilityEngine = (function () {
  const NAME_MAP = {
    day_of_week: "Day of Week",
    month: "Month",
    day_of_month: "Day of Month",
    week_of_year: "Week of Year",
    is_weekend: "Weekend Effect",
    quarter: "Quarter",
    days_since_start: "Trend (Time)",
    lag_1: "Previous Day Sales",
    lag_7: "Same Day Last Week",
    rolling_mean_7: "7-Day Average",
    rolling_std_7: "7-Day Volatility",
    rolling_mean_30: "30-Day Average"
  };

  /**
   * Engineer 12 time-series features
   */
  function engineerFeatures(dailyData) {
    if (!dailyData || dailyData.length < 35) {
      return null;
    }

    const n = dailyData.length;
    const minDate = new Date(dailyData[0].date).getTime();
    const rows = [];

    for (let i = 0; i < n; i++) {
      const d = new Date(dailyData[i].date);
      const sales = dailyData[i].sales;

      // Temporal features
      const dow = (d.getDay() + 6) % 7;
      const month = d.getMonth() + 1;
      const dom = d.getDate();
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekOfYear = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const isWeekend = dow >= 5 ? 1 : 0;
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      const daysSinceStart = Math.floor((d.getTime() - minDate) / 86400000);

      // Lag features
      const lag1 = i >= 1 ? dailyData[i - 1].sales : null;
      const lag7 = i >= 7 ? dailyData[i - 7].sales : null;

      // Rolling features
      let rm7 = null, rs7 = null, rm30 = null;
      if (i >= 6) {
        const slice7 = dailyData.slice(i - 6, i + 1).map(x => x.sales);
        const mean7 = slice7.reduce((a, b) => a + b, 0) / 7;
        const variance7 = slice7.reduce((a, b) => a + Math.pow(b - mean7, 2), 0) / 7;
        rm7 = mean7;
        rs7 = Math.sqrt(variance7);
      }
      if (i >= 29) {
        const slice30 = dailyData.slice(i - 29, i + 1).map(x => x.sales);
        rm30 = slice30.reduce((a, b) => a + b, 0) / 30;
      }

      // Keep only complete rows
      if (i >= 30) {
        rows.push({
          target: sales,
          day_of_week: dow,
          month: month,
          day_of_month: dom,
          week_of_year: weekOfYear,
          is_weekend: isWeekend,
          quarter: quarter,
          days_since_start: daysSinceStart,
          lag_1: lag1,
          lag_7: lag7,
          rolling_mean_7: rm7,
          rolling_std_7: rs7,
          rolling_mean_30: rm30
        });
      }
    }

    return rows;
  }

  /**
   * Compute feature importance via absolute Pearson correlation & variance sensitivity
   */
  function computeImportance(featureRows) {
    if (!featureRows || !featureRows.length) return [];

    const featureKeys = Object.keys(NAME_MAP);
    const n = featureRows.length;
    const targetVals = featureRows.map(r => r.target);
    const targetMean = targetVals.reduce((a, b) => a + b, 0) / n;

    const scores = [];

    for (const key of featureKeys) {
      const vals = featureRows.map(r => r[key]);
      const mean = vals.reduce((a, b) => a + b, 0) / n;

      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = vals[i] - mean;
        const dy = targetVals[i] - targetMean;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }

      const denom = Math.sqrt(denX * denY);
      const r = denom > 0 ? Math.abs(num / denom) : 0;

      // Weight lag and rolling indicators slightly higher to reflect time-series momentum
      const weight = ["rolling_mean_7", "lag_7", "lag_1", "day_of_week"].includes(key) ? 1.25 : 1.0;
      const finalScore = r * weight;

      scores.push({
        key,
        name: NAME_MAP[key],
        score: finalScore
      });
    }

    // Sort ascending for horizontal bar chart
    scores.sort((a, b) => a.score - b.score);
    return scores;
  }

  /**
   * Render Feature Importance Chart
   */
  function renderFeatureImportanceChart(scores, containerId) {
    const trace = {
      x: scores.map(s => Math.round(s.score * 1000) / 1000),
      y: scores.map(s => s.name),
      type: "bar",
      orientation: "h",
      marker: {
        color: scores.map(s => s.score),
        colorscale: [[0, "#1F6FEB"], [1, "#BC8CFF"]]
      }
    };

    const layout = {
      template: "plotly_dark",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter, sans-serif", color: "#E6EDF3", size: 12 },
      margin: { l: 150, r: 25, t: 40, b: 40 },
      title: { text: "Forecast Driver Importance (SHAP-Style Proxy)", font: { size: 14 } },
      xaxis: { gridcolor: "rgba(255, 255, 255, 0.05)", title: "Mean Impact Score" },
      yaxis: { automargin: true }
    };

    Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  return {
    engineerFeatures,
    computeImportance,
    renderFeatureImportanceChart
  };
})();
