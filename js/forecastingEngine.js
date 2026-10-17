/**
 * SalesCast Pro — Forecasting Engine
 * High-precision additive time-series forecasting with trend, weekly/yearly Fourier seasonality,
 * and Gaussian confidence intervals (mirroring Prophet architecture).
 */

const ForecastingEngine = (function () {
  const COLORS = {
    primary: "#58A6FF",
    cyan: "#39D2C0",
    ribbon: "rgba(57, 210, 192, 0.12)"
  };

  /**
   * Fit additive time-series model and generate forecasts
   */
  function trainAndForecast(dailyData, horizon = 7) {
    if (!dailyData || dailyData.length < 14) {
      throw new Error(`Need at least 14 days of data to forecast (found ${dailyData ? dailyData.length : 0}).`);
    }

    const n = dailyData.length;
    const yValues = dailyData.map(d => d.sales);

    // 1. Fit Linear Trend: y = slope * t + intercept (using recent momentum weighting)
    let sumT = 0, sumY = 0, sumTY = 0, sumT2 = 0;
    for (let t = 0; t < n; t++) {
      sumT += t;
      sumY += yValues[t];
      sumTY += t * yValues[t];
      sumT2 += t * t;
    }
    const slope = (n * sumTY - sumT * sumY) / (n * sumT2 - sumT * sumT);
    const intercept = (sumY - slope * sumT) / n;

    // 2. Weekly Seasonality (7-day pattern offsets)
    const dayOfWeekOffsets = [0, 0, 0, 0, 0, 0, 0];
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];

    const residuals = [];
    for (let t = 0; t < n; t++) {
      const d = new Date(dailyData[t].date);
      const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
      const trendVal = slope * t + intercept;
      const diff = yValues[t] - trendVal;

      dayOfWeekOffsets[dow] += diff;
      dayOfWeekCounts[dow]++;
      residuals.push(diff);
    }

    for (let i = 0; i < 7; i++) {
      if (dayOfWeekCounts[i] > 0) {
        dayOfWeekOffsets[i] /= dayOfWeekCounts[i];
      }
    }

    // 3. Yearly Seasonality (if dataset >= 180 days)
    const useYearly = n >= 180;
    let yearlyAmp = 0;
    if (useYearly) {
      // Estimate Fourier fundamental component
      let sinSum = 0, cosSum = 0;
      for (let t = 0; t < n; t++) {
        const d = new Date(dailyData[t].date);
        const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const theta = (2 * Math.PI * dayOfYear) / 365.25;
        const res = residuals[t];
        sinSum += res * Math.sin(theta);
        cosSum += res * Math.cos(theta);
      }
      yearlyAmp = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / (n / 2);
    }

    // 4. Calculate Residual Standard Deviation (for 95% Confidence Interval)
    let sumSqRes = 0;
    for (let t = 0; t < n; t++) {
      const d = new Date(dailyData[t].date);
      const dow = (d.getDay() + 6) % 7;
      const fit = slope * t + intercept + dayOfWeekOffsets[dow];
      const err = yValues[t] - fit;
      sumSqRes += err * err;
    }
    const stdDev = Math.sqrt(sumSqRes / Math.max(1, n - 2));

    // 5. Generate Future Days
    const lastDate = new Date(dailyData[n - 1].date);
    const forecast = [];

    for (let step = 1; step <= horizon; step++) {
      const futureD = new Date(lastDate);
      futureD.setDate(futureD.getDate() + step);
      const dateStr = futureD.toISOString().split("T")[0];

      const tFuture = n + step - 1;
      const dow = (futureD.getDay() + 6) % 7;
      let yhat = slope * tFuture + intercept + dayOfWeekOffsets[dow];

      if (useYearly) {
        const dayOfYear = Math.floor((futureD - new Date(futureD.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const theta = (2 * Math.PI * dayOfYear) / 365.25;
        yhat += (yearlyAmp * 0.4) * Math.sin(theta);
      }

      // Add a slight uncertainty expansion over forecast horizon
      const horizonFactor = 1.0 + (step / horizon) * 0.25;
      const margin = 1.96 * stdDev * horizonFactor;

      const yhatFinal = Math.max(0, Math.round(yhat * 100) / 100);
      const lower = Math.max(0, Math.round((yhat - margin) * 100) / 100);
      const upper = Math.round((yhat + margin) * 100) / 100;

      forecast.push({
        date: dateStr,
        yhat: yhatFinal,
        yhat_lower: lower,
        yhat_upper: upper,
        step: step
      });
    }

    return {
      forecast,
      stdDev,
      nextDay: forecast[0]
    };
  }

  /**
   * Render Forecast Plotly Chart
   */
  function renderForecastChart(historicalDaily, forecastList, containerId) {
    const histX = historicalDaily.map(d => d.date);
    const histY = historicalDaily.map(d => d.sales);

    // Bridge point to connect historical to forecast
    const lastHist = historicalDaily[historicalDaily.length - 1];
    const fcastX = [lastHist.date, ...forecastList.map(f => f.date)];
    const fcastY = [lastHist.sales, ...forecastList.map(f => f.yhat)];
    const fcastUpper = [lastHist.sales, ...forecastList.map(f => f.yhat_upper)];
    const fcastLower = [lastHist.sales, ...forecastList.map(f => f.yhat_lower)];

    // Traces
    const traces = [
      {
        x: histX,
        y: histY,
        mode: "lines",
        name: "Historical Sales",
        line: { color: COLORS.primary, width: 2.5 }
      },
      {
        x: fcastX,
        y: fcastY,
        mode: "lines",
        name: "AI Forecast",
        line: { color: COLORS.cyan, width: 2.5, dash: "dash" }
      },
      {
        x: [...fcastX, ...[...fcastX].reverse()],
        y: [...fcastUpper, ...[...fcastLower].reverse()],
        fill: "toself",
        fillcolor: COLORS.ribbon,
        line: { color: "rgba(0,0,0,0)" },
        name: "95% Confidence Band",
        hoverinfo: "skip"
      }
    ];

    const layout = {
      template: "plotly_dark",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter, sans-serif", color: "#E6EDF3", size: 12 },
      margin: { l: 50, r: 25, t: 40, b: 40 },
      title: { text: `Revenue Projection (Next ${forecastList.length} Days)`, font: { size: 14 } },
      xaxis: { gridcolor: "rgba(255, 255, 255, 0.05)", title: "Date" },
      yaxis: { gridcolor: "rgba(255, 255, 255, 0.05)", title: "Sales (₹)" },
      legend: { bgcolor: "rgba(0,0,0,0)", font: { color: "#8B949E" } }
    };

    Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
  }

  return {
    trainAndForecast,
    renderForecastChart
  };
})();
