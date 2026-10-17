/**
 * SalesCast Pro — Main Application Controller
 * Manages state, handles tabs, user interactions, toasts, and connects engines to UI.
 */

document.addEventListener("DOMContentLoaded", function () {
  // Global State
  const state = {
    allData: [],
    filteredData: [],
    forecastCache: null,
    anomalyCache: null,
    activeTab: "dashboard",
    filters: {
      datePreset: "all",
      startDate: null,
      endDate: null,
      category: "all",
      product: "all"
    },
    ocrResult: null
  };

  // DOM Elements Cache
  const el = {
    // Header & Global
    btnGenerateSample: document.getElementById("btn-generate-sample"),
    btnUploadHeader: document.getElementById("btn-upload-header"),
    btnScanOcrHeader: document.getElementById("btn-scan-ocr-header"),
    btnClearData: document.getElementById("btn-clear-data"),
    statusRowCount: document.getElementById("status-row-count"),
    statusDateSpan: document.getElementById("status-date-span"),
    statusTotalRev: document.getElementById("status-total-rev"),
    fileInput: document.getElementById("file-input"),
    dropzone: document.getElementById("dropzone"),

    // Filters
    filterPreset: document.getElementById("filter-preset"),
    filterStartDate: document.getElementById("filter-start-date"),
    filterEndDate: document.getElementById("filter-end-date"),
    filterCategory: document.getElementById("filter-category"),
    filterProduct: document.getElementById("filter-product"),
    btnResetFilters: document.getElementById("btn-reset-filters"),

    // Tabs
    tabButtons: document.querySelectorAll(".tab-btn"),
    tabPanes: document.querySelectorAll(".tab-pane"),

    // Dashboard KPIs
    kpiRevenue: document.getElementById("kpi-revenue"),
    kpiGrowth: document.getElementById("kpi-growth"),
    kpiProfit: document.getElementById("kpi-profit"),
    kpiMargin: document.getElementById("kpi-margin"),
    kpiAvgDaily: document.getElementById("kpi-avg-daily"),
    kpiDays: document.getElementById("kpi-days"),
    kpiQuantity: document.getElementById("kpi-quantity"),
    kpiTransactions: document.getElementById("kpi-transactions"),
    summaryText: document.getElementById("summary-text"),

    // Trend Mode Buttons
    btnTrendDaily: document.getElementById("btn-trend-daily"),
    btnTrendRolling: document.getElementById("btn-trend-rolling"),
    btnTrendCumulative: document.getElementById("btn-trend-cumulative"),

    // Forecast Tab
    forecastSlider: document.getElementById("forecast-slider"),
    forecastSliderVal: document.getElementById("forecast-slider-val"),
    btnRunForecast: document.getElementById("btn-run-forecast"),
    kpiNextDay: document.getElementById("kpi-next-day"),
    kpiLowerBound: document.getElementById("kpi-lower-bound"),
    kpiUpperBound: document.getElementById("kpi-upper-bound"),
    forecastTableBody: document.getElementById("forecast-table-body"),

    // Anomalies Tab
    anomalyThreshold: document.getElementById("anomaly-threshold"),
    anomalyThresholdVal: document.getElementById("anomaly-threshold-val"),
    kpiAnomalyCount: document.getElementById("kpi-anomaly-count"),
    kpiSpikeCount: document.getElementById("kpi-spike-count"),
    kpiDropCount: document.getElementById("kpi-drop-count"),
    anomalyListContainer: document.getElementById("anomaly-list-container"),

    // OCR Tab
    ocrDropzone: document.getElementById("ocr-dropzone"),
    ocrFileInput: document.getElementById("ocr-file-input"),
    btnUseSampleReceipt: document.getElementById("btn-use-sample-receipt"),
    ocrPreviewImg: document.getElementById("ocr-preview-img"),
    ocrProgressContainer: document.getElementById("ocr-progress-container"),
    ocrProgressBar: document.getElementById("ocr-progress-bar"),
    ocrProgressText: document.getElementById("ocr-progress-text"),
    ocrResultsCard: document.getElementById("ocr-results-card"),
    ocrMerchantName: document.getElementById("ocr-merchant-name"),
    ocrReceiptDate: document.getElementById("ocr-receipt-date"),
    ocrReceiptTotal: document.getElementById("ocr-receipt-total"),
    ocrItemsTableBody: document.getElementById("ocr-items-table-body"),
    btnAddOcrToDataset: document.getElementById("btn-add-ocr-to-dataset"),
    ocrRawText: document.getElementById("ocr-raw-text"),

    // Explainability Tab
    explainDriversText: document.getElementById("explain-drivers-text"),

    // Recommendations Tab
    recListContainer: document.getElementById("rec-list-container"),

    // Data Table
    tableSearchInput: document.getElementById("table-search-input"),
    dataTableBody: document.getElementById("data-table-body"),
    btnExportCsv: document.getElementById("btn-export-csv"),
    emptyStateContainer: document.getElementById("empty-state-container"),
    mainDashboardContent: document.getElementById("main-dashboard-content"),
    toastContainer: document.getElementById("toast-container")
  };

  let currentTrendMode = "daily";

  /**
   * Initialize Application
   */
  function init() {
    setupEventListeners();

    // Check for saved data in storage
    const saved = DataEngine.loadFromStorage();
    if (saved && saved.length > 0) {
      loadDataset(saved, false);
      showToast(`Restored ${saved.length} records from previous session`, "info");
    } else {
      // Auto-load 365 days of sample data so user sees a rich live dashboard instantly!
      const sample = DataEngine.generateSampleData();
      loadDataset(sample, true);
      showToast("Loaded 365 days of sample sales data", "success");
    }
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    // Tab Switching
    el.tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Sample Data Buttons
    if (el.btnGenerateSample) {
      el.btnGenerateSample.addEventListener("click", () => {
        const sample = DataEngine.generateSampleData();
        loadDataset(sample, true);
        showToast("Generated 365 days of realistic sales data!", "success");
      });
    }

    // Clear Data Button
    if (el.btnClearData) {
      el.btnClearData.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all data?")) {
          DataEngine.clearStorage();
          state.allData = [];
          state.filteredData = [];
          state.forecastCache = null;
          state.anomalyCache = null;
          updateUI();
          showToast("All data cleared", "info");
        }
      });
    }

    // File Upload handling
    if (el.dropzone && el.fileInput) {
      el.dropzone.addEventListener("click", () => el.fileInput.click());
      el.dropzone.addEventListener("dragover", e => {
        e.preventDefault();
        el.dropzone.classList.add("dragover");
      });
      el.dropzone.addEventListener("dragleave", () => el.dropzone.classList.remove("dragover"));
      el.dropzone.addEventListener("drop", e => {
        e.preventDefault();
        el.dropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
      });
      el.fileInput.addEventListener("change", e => {
        if (e.target.files.length) handleFileUpload(e.target.files[0]);
      });
    }

    if (el.btnUploadHeader) {
      el.btnUploadHeader.addEventListener("click", () => el.fileInput.click());
    }

    // Filter Controls
    if (el.filterPreset) {
      el.filterPreset.addEventListener("change", handlePresetChange);
    }
    if (el.filterStartDate) {
      el.filterStartDate.addEventListener("change", () => {
        state.filters.startDate = el.filterStartDate.value || null;
        applyFilters();
      });
    }
    if (el.filterEndDate) {
      el.filterEndDate.addEventListener("change", () => {
        state.filters.endDate = el.filterEndDate.value || null;
        applyFilters();
      });
    }
    if (el.filterCategory) {
      el.filterCategory.addEventListener("change", () => {
        state.filters.category = el.filterCategory.value;
        applyFilters();
      });
    }
    if (el.filterProduct) {
      el.filterProduct.addEventListener("change", () => {
        state.filters.product = el.filterProduct.value;
        applyFilters();
      });
    }
    if (el.btnResetFilters) {
      el.btnResetFilters.addEventListener("click", resetFilters);
    }

    // Trend Mode Buttons
    const trendBtns = [el.btnTrendDaily, el.btnTrendRolling, el.btnTrendCumulative];
    trendBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener("click", () => {
          trendBtns.forEach(b => b.classList.remove("btn-primary"));
          trendBtns.forEach(b => b.classList.add("btn-secondary"));
          btn.classList.remove("btn-secondary");
          btn.classList.add("btn-primary");
          currentTrendMode = btn.dataset.mode;
          renderDashboardCharts();
        });
      }
    });

    // Forecast Controls
    if (el.forecastSlider && el.forecastSliderVal) {
      el.forecastSlider.addEventListener("input", () => {
        el.forecastSliderVal.textContent = `${el.forecastSlider.value}d`;
      });
    }
    if (el.btnRunForecast) {
      el.btnRunForecast.addEventListener("click", runForecast);
    }

    // Anomaly Controls
    if (el.anomalyThreshold && el.anomalyThresholdVal) {
      el.anomalyThreshold.addEventListener("input", () => {
        el.anomalyThresholdVal.textContent = `${parseFloat(el.anomalyThreshold.value).toFixed(1)}x`;
        runAnomalyDetection();
      });
    }

    // OCR Controls
    if (el.btnScanOcrHeader) {
      el.btnScanOcrHeader.addEventListener("click", () => {
        switchTab("ocr");
      });
    }
    if (el.ocrDropzone && el.ocrFileInput) {
      el.ocrDropzone.addEventListener("click", () => el.ocrFileInput.click());
      el.ocrFileInput.addEventListener("change", e => {
        if (e.target.files.length) handleOcrFile(e.target.files[0]);
      });
    }
    if (el.btnUseSampleReceipt) {
      el.btnUseSampleReceipt.addEventListener("click", () => {
        loadSampleReceipt();
      });
    }
    if (el.btnAddOcrToDataset) {
      el.btnAddOcrToDataset.addEventListener("click", addOcrItemsToData);
    }

    // Table Search
    if (el.tableSearchInput) {
      el.tableSearchInput.addEventListener("input", () => {
        renderDataTable(el.tableSearchInput.value);
      });
    }

    // CSV Export
    if (el.btnExportCsv) {
      el.btnExportCsv.addEventListener("click", exportCsv);
    }

    // Window resize handler for Plotly
    window.addEventListener("resize", () => {
      const activePane = document.querySelector(".tab-pane.active");
      if (activePane) {
        const charts = activePane.querySelectorAll(".js-plotly-plot");
        charts.forEach(chart => Plotly.Plots.resize(chart));
      }
    });
  }

  /**
   * Switch Active Tab
   */
  function switchTab(tabId) {
    state.activeTab = tabId;

    el.tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    el.tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });

    // Lazy render charts on tab switch
    setTimeout(() => {
      if (tabId === "dashboard") {
        renderDashboardCharts();
      } else if (tabId === "forecast") {
        runForecast();
      } else if (tabId === "anomalies") {
        runAnomalyDetection();
      } else if (tabId === "explainability") {
        renderExplainability();
      } else if (tabId === "recommendations") {
        renderRecommendations();
      }
    }, 50);
  }

  /**
   * Load dataset and refresh UI
   */
  function loadDataset(records, save = true) {
    state.allData = records;
    if (save) DataEngine.saveToStorage(records);

    // Populate category and product filter dropdowns
    populateFilterDropdowns();

    // Reset filters
    resetFilters(false);

    // Update entire UI
    updateUI();
  }

  /**
   * Handle CSV / Excel File Upload
   */
  function handleFileUpload(file) {
    if (!file) return;

    showToast(`Parsing ${file.name}…`, "info");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: function (results) {
        if (!results.data || !results.data.length) {
          showToast("Uploaded file is empty.", "error");
          return;
        }

        const headers = results.meta.fields || Object.keys(results.data[0]);
        const cleanRes = DataEngine.cleanData(results.data, headers);

        if (!cleanRes.success) {
          showToast(cleanRes.error, "error");
          return;
        }

        loadDataset(cleanRes.data, true);
        const rep = cleanRes.report;
        showToast(
          `Loaded ${rep.cleanedRows} rows (${rep.duplicatesRemoved} duplicates removed)`,
          "success"
        );
      },
      error: function (err) {
        showToast(`Failed to parse CSV: ${err.message}`, "error");
      }
    });
  }

  /**
   * Populate Category and Product Filter dropdowns
   */
  function populateFilterDropdowns() {
    const categories = new Set();
    const products = new Set();

    for (const r of state.allData) {
      if (r.category) categories.add(r.category);
      if (r.product) products.add(r.product);
    }

    if (el.filterCategory) {
      el.filterCategory.innerHTML = '<option value="all">All Categories</option>';
      Array.from(categories).sort().forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        el.filterCategory.appendChild(opt);
      });
    }

    if (el.filterProduct) {
      el.filterProduct.innerHTML = '<option value="all">All Products</option>';
      Array.from(products).sort().forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        el.filterProduct.appendChild(opt);
      });
    }
  }

  /**
   * Date Preset handler
   */
  function handlePresetChange() {
    const val = el.filterPreset.value;
    state.filters.datePreset = val;

    if (!state.allData.length) return;

    const dates = state.allData.map(r => r.date).sort();
    const minD = dates[0];
    const maxD = dates[dates.length - 1];

    if (val === "all") {
      state.filters.startDate = null;
      state.filters.endDate = null;
    } else {
      const maxDateObj = new Date(maxD);
      let targetDate = new Date(maxDateObj);

      if (val === "7d") targetDate.setDate(targetDate.getDate() - 7);
      else if (val === "30d") targetDate.setDate(targetDate.getDate() - 30);
      else if (val === "90d") targetDate.setDate(targetDate.getDate() - 90);
      else if (val === "ytd") targetDate = new Date(maxDateObj.getFullYear(), 0, 1);

      state.filters.startDate = targetDate.toISOString().split("T")[0];
      state.filters.endDate = maxD;
    }

    if (el.filterStartDate) el.filterStartDate.value = state.filters.startDate || "";
    if (el.filterEndDate) el.filterEndDate.value = state.filters.endDate || "";

    applyFilters();
  }

  function resetFilters(triggerApply = true) {
    state.filters = {
      datePreset: "all",
      startDate: null,
      endDate: null,
      category: "all",
      product: "all"
    };
    if (el.filterPreset) el.filterPreset.value = "all";
    if (el.filterStartDate) el.filterStartDate.value = "";
    if (el.filterEndDate) el.filterEndDate.value = "";
    if (el.filterCategory) el.filterCategory.value = "all";
    if (el.filterProduct) el.filterProduct.value = "all";

    if (triggerApply) applyFilters();
  }

  function applyFilters() {
    state.filteredData = AnalyticsEngine.filterData(state.allData, state.filters);
    updateUI();
  }

  /**
   * Master UI Update
   */
  function updateUI() {
    const hasData = state.allData && state.allData.length > 0;

    if (!hasData) {
      if (el.emptyStateContainer) el.emptyStateContainer.style.display = "block";
      if (el.mainDashboardContent) el.mainDashboardContent.style.display = "none";
      if (el.statusRowCount) el.statusRowCount.textContent = "0 rows";
      if (el.statusDateSpan) el.statusDateSpan.textContent = "No data loaded";
      if (el.statusTotalRev) el.statusTotalRev.textContent = "₹0";
      return;
    }

    if (el.emptyStateContainer) el.emptyStateContainer.style.display = "none";
    if (el.mainDashboardContent) el.mainDashboardContent.style.display = "block";

    // Set filteredData if empty
    if (!state.filteredData || !state.filteredData.length) {
      state.filteredData = [...state.allData];
    }

    // Compute KPIs
    const kpis = AnalyticsEngine.computeKPIs(state.filteredData);

    // Update Status Badge in Sidebar
    if (el.statusRowCount) el.statusRowCount.textContent = `${state.filteredData.length} records`;
    if (el.statusDateSpan) {
      const s = new Date(kpis.dateRange[0]).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const e = new Date(kpis.dateRange[1]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      el.statusDateSpan.textContent = `${s} → ${e}`;
    }
    if (el.statusTotalRev) el.statusTotalRev.textContent = DataEngine.fmtINR(kpis.totalSales);

    // Update KPI Cards
    if (el.kpiRevenue) el.kpiRevenue.textContent = DataEngine.fmtINR(kpis.totalSales);
    if (el.kpiGrowth) {
      const g = kpis.growthPct;
      const isPos = g >= 0;
      el.kpiGrowth.className = isPos ? "kpi-growth-positive" : "kpi-growth-negative";
      el.kpiGrowth.textContent = `${isPos ? "+" : ""}${g.toFixed(1)}% vs prior period`;
    }

    if (el.kpiProfit) {
      el.kpiProfit.textContent = kpis.hasProfit ? DataEngine.fmtINR(kpis.totalProfit) : "N/A";
    }
    if (el.kpiMargin) {
      el.kpiMargin.textContent = kpis.hasProfit ? `${kpis.marginPct.toFixed(1)}% gross margin` : "Cost data not provided";
    }

    if (el.kpiAvgDaily) el.kpiAvgDaily.textContent = DataEngine.fmtINR(kpis.avgDaily);
    if (el.kpiDays) el.kpiDays.textContent = `Across ${kpis.numDays} unique days`;

    if (el.kpiQuantity) {
      el.kpiQuantity.textContent = kpis.totalQuantity ? kpis.totalQuantity.toLocaleString() : state.filteredData.length.toLocaleString();
    }
    if (el.kpiTransactions) {
      el.kpiTransactions.textContent = `${state.filteredData.length} recorded orders`;
    }

    // Update Summary Box
    if (el.summaryText) {
      el.summaryText.innerHTML = AnalyticsEngine.generateSummary(state.filteredData, kpis);
    }

    // Render Tab Views
    if (state.activeTab === "dashboard") {
      renderDashboardCharts();
      renderDataTable();
    } else if (state.activeTab === "forecast") {
      runForecast();
    } else if (state.activeTab === "anomalies") {
      runAnomalyDetection();
    } else if (state.activeTab === "explainability") {
      renderExplainability();
    } else if (state.activeTab === "recommendations") {
      renderRecommendations();
    }
  }

  /**
   * Render Dashboard Tab Charts
   */
  function renderDashboardCharts() {
    if (!state.filteredData || !state.filteredData.length) return;

    AnalyticsEngine.renderRevenueTrendChart(state.filteredData, "chart-revenue-trend", currentTrendMode);
    AnalyticsEngine.renderTopProductsChart(state.filteredData, "chart-top-products", 8);
    AnalyticsEngine.renderCategoryChart(state.filteredData, "chart-category-dist");
    AnalyticsEngine.renderDayOfWeekChart(state.filteredData, "chart-day-of-week");
    AnalyticsEngine.renderMonthlyComparisonChart(state.filteredData, "chart-monthly-comparison");
  }

  /**
   * Run Forecasting
   */
  function runForecast() {
    if (!state.allData || state.allData.length < 14) {
      showToast("Need at least 14 days of data to generate a forecast.", "info");
      return;
    }

    const daily = AnalyticsEngine.aggregateDaily(state.allData);
    const horizon = parseInt(el.forecastSlider ? el.forecastSlider.value : "7", 10) || 7;

    try {
      const fResult = ForecastingEngine.trainAndForecast(daily, horizon);
      state.forecastCache = fResult;

      // Update KPIs
      if (el.kpiNextDay) el.kpiNextDay.textContent = DataEngine.fmtINR(fResult.nextDay.yhat);
      if (el.kpiLowerBound) el.kpiLowerBound.textContent = DataEngine.fmtINR(fResult.nextDay.yhat_lower);
      if (el.kpiUpperBound) el.kpiUpperBound.textContent = DataEngine.fmtINR(fResult.nextDay.yhat_upper);

      // Render Forecast Chart
      ForecastingEngine.renderForecastChart(daily, fResult.forecast, "chart-forecast-main");

      // Populate Forecast Table
      if (el.forecastTableBody) {
        el.forecastTableBody.innerHTML = "";
        fResult.forecast.forEach(f => {
          const tr = document.createElement("tr");
          const dateObj = new Date(f.date);
          const dow = dateObj.toLocaleDateString("en-IN", { weekday: "short" });
          const dateStr = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

          tr.innerHTML = `
            <td><b>${dateStr}</b> <span style="color:#8B949E;font-size:0.75rem;">(${dow})</span></td>
            <td><span style="color:#39D2C0;font-weight:600;">${DataEngine.fmtINR(f.yhat)}</span></td>
            <td><span style="color:#D29922;">${DataEngine.fmtINR(f.yhat_lower)}</span></td>
            <td><span style="color:#3FB950;">${DataEngine.fmtINR(f.yhat_upper)}</span></td>
            <td>+${f.step} day${f.step > 1 ? "s" : ""}</td>
          `;
          el.forecastTableBody.appendChild(tr);
        });
      }
    } catch (err) {
      showToast(`Forecasting error: ${err.message}`, "error");
    }
  }

  /**
   * Run Anomaly Detection
   */
  function runAnomalyDetection() {
    if (!state.allData || state.allData.length < 5) return;

    const daily = AnalyticsEngine.aggregateDaily(state.allData);
    const threshold = parseFloat(el.anomalyThreshold ? el.anomalyThreshold.value : "1.5") || 1.5;

    const result = AnomalyEngine.detectAnomalies(daily, threshold);
    state.anomalyCache = result;

    // Update KPIs
    if (el.kpiAnomalyCount) el.kpiAnomalyCount.textContent = result.stats.total;
    if (el.kpiSpikeCount) el.kpiSpikeCount.textContent = result.stats.spikes;
    if (el.kpiDropCount) el.kpiDropCount.textContent = result.stats.drops;

    // Render Chart
    AnomalyEngine.renderAnomalyChart(result.daily, result.anomalies, "chart-anomalies-main");

    // Populate Explanations List
    if (el.anomalyListContainer) {
      el.anomalyListContainer.innerHTML = "";
      if (!result.anomalies.length) {
        el.anomalyListContainer.innerHTML = `
          <div style="padding:24px;text-align:center;color:#8B949E;font-size:0.9rem;">
            No anomalies detected at ${threshold.toFixed(1)}x IQR sensitivity. All revenue points are within expected statistical bounds.
          </div>
        `;
        return;
      }

      result.anomalies.forEach(a => {
        const div = document.createElement("div");
        div.className = `anomaly-item-card anomaly-${a.type}`;
        div.innerHTML = `
          <div class="anomaly-indicator">
            ${a.type === "high" ? "▲" : "▼"}
          </div>
          <div class="anomaly-content">
            <div class="anomaly-header">
              <span class="anomaly-date">${a.dateFormatted}</span>
              <span class="anomaly-tag">${a.type === "high" ? "Spike (+)" : "Drop (-)"}</span>
              <span style="font-size:0.8rem;color:#8B949E;font-weight:600;">${DataEngine.fmtINR(a.sales)}</span>
            </div>
            <p class="anomaly-text">${a.explanation}</p>
          </div>
        `;
        el.anomalyListContainer.appendChild(div);
      });
    }
  }

  /**
   * Render AI Explainability
   */
  function renderExplainability() {
    if (!state.allData || state.allData.length < 35) {
      if (el.explainDriversText) {
        el.explainDriversText.innerHTML = `
          Explainability requires at least 35 days of consecutive sales data to engineer 12 lag and seasonal features.
          Currently have <b>${AnalyticsEngine.aggregateDaily(state.allData).length}</b> days. Click <b>Generate Sample Data</b> to explore!
        `;
      }
      return;
    }

    const daily = AnalyticsEngine.aggregateDaily(state.allData);
    const featureRows = ExplainabilityEngine.engineerFeatures(daily);
    const scores = ExplainabilityEngine.computeImportance(featureRows);

    ExplainabilityEngine.renderFeatureImportanceChart(scores, "chart-feature-importance");

    // Top drivers narrative
    const top3 = scores.slice(-3).reverse().map(s => `<b>${s.name}</b>`);
    if (el.explainDriversText) {
      el.explainDriversText.innerHTML = `
        The top factors driving predictions in your business are ${top3.join(", ")}.
        Sales are most heavily governed by recent momentum, weekly shopping rhythms, and seasonal cycles.
        Use these insights to schedule staff, run timely ad campaigns, and restock high-demand SKUs.
      `;
    }
  }

  /**
   * Render Recommendations
   */
  function renderRecommendations() {
    if (!state.allData || !state.allData.length) return;

    const recs = RecommendationsEngine.generateRecommendations(state.allData, state.forecastCache);

    if (el.recListContainer) {
      el.recListContainer.innerHTML = "";
      recs.forEach(rec => {
        const card = document.createElement("div");
        card.className = `rec-card ${rec.type}`;
        card.innerHTML = `
          <div style="flex:1;">
            <div class="rec-title">${rec.title}</div>
            <div class="rec-message">${rec.message}</div>
          </div>
          <div class="rec-priority priority-${rec.priority}">
            Priority: ${rec.priority}
          </div>
        `;
        el.recListContainer.appendChild(card);
      });
    }
  }

  /**
   * Handle OCR Image File
   */
  function handleOcrFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      processOcrImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function loadSampleReceipt() {
    const samplePath = "assets/sample_receipt.jpg";
    processOcrImage(samplePath);
  }

  async function processOcrImage(src) {
    if (el.ocrPreviewImg) {
      el.ocrPreviewImg.src = src;
      el.ocrPreviewImg.style.display = "block";
    }

    if (el.ocrProgressContainer) el.ocrProgressContainer.style.display = "block";
    if (el.ocrResultsCard) el.ocrResultsCard.style.display = "none";

    try {
      const parsed = await OCREngine.scanImage(src, progress => {
        if (el.ocrProgressBar) el.ocrProgressBar.style.width = `${Math.round(progress.progress * 100)}%`;
        if (el.ocrProgressText) el.ocrProgressText.textContent = progress.status;
      });

      state.ocrResult = parsed;

      // Populate Extracted Review Card
      if (el.ocrMerchantName) el.ocrMerchantName.textContent = parsed.merchant;
      if (el.ocrReceiptDate) el.ocrReceiptDate.value = parsed.date;
      if (el.ocrReceiptTotal) el.ocrReceiptTotal.textContent = DataEngine.fmtINR(parsed.total);

      if (el.ocrItemsTableBody) {
        el.ocrItemsTableBody.innerHTML = "";
        parsed.items.forEach((item, idx) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><input type="text" class="text-input item-name-input" data-idx="${idx}" value="${item.product}" style="padding:4px 8px;"></td>
            <td><span class="badge" style="background:#21262D;color:#8B949E;">${item.category}</span></td>
            <td><input type="number" class="text-input item-price-input" data-idx="${idx}" value="${item.sales}" style="padding:4px 8px;width:110px;"></td>
            <td><button class="btn btn-sm btn-ghost btn-remove-item" data-idx="${idx}" style="color:#F85149;">✕</button></td>
          `;
          el.ocrItemsTableBody.appendChild(tr);
        });

        // Add item remove listeners
        document.querySelectorAll(".btn-remove-item").forEach(btn => {
          btn.addEventListener("click", e => {
            const idx = parseInt(btn.dataset.idx, 10);
            state.ocrResult.items.splice(idx, 1);
            processOcrReviewUpdate();
          });
        });
      }

      if (el.ocrRawText) el.ocrRawText.textContent = parsed.rawText;
      if (el.ocrResultsCard) el.ocrResultsCard.style.display = "block";

      showToast("Receipt successfully analyzed via OCR!", "success");
    } catch (err) {
      showToast(`OCR scanning failed: ${err.message}`, "error");
    } finally {
      if (el.ocrProgressContainer) el.ocrProgressContainer.style.display = "none";
    }
  }

  function processOcrReviewUpdate() {
    if (!state.ocrResult) return;
    const newTotal = state.ocrResult.items.reduce((sum, item) => sum + item.sales, 0);
    state.ocrResult.total = newTotal;
    if (el.ocrReceiptTotal) el.ocrReceiptTotal.textContent = DataEngine.fmtINR(newTotal);

    // Re-render table items
    if (el.ocrItemsTableBody) {
      el.ocrItemsTableBody.innerHTML = "";
      state.ocrResult.items.forEach((item, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="text" class="text-input item-name-input" data-idx="${idx}" value="${item.product}" style="padding:4px 8px;"></td>
          <td><span class="badge" style="background:#21262D;color:#8B949E;">${item.category}</span></td>
          <td><input type="number" class="text-input item-price-input" data-idx="${idx}" value="${item.sales}" style="padding:4px 8px;width:110px;"></td>
          <td><button class="btn btn-sm btn-ghost btn-remove-item" data-idx="${idx}" style="color:#F85149;">✕</button></td>
        `;
        el.ocrItemsTableBody.appendChild(tr);
      });
    }
  }

  function addOcrItemsToData() {
    if (!state.ocrResult || !state.ocrResult.items.length) {
      showToast("No extracted receipt items to add.", "error");
      return;
    }

    const dateVal = el.ocrReceiptDate ? el.ocrReceiptDate.value : state.ocrResult.date;

    const newRecords = state.ocrResult.items.map(item => ({
      date: dateVal,
      sales: item.sales,
      income: Math.round(item.sales * 0.45 * 100) / 100,
      cost: Math.round(item.sales * 0.55 * 100) / 100,
      quantity: 1,
      product: item.product,
      category: item.category || "Accessories"
    }));

    const combined = [...state.allData, ...newRecords];
    combined.sort((a, b) => (a.date > b.date ? 1 : -1));

    loadDataset(combined, true);
    showToast(`Added ${newRecords.length} receipt items to active sales dataset!`, "success");
    switchTab("dashboard");
  }

  /**
   * Render Raw Data Table with Search
   */
  function renderDataTable(searchQuery = "") {
    if (!el.dataTableBody || !state.filteredData) return;

    let rows = state.filteredData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.date.includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        String(r.sales).includes(q)
      );
    }

    // Limit to first 100 rows for smooth DOM performance
    const displayRows = rows.slice(0, 100);
    el.dataTableBody.innerHTML = "";

    displayRows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date}</td>
        <td style="font-weight:600;color:#58A6FF;">${DataEngine.fmtINR(r.sales)}</td>
        <td style="color:#3FB950;">${r.income !== null ? DataEngine.fmtINR(r.income) : "-"}</td>
        <td style="color:#8B949E;">${r.cost !== null ? DataEngine.fmtINR(r.cost) : "-"}</td>
        <td>${r.quantity || 1}</td>
        <td><b>${r.product}</b></td>
        <td><span class="badge" style="background:#21262D;color:#8B949E;">${r.category}</span></td>
      `;
      el.dataTableBody.appendChild(tr);
    });
  }

  /**
   * Export Cleaned CSV
   */
  function exportCsv() {
    if (!state.filteredData || !state.filteredData.length) {
      showToast("No data to export.", "error");
      return;
    }

    const csv = Papa.unparse(state.filteredData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `salescast_cleaned_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Cleaned CSV file downloaded!", "success");
  }

  /**
   * Toast notification system
   */
  function showToast(message, type = "info") {
    if (!el.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
    toast.innerHTML = `<span style="font-weight:bold;">${icon}</span> <span>${message}</span>`;

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Start app
  init();
});
