/**
 * SalesCast Pro — Anomaly Detection Engine
 * Interquartile Range (IQR) method for spike and drop detection with natural language diagnostics.
 */

const AnomalyEngine = (function () {
  const COLORS = {
    primary: "#58A6FF",
    red: "#F85149",
    orange: "#D29922",
    corridor: "rgba(88, 166, 255, 0.04)"
  };

  /**
   * Calculate percentile of sorted array
   */
  function quantile(sortedArr, q) {
    const pos = (sortedArr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
    } else {
      return sortedArr[base];
    }
  }

  /**
   * Detect anomalies in daily sales using the IQR method
   */
  function detectAnomalies(dailyData, threshold = 1.5) {
    if (!dailyData || dailyData.length < 5) {
      return { daily: dailyData || [], anomalies: [], stats: { total: 0, spikes: 0, drops: 0 } };
    }

    const sortedSales = dailyData.map(d => d.sales).sort((a, b) => a - b);
    const q1 = quantile(sortedSales, 0.25);
    const q3 = quantile(sortedSales, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - threshold * iqr;
    const upperBound = q3 + threshold * iqr;

    const totalSales = dailyData.reduce((acc, d) => acc + d.sales, 0);
    const avg = totalSales / dailyData.length;

    const annotatedDaily = [];
    const anomalies = [];
    let spikes = 0, drops = 0;

    for (const d of dailyData) {
      const isHigh = d.sales > upperBound;
      const isLow = d.sales < lowerBound;
      const isAnomaly = isHigh || isLow;
      const type = isHigh ? "high" : isLow ? "low" : "normal";

      const record = {
        ...d,
        upperBound,
        lowerBound,
        isAnomaly,
        anomalyType: type
      };
      annotatedDaily.push(record);

      if (isAnomaly) {
        if (isHigh) spikes++;
        else drops++;

        const pct = Math.abs((d.sales - avg) / avg * 100);
        const dateObj = new Date(d.date);
        const dateFormatted = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

        const explanation = isHigh
          ? `Revenue of ${DataEngine.fmtINR(d.sales)} was ${pct.toFixed(0)}% above average (${DataEngine.fmtINR(avg)}). Possible cause: promotion, marketing spike, or large bulk purchase.`
          : `Revenue of ${DataEngine.fmtINR(d.sales)} was ${pct.toFixed(0)}% below average (${DataEngine.fmtINR(avg)}). Possible cause: supply stockout, technical outage, holiday, or temporary market dip.`;

        anomalies.push({
          date: d.date,
          dateFormatted,
          sales: d.sales,
          type,
          pct: Math.round(pct),
          explanation
        });
      }
    }

    return {
      daily: annotatedDaily,
      anomalies,
      stats: {
        total: anomalies.length,
        spikes,
        drops,
        upperBound,
        lowerBound,
        avg
      }
    };
  }

  /**
   * Render Anomaly Detection Chart
   */
  function renderAnomalyChart(annotatedDaily, anomalies, containerId) {
    const x = annotatedDaily.map(d => d.date);
    const y = annotatedDaily.map(d => d.sales);
    const upper = annotatedDaily.map(d => d.upperBound);
    const lower = annotatedDaily.map(d => d.lowerBound);

    const traces = [
      {
        x: x,
        y: y,
        mode: "lines",
        name: "Daily Revenue",
        line: { color: COLORS.primary, width: 2 }
      },
      {
        x: x,
        y: upper,
        mode: "lines",
        name: "Upper Bound",
        line: { color: "rgba(248, 81, 73, 0.4)", width: 1.5, dash: "dot" }
      },
      {
        x: x,
        y: lower,
        mode: "lines",
        name: "Lower Bound",
        line: { color: "rgba(210, 153, 34, 0.4)", width: 1.5, dash: "dot" },
        fill: "tonexty",
        fillcolor: COLORS.corridor
      }
    ];

    // High spikes
    const highPoints = anomalies.filter(a => a.type === "high");
    if (highPoints.length) {
      traces.push({
        x: highPoints.map(p => p.date),
        y: highPoints.map(p => p.sales),
        mode: "markers",
        name: "Spike (+)",
        marker: {
          color: COLORS.red,
          size: 11,
          symbol: "triangle-up",
          line: { width: 1.5, color: "#FFFFFF" }
        }
      });
    }

    // Low drops
    const lowPoints = anomalies.filter(a => a.type === "low");
    if (lowPoints.length) {
      traces.push({
        x: lowPoints.map(p => p.date),
        y: lowPoints.map(p => p.sales),
        mode: "markers",
        name: "Drop (-)",
        marker: {
          color: COLORS.orange,
          size: 11,
          symbol: "triangle-down",
          line: { width: 1.5, color: "#FFFFFF" }
        }
      });
    }

    const layout = {
      template: "plotly_dark",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter, sans-serif", color: "#E6EDF3", size: 12 },
      margin: { l: 50, r: 25, t: 40, b: 40 },
      title: { text: "Statistical Anomaly Boundaries (IQR Method)", font: { size: 14 } },
      xaxis: { gridcolor: "rgba(255, 255, 255, 0.05)", title: "Date" },
      yaxis: { gridcolor: "rgba(255, 255, 255, 0.05)", title: "Sales (₹)" },
      legend: { bgcolor: "rgba(0,0,0,0)", font: { color: "#8B949E" } }
    };

    Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
  }

  return {
    detectAnomalies,
    renderAnomalyChart
  };
})();
