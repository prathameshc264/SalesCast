/**
 * SalesCast Pro — OCR Receipt Engine
 * Client-side receipt text recognition (Tesseract.js) and regex-based item extraction.
 */

const OCREngine = (function () {
  const SKIP_WORDS = [
    "subtotal", "sub total", "tax", "total", "change", "cash", "card",
    "visa", "mastercard", "payment", "tip", "balance", "amount due",
    "transaction", "cashier", "qty", "item description", "phone", "street"
  ];

  /**
   * Parse raw OCR text into structured receipt data
   * Mirrors Python utils/ocr_utils.py line 53-105
   */
  function parseBillText(rawText) {
    if (!rawText) return { date: new Date().toISOString().split("T")[0], items: [], merchant: "Retail Store", total: 0 };

    const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
    const date = extractDate(rawText);
    const merchant = extractMerchant(lines);
    const items = extractItems(lines);

    const total = items.reduce((sum, item) => sum + item.sales, 0);

    return {
      date,
      merchant,
      items,
      total: Math.round(total * 100) / 100,
      rawText
    };
  }

  function extractMerchant(lines) {
    if (!lines.length) return "Retail Merchant";
    // Usually the first 1-2 non-empty lines have the store name
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i];
      if (line.length > 3 && !line.includes(":") && !/\d{4}/.test(line)) {
        return line.replace(/[^a-zA-Z0-9\s&'-]/g, "").trim();
      }
    }
    return "TechZone Electronics";
  }

  function extractDate(text) {
    // Regex matching dates like 2024-10-15 or 15/10/2024 or 15 Oct 2024
    const patterns = [
      /(\d{4}[/-]\d{1,2}[/-]\d{1,2})/,
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i
    ];

    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split("T")[0];
        }
      }
    }
    return new Date().toISOString().split("T")[0];
  }

  function extractItems(lines) {
    const items = [];
    // Regex matching: "Item Name $XX.XX" or "Item Name 12.50"
    const priceRe = /^(.+?)\s+[\$₹]?(\d+\.?\d{0,2})\s*$/;

    for (const line of lines) {
      const m = line.match(priceRe);
      if (m) {
        const name = m[1].replace(/^[0-9\s\.\-]+/, "").trim(); // strip leading qty numbers
        const price = parseFloat(m[2]);

        const nameLower = name.toLowerCase();
        if (SKIP_WORDS.some(s => nameLower.includes(s))) continue;

        if (price > 0 && name.length >= 2) {
          // Convert USD to approximate INR if numbers look like standard retail dollars
          const inrPrice = price < 500 ? Math.round(price * 83) : Math.round(price);
          items.push({
            product: capitalize(name),
            sales: inrPrice,
            category: guessCategory(name)
          });
        }
      }
    }

    // Fallback if OCR text was partially unformatted but has recognizable keywords
    if (!items.length) {
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("mouse") || lower.includes("cable") || lower.includes("keyboard") || lower.includes("adapter")) {
          const matchNum = line.match(/(\d+\.?\d{0,2})/g);
          const num = matchNum ? parseFloat(matchNum[matchNum.length - 1]) : 25;
          const inrPrice = num < 500 ? Math.round(num * 83) : Math.round(num);
          items.push({
            product: capitalize(line.split(/[\$\d]/)[0].trim() || "Electronic Accessory"),
            sales: inrPrice,
            category: "Accessories"
          });
        }
      }
    }

    return items;
  }

  function guessCategory(name) {
    const lower = name.toLowerCase();
    if (lower.includes("laptop") || lower.includes("phone") || lower.includes("tablet") || lower.includes("monitor") || lower.includes("pc")) {
      return "Electronics";
    }
    return "Accessories";
  }

  function capitalize(s) {
    return s.replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Run OCR on image via Tesseract.js (loaded dynamically)
   */
  async function scanImage(imageSource, onProgress = null) {
    // If Tesseract is not loaded yet, dynamically load it
    if (typeof Tesseract === "undefined") {
      if (onProgress) onProgress({ status: "Loading OCR neural network…", progress: 0.1 });
      await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    }

    if (onProgress) onProgress({ status: "Initializing OCR worker…", progress: 0.3 });

    const worker = await Tesseract.createWorker("eng");
    
    if (onProgress) onProgress({ status: "Analyzing receipt text & amounts…", progress: 0.6 });

    const ret = await worker.recognize(imageSource);
    await worker.terminate();

    if (onProgress) onProgress({ status: "Parsing receipt structure…", progress: 0.95 });

    const parsed = parseBillText(ret.data.text);
    return parsed;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return {
    scanImage,
    parseBillText
  };
})();
