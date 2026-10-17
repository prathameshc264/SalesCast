/**
 * SalesCast Pro — Data Engine
 * Smart Column Detection, Cleaning Pipeline, Sample Data Generator, and Persistence.
 */

const DataEngine = (function () {
  // Exclusion patterns matching Python utils/cleaning.py
  const SALES_SKIP = [
    "unit price", "price per", "unit cost", "tax", "rating", "margin",
    "percentage", "gross margin", "qty", "quantity", "cogs",
    "cost of", "income", "profit", "earning"
  ];

  const PRODUCT_IS_CATEGORY = [
    "product line", "product_line", "product category", "product type", "product group"
  ];

  /**
   * Format Indian Rupee currency with lakh/crore comma grouping (₹12,34,567)
   */
  function fmtINR(val, decimals = 0) {
    if (val === null || val === undefined || isNaN(val)) return "₹0";
    const neg = val < 0;
    val = Math.abs(Number(val));
    const intPart = Math.floor(val);
    let s = intPart.toString();
    let formatted = "";

    if (s.length <= 3) {
      formatted = s;
    } else {
      formatted = s.slice(-3);
      s = s.slice(0, -3);
      while (s.length > 0) {
        formatted = s.slice(-2) + "," + formatted;
        s = s.slice(0, -2);
      }
    }

    if (decimals > 0) {
      const decStr = val.toFixed(decimals).split(".")[1];
      formatted += "." + decStr;
    }

    return (neg ? "-" : "") + "₹" + formatted;
  }

  /**
   * Parse date string into YYYY-MM-DD
   */
  function parseDate(str) {
    if (!str) return null;
    if (str instanceof Date && !isNaN(str.getTime())) {
      return str.toISOString().split("T")[0];
    }
    const s = String(str).trim();
    // Try standard ISO or parseable dates
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      if (y > 1970 && y < 2100) {
        return d.toISOString().split("T")[0];
      }
    }
    // Check regex dd/mm/yyyy or mm/dd/yyyy
    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
      if (p3 > 1900) { // DD/MM/YYYY or MM/DD/YYYY
        if (p1 > 12) return `${p3}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        return `${p3}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      } else if (p1 > 1900) { // YYYY/MM/DD
        return `${p1}-${String(p2).padStart(2, '0')}-${String(p3).padStart(2, '0')}`;
      }
    }
    return null;
  }

  /**
   * Detect date column
   */
  function detectDateColumn(rows, headers) {
    let bestCol = null, bestScore = 0;
    const sample = rows.slice(0, 100);

    for (const h of headers) {
      const hl = h.toLowerCase();
      let valid = 0;
      for (const r of sample) {
        if (parseDate(r[h])) valid++;
      }
      let score = valid / sample.length;
      if (hl.includes("date")) score += 0.25;
      else if (hl.includes("time") || hl.includes("day") || hl.includes("month") || hl.includes("year")) score += 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestCol = h;
      }
    }
    return bestScore > 0.4 ? bestCol : null;
  }

  /**
   * Detect numeric total sales column
   */
  function detectSalesColumn(rows, headers, exclude = []) {
    const exSet = new Set(exclude);
    const idKw = ["id", "index", "row", "sr", "sno", "serial", "no", "num"];

    // Filter candidate headers
    const candidates = headers.filter(h => {
      if (exSet.has(h)) return false;
      const hl = h.toLowerCase().trim();
      return !idKw.includes(hl);
    });

    // Check if numeric
    const numericCols = candidates.filter(h => {
      let numCount = 0;
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const v = parseFloat(rows[i][h]);
        if (!isNaN(v)) numCount++;
      }
      return numCount > rows.length * 0.4;
    });

    if (!numericCols.length) return null;

    // Filter out obvious unit prices/costs
    let filtered = numericCols.filter(h => {
      const hl = h.toLowerCase();
      return !SALES_SKIP.some(pat => hl.includes(pat));
    });
    if (!filtered.length) filtered = numericCols;

    // Tier 1: exact keywords
    const t1 = ["sales", "revenue", "total sales", "total revenue", "turnover"];
    for (const c of filtered) {
      if (t1.some(k => c.toLowerCase().includes(k))) return c;
    }

    // Tier 2: generic totals
    const t2 = ["amount", "total", "value"];
    for (const c of filtered) {
      if (t2.some(k => c.toLowerCase().includes(k))) return c;
    }

    // Tier 3: price
    for (const c of filtered) {
      const cl = c.toLowerCase();
      if (cl.includes("price") && !cl.includes("unit")) return c;
    }

    return filtered[0];
  }

  /**
   * Detect income / profit column
   */
  function detectIncomeColumn(rows, headers, exclude = []) {
    const exSet = new Set(exclude);
    const tiers = [
      ["net income", "net profit", "net earnings"],
      ["gross income", "gross profit", "gross earnings"],
      ["income", "profit", "earnings"]
    ];
    for (const group of tiers) {
      for (const h of headers) {
        if (!exSet.has(h) && group.some(k => h.toLowerCase().includes(k))) {
          return h;
        }
      }
    }
    return null;
  }

  /**
   * Detect cost column
   */
  function detectCostColumn(rows, headers, exclude = []) {
    const exSet = new Set(exclude);
    const kw = ["cogs", "cost of goods", "total cost", "cost", "expense", "purchase", "spend"];
    for (const h of headers) {
      const hl = h.toLowerCase();
      if (!exSet.has(h) && !hl.includes("unit cost") && kw.some(k => hl.includes(k))) {
        return h;
      }
    }
    return null;
  }

  /**
   * Detect quantity column
   */
  function detectQuantityColumn(rows, headers, exclude = []) {
    const exSet = new Set(exclude);
    const kw = ["quantity", "qty", "units sold", "units", "no of items", "pieces", "pcs"];
    for (const h of headers) {
      if (!exSet.has(h) && kw.some(k => h.toLowerCase().includes(k))) {
        return h;
      }
    }
    return null;
  }

  /**
   * Detect product column
   */
  function detectProductColumn(rows, headers, exclude = []) {
    const exSet = new Set(exclude);
    const kw = ["product", "item", "name", "sku", "goods", "merchandise"];
    for (const h of headers) {
      const hl = h.toLowerCase();
      if (!exSet.has(h)) {
        if (PRODUCT_IS_CATEGORY.some(pat => hl.includes(pat))) continue;
        if (kw.some(k => hl.includes(k))) return h;
      }
    }
    return null;
  }

  /**
   * Detect category column
   */
  function detectCategoryColumn(rows, headers, exclude = []) {
    const exSet = new Set(exclude);
    const specific = ["category", "product line", "product_line", "product category", "segment", "department", "dept"];
    for (const h of headers) {
      if (!exSet.has(h) && specific.some(k => h.toLowerCase().includes(k))) {
        return h;
      }
    }
    const generic = ["type", "class", "group", "line", "division"];
    const skip = ["customer", "payment", "invoice", "date", "time", "id", "gender", "branch", "city"];
    for (const h of headers) {
      const hl = h.toLowerCase();
      if (!exSet.has(h) && !skip.some(s => hl.includes(s)) && generic.some(k => hl.includes(k))) {
        return h;
      }
    }
    return null;
  }

  /**
   * Clean raw data rows into standardized records
   */
  function cleanData(rows, headers) {
    if (!rows || !rows.length) {
      return { success: false, error: "The provided file is empty." };
    }

    const dateCol = detectDateColumn(rows, headers);
    if (!dateCol) {
      return { success: false, error: "Could not detect a date column. Please include a column with dates." };
    }

    const used = [dateCol];
    const salesCol = detectSalesColumn(rows, headers, used);
    if (!salesCol) {
      return { success: false, error: "Could not detect a numeric sales/revenue column." };
    }
    used.push(salesCol);

    const incomeCol = detectIncomeColumn(rows, headers, used);
    if (incomeCol) used.push(incomeCol);

    const costCol = detectCostColumn(rows, headers, used);
    if (costCol) used.push(costCol);

    const quantityCol = detectQuantityColumn(rows, headers, used);
    if (quantityCol) used.push(quantityCol);

    const productCol = detectProductColumn(rows, headers, used);
    if (productCol) used.push(productCol);

    const categoryCol = detectCategoryColumn(rows, headers, used);

    const cleaned = [];
    let duplicatesRemoved = 0;
    const seen = new Set();

    for (const row of rows) {
      const parsedD = parseDate(row[dateCol]);
      if (!parsedD) continue;

      let sales = parseFloat(String(row[salesCol]).replace(/[^0-9.-]/g, ""));
      if (isNaN(sales)) sales = 0;

      let income = incomeCol ? parseFloat(String(row[incomeCol]).replace(/[^0-9.-]/g, "")) : null;
      let cost = costCol ? parseFloat(String(row[costCol]).replace(/[^0-9.-]/g, "")) : null;
      let quantity = quantityCol ? parseFloat(String(row[quantityCol]).replace(/[^0-9.-]/g, "")) : null;
      let product = productCol && row[productCol] ? String(row[productCol]).trim() : "General";
      let category = categoryCol && row[categoryCol] ? String(row[categoryCol]).trim() : "Standard";

      // If profit is missing but cost is present, calculate income
      if (isNaN(income) && !isNaN(cost) && cost !== null) {
        income = sales - cost;
      }

      // Deduplication key
      const key = `${parsedD}|${sales}|${product}`;
      if (seen.has(key)) {
        duplicatesRemoved++;
        continue;
      }
      seen.add(key);

      cleaned.push({
        date: parsedD,
        sales: Math.round(sales * 100) / 100,
        income: isNaN(income) ? null : Math.round(income * 100) / 100,
        cost: isNaN(cost) ? null : Math.round(cost * 100) / 100,
        quantity: isNaN(quantity) ? 1 : Math.round(quantity),
        product: product,
        category: category
      });
    }

    // Sort ascending by date
    cleaned.sort((a, b) => (a.date > b.date ? 1 : -1));

    return {
      success: true,
      data: cleaned,
      report: {
        originalRows: rows.length,
        cleanedRows: cleaned.length,
        duplicatesRemoved: duplicatesRemoved,
        columnsMapped: {
          date: dateCol,
          sales: salesCol,
          income: incomeCol,
          cost: costCol,
          quantity: quantityCol,
          product: productCol,
          category: categoryCol
        }
      }
    };
  }

  /**
   * Generate 365 Days of Realistic Sample Data
   * Mirrors Python app.py line 111-135
   */
  function generateSampleData() {
    const records = [];
    const today = new Date();
    const products = ["Laptop", "Phone", "Tablet", "Headphones", "Charger", "Case", "Monitor", "Keyboard"];
    
    // 365 days leading up to today
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const step = 364 - i;
      const base = 5000;
      const trend = (step / 365) * 3000;
      const seasonal = 2000 * Math.sin(step * 2 * Math.PI / 365);
      const weekly = 1000 * Math.sin(step * 2 * Math.PI / 7);
      
      // Box-Muller Gaussian noise
      const u1 = Math.random(), u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const noise = z0 * 1000;

      let sales = Math.max(base + trend + seasonal + weekly + noise, 650);
      sales = Math.round(sales * 100) / 100;

      // Realistic cost factor 35% - 65%
      const costFactor = 0.35 + Math.random() * 0.30;
      const cost = Math.round(sales * costFactor * 100) / 100;
      const income = Math.round((sales - cost) * 100) / 100;
      const quantity = Math.floor(Math.random() * 20) + 1;

      const pIndex = Math.floor(Math.random() * products.length);
      const product = products[pIndex];
      const category = ["Laptop", "Phone", "Tablet", "Monitor"].includes(product) ? "Electronics" : "Accessories";

      records.push({
        date: dateStr,
        sales: sales,
        income: income,
        cost: cost,
        quantity: quantity,
        product: product,
        category: category
      });
    }

    return records;
  }

  // Storage Key
  const STORAGE_KEY = "salescast_pro_data_v2";

  function saveToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Storage write failed:", e);
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  return {
    fmtINR,
    cleanData,
    generateSampleData,
    saveToStorage,
    loadFromStorage,
    clearStorage
  };
})();
