/**
 * SalesCast Pro — Analytics & Dashboard Engine
 * Computes KPIs, executive summaries, and renders Plotly charts with the GitHub Dark theme.
 */

const AnalyticsEngine = (function () {
  // Plotly Dark Theme configuration matching utils/styles.py
  const PLOTLY_THEME = {
    template: "plotly_dark",
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      family: "Inter, sans-serif",
      color: "#E6EDF3",
      size: 12
    },
    margin: { l: 50, r: 25, t: 40, b: 40 },
    xaxis: {
      gridcolor: "rgba(255, 255, 255, 0.05)",
      zerolinecolor: "rgba(255, 255, 255, 0.1)"
    },
    yaxis: {
      gridcolor: "rgba(255, 255, 255, 0.05)",
      zerolinecolor: "rgba(255, 255, 255, 0.1)"
    },
    legend: {
      bgcolor: "rgba(0,0,0,0)",
      font: { color: "#8B949E" }
    }
  };

  const COLORS = {
    primary: "#58A6FF",
    green: "#3FB950",
    orange: "#D29922",
    red: "#F85149",
    purple: "#BC8CFF",
    cyan: "#39D2C0"
  };

  /**
   * Filter dataset by date range, category, and product
   */
  function filterData(data, filters = {}) {
    if (!data || !data.length) return [];
    let res = [...data];

    if (filters.startDate) {
      res = res.filter(r => r.date >= filters.startDate);
    }
    if (filters.endDate) {
      res = res.filter(r => r.date <= filters.endDate);
    }
    if (filters.category && filters.category !== "all") {
      res = res.filter(r => r.category === filters.category);
    }
    if (filters.product && filters.product !== "all") {
      res = res.filter(r => r.product === filters.product);
    }
    return res;
  }

  /**
   * Aggregate data by day
   */
  function aggregateDaily(data) {
    const dailyMap = new Map();
    for (const r of data) {
      const d = r.date;
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { date: d, sales: 0, income: 0, cost: 0, count: 0, quantity: 0 });
      }
      const item = dailyMap.get(d);
      item.sales += r.sales || 0;
      item.income += r.income || 0;
      item.cost += r.cost || 0;
      item.quantity += r.quantity || 0;
      item.count++;
    }
    const list = Array.from(dailyMap.values());
    list.sort((a, b) => (a.date > b.date ? 1 : -1));
    return list;
  }

  /**
   * Compute KPIs mirroring compute_kpis in utils/dashboard.py
   */
  function computeKPIs(data) {
    if (!data || !data.length) {
      return {
        totalSales: 0,
        avgDaily: 0,
        growthPct: 0,
        numDays: 0,
        dateRange: ["-", "-"],
        hasProfit: false,
        totalProfit: 0,
        marginPct: 0,
        totalQuantity: 0,
        transactionCount: 0
      };
    }

    const totalSales = data.reduce((acc, r) => acc + (r.sales || 0), 0);
    const daily = aggregateDaily(data);
    const numDays = daily.length;
    const avgDaily = numDays ? totalSales / numDays : 0;

    // Period-over-period growth (midpoint split)
    let growthPct = 0;
    if (daily.length >= 2) {
      const mid = Math.floor(daily.length / 2);
      const firstHalf = daily.slice(0, mid).reduce((acc, r) => acc + r.sales, 0);
      const secondHalf = daily.slice(mid).reduce((acc, r) => acc + r.sales, 0);
      growthPct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    }

    // Profit & Cost checks
    const hasIncome = data.some(r => r.income !== null && r.income !== undefined);
    const hasCost = data.some(r => r.cost !== null && r.cost !== undefined);
    const hasProfit = hasIncome || hasCost;

    let totalProfit = 0;
    if (hasIncome) {
      totalProfit = data.reduce((acc, r) => acc + (r.income || 0), 0);
    } else if (hasCost) {
      const totalCost = data.reduce((acc, r) => acc + (r.cost || 0), 0);
      totalProfit = totalSales - totalCost;
    }

    const marginPct = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    const totalQuantity = data.reduce((acc, r) => acc + (r.quantity || 1), 0);

    return {
      totalSales,
      avgDaily,
      growthPct,
      numDays,
      dateRange: [daily[0].date, daily[daily.length - 1].date],
      hasProfit,
      totalProfit,
      marginPct,
      totalQuantity,
      transactionCount: data.length
    };
  }

  /**
   * Auto-generated business insights narrative
   */
  function generateSummary(data, kpis) {
    if (!data || !data.length) return "Upload a CSV file or generate sample data to view insights.";

    const dStart = new Date(kpis.dateRange[0]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const dEnd = new Date(kpis.dateRange[1]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const direction = kpis.growthPct >= 0 ? "grown" : "declined";

    let s = `Your dataset spans <b>${dStart}</b> to <b>${dEnd}</b> (${kpis.numDays} days). ` +
      `Total revenue stands at <b>${DataEngine.fmtINR(kpis.totalSales)}</b> with a daily average of <b>${DataEngine.fmtINR(kpis.avgDaily)}</b>. ` +
      `Period-over-period, overall sales momentum has ${direction} by <b>${Math.abs(kpis.growthPct).toFixed(1)}%</b>.`;

    if (kpis.hasProfit) {
      s += ` Operating profit is <b>${DataEngine.fmtINR(kpis.totalProfit)}</b> at a healthy margin of <b>${kpis.marginPct.toFixed(1)}%</b>.`;
    }

    const daily = aggregateDaily(data);
    if (daily.length) {
      let maxDay = daily[0], minDay = daily[0];
      for (const d of daily) {
        if (d.sales > maxDay.sales) maxDay = d;
        if (d.sales < minDay.sales) minDay = d;
      }
      s += ` Peak single-day revenue reached <b>${DataEngine.fmtINR(maxDay.sales)}</b> on ${maxDay.date}.`;
    }

    // Top product
    const productSales = {};
    for (const r of data) {
      productSales[r.product] = (productSales[r.product] || 0) + (r.sales || 0);
    }
    const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
    if (sortedProducts.length) {
      const topP = sortedProducts[0];
      const share = ((topP[1] / kpis.totalSales) * 100).toFixed(1);
      s += ` <b>${topP[0]}</b> is your leading product, driving <b>${share}%</b> of aggregate sales.`;
    }

    return s;
  }

  /**
   * Plot 1: Revenue & Profit Trend
   */
  function renderRevenueTrendChart(data, containerId, mode = "daily") {
    const daily = aggregateDaily(data);
    const x = daily.map(d => d.date);
    let ySales = daily.map(d => d.sales);
    let yProfit = daily.map(d => d.income);

    if (mode === "rolling7") {
      ySales = calculateRollingAvg(ySales, 7);
      yProfit = calculateRollingAvg(yProfit, 7);
    } else if (mode === "cumulative") {
      ySales = calculateCumulative(ySales);
      yProfit = calculateCumulative(yProfit);
    }

    const traces = [
      {
        x: x,
        y: ySales,
        mode: "lines",
        name: mode === "rolling7" ? "Revenue (7D Rolling)" : mode === "cumulative" ? "Cumulative Revenue" : "Revenue",
        line: { color: COLORS.primary, width: 2.5 },
        fill: mode === "cumulative" ? "tozeroy" : "tozeroy",
        fillcolor: "rgba(88, 166, 255, 0.08)"
      }
    ];

    const hasProfit = daily.some(d => d.income !== 0);
    if (hasProfit) {
      traces.push({
        x: x,
        y: yProfit,
        mode: "lines",
        name: mode === "rolling7" ? "Profit (7D Rolling)" : mode === "cumulative" ? "Cumulative Profit" : "Profit",
        line: { color: COLORS.green, width: 2 }
      });
    }

    const layout = {
      ...PLOTLY_THEME,
      title: { text: "Revenue & Profit Performance", font: { size: 14 } },
      xaxis: { ...PLOTLY_THEME.xaxis, title: "Date" },
      yaxis: { ...PLOTLY_THEME.yaxis, title: "Amount (₹)" }
    };

    Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
  }

  /**
   * Plot 2: Top Products Horizontal Bar Chart
   */
  function renderTopProductsChart(data, containerId, topN = 8) {
    const pMap = {};
    for (const r of data) {
      pMap[r.product] = (pMap[r.product] || 0) + (r.sales || 0);
    }
    const sorted = Object.entries(pMap).sort((a, b) => a[1] - b[1]).slice(-topN);

    const trace = {
      x: sorted.map(i => i[1]),
      y: sorted.map(i => i[0]),
      type: "bar",
      orientation: "h",
      marker: {
        color: sorted.map(i => i[1]),
        colorscale: [[0, "#1F6FEB"], [1, COLORS.purple]]
      },
      text: sorted.map(i => DataEngine.fmtINR(i[1])),
      textposition: "auto"
    };

    const layout = {
      ...PLOTLY_THEME,
      title: { text: `Top ${sorted.length} Products by Revenue`, font: { size: 14 } },
      xaxis: { ...PLOTLY_THEME.xaxis, title: "Total Revenue (₹)" },
      yaxis: { ...PLOTLY_THEME.yaxis, automargin: true }
    };

    Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  /**
   * Plot 3: Category Breakdown
   */
  function renderCategoryChart(data, containerId) {
    const cMap = {};
    for (const r of data) {
      cMap[r.category] = (cMap[r.category] || 0) + (r.sales || 0);
    }
    const keys = Object.keys(cMap);
    const vals = Object.values(cMap);

    const trace = {
      labels: keys,
      values: vals,
      type: "pie",
      hole: 0.5,
      marker: {
        colors: [COLORS.primary, COLORS.cyan, COLORS.purple, COLORS.orange, COLORS.green]
      },
      textinfo: "label+percent",
      hoverinfo: "label+value+percent"
    };

    const layout = {
      ...PLOTLY_THEME,
      title: { text: "Category Distribution", font: { size: 14 } }
    };

    Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  /**
   * Plot 4: Day of Week Pattern
   */
  function renderDayOfWeekChart(data, containerId) {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const daySums = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const r of data) {
      const d = new Date(r.date);
      // JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
      const dayIdx = (d.getDay() + 6) % 7; // Convert to Mon=0, Sun=6
      daySums[dayIdx] += r.sales || 0;
      dayCounts[dayIdx]++;
    }

    const avgs = daySums.map((sum, i) => (dayCounts[i] ? sum / dayCounts[i] : 0));
    const colors = [COLORS.primary, COLORS.primary, COLORS.primary, COLORS.primary, COLORS.primary, COLORS.green, COLORS.green];

    const trace = {
      x: dayNames,
      y: avgs,
      type: "bar",
      marker: { color: colors },
      text: avgs.map(v => DataEngine.fmtINR(v)),
      textposition: "outside"
    };

    const layout = {
      ...PLOTLY_THEME,
      title: { text: "Average Sales by Day of Week", font: { size: 14 } },
      xaxis: { ...PLOTLY_THEME.xaxis, title: "Day" },
      yaxis: { ...PLOTLY_THEME.yaxis, title: "Avg Sales (₹)" }
    };

    Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  /**
   * Plot 5: Monthly Revenue Performance
   */
  function renderMonthlyComparisonChart(data, containerId) {
    const monthMap = {};
    for (const r of data) {
      const m = r.date.slice(0, 7); // YYYY-MM
      monthMap[m] = (monthMap[m] || 0) + (r.sales || 0);
    }
    const months = Object.keys(monthMap).sort();
    const sales = months.map(m => monthMap[m]);

    const trace = {
      x: months,
      y: sales,
      type: "bar",
      marker: { color: COLORS.primary },
      text: sales.map(v => DataEngine.fmtINR(v)),
      textposition: "outside"
    };

    const layout = {
      ...PLOTLY_THEME,
      title: { text: "Monthly Revenue Performance", font: { size: 14 } },
      xaxis: { ...PLOTLY_THEME.xaxis, title: "Month" },
      yaxis: { ...PLOTLY_THEME.yaxis, title: "Total Revenue (₹)" }
    };

    Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  // Helpers
  function calculateRollingAvg(arr, windowSize) {
    const res = [];
    for (let i = 0; i < arr.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const slice = arr.slice(start, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      res.push(Math.round(avg * 100) / 100);
    }
    return res;
  }

  function calculateCumulative(arr) {
    let sum = 0;
    return arr.map(v => {
      sum += v;
      return Math.round(sum * 100) / 100;
    });
  }

  return {
    filterData,
    aggregateDaily,
    computeKPIs,
    generateSummary,
    renderRevenueTrendChart,
    renderTopProductsChart,
    renderCategoryChart,
    renderDayOfWeekChart,
    renderMonthlyComparisonChart
  };
})();
