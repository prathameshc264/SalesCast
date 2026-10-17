/**
 * SalesCast Pro — Recommendations Engine
 * Rule-based business intelligence alerts derived from sales velocity, margin health,
 * product momentum, and forecast trajectories.
 */

const RecommendationsEngine = (function () {
  function generateRecommendations(data, forecastData = null) {
    const recs = [];
    if (!data || !data.length) return recs;

    const daily = AnalyticsEngine.aggregateDaily(data);
    const n = daily.length;

    // 1. Overall Trend (7 days vs previous 7 days)
    if (n >= 14) {
      const recent = daily.slice(-7).reduce((acc, d) => acc + d.sales, 0) / 7;
      const prev = daily.slice(-14, -7).reduce((acc, d) => acc + d.sales, 0) / 7;
      const trend = prev > 0 ? ((recent - prev) / prev) * 100 : 0;

      if (trend > 10) {
        recs.push({
          type: "trending",
          title: "Sales Momentum Is Strong",
          message: `Revenue is up ${trend.toFixed(1)}% in the last 7 days compared to the prior week. Consider increasing production, inventory buffer, and ad spend.`,
          priority: "high"
        });
      } else if (trend < -10) {
        recs.push({
          type: "slow",
          title: "Sales Are Declining",
          message: `Revenue is down ${Math.abs(trend).toFixed(1)}% over the past 7 days. Review recent pricing shifts, investigate product stockouts, or initiate targeted promotions.`,
          priority: "high"
        });
      }
    }

    // 2. Product-Level Recommendations
    const productMap = {};
    for (const r of data) {
      if (!productMap[r.product]) {
        productMap[r.product] = { total: 0, items: [] };
      }
      productMap[r.product].total += r.sales;
      productMap[r.product].items.push(r);
    }

    const productList = Object.entries(productMap).map(([p, obj]) => ({
      product: p,
      total: obj.total,
      items: obj.items
    }));
    productList.sort((a, b) => b.total - a.total);

    // Restock alerts on top sellers with accelerating velocity
    for (const pObj of productList.slice(0, 3)) {
      const sorted = pObj.items.sort((a, b) => (a.date > b.date ? 1 : -1));
      if (sorted.length >= 4) {
        const mid = Math.floor(sorted.length / 2);
        const r1 = sorted.slice(0, mid).reduce((acc, i) => acc + i.sales, 0) / mid;
        const r2 = sorted.slice(mid).reduce((acc, i) => acc + i.sales, 0) / (sorted.length - mid);
        if (r2 > r1 * 1.15) {
          recs.push({
            type: "restock",
            title: `Restock Alert: ${pObj.product}`,
            message: `${pObj.product} is a top seller (${DataEngine.fmtINR(pObj.total)} aggregate revenue) with accelerating demand (+${Math.round((r2 / r1 - 1) * 100)}% in recent period). Ensure supplier lead times are secured.`,
            priority: "high"
          });
        }
      }
    }

    // Slow mover warnings
    if (productList.length >= 3) {
      const totals = productList.map(p => p.total).sort((a, b) => a - b);
      const median = totals[Math.floor(totals.length / 2)];
      for (const pObj of productList.slice(-3)) {
        if (pObj.total < median * 0.35) {
          recs.push({
            type: "slow",
            title: `Slow Mover: ${pObj.product}`,
            message: `${pObj.product} has generated only ${DataEngine.fmtINR(pObj.total)} total sales, underperforming median inventory by over 65%. Consider clearance discounts or catalog pruning.`,
            priority: "medium"
          });
        }
      }
    }

    // 3. Weekday vs Weekend Dynamics
    if (n >= 14) {
      let weSum = 0, weCount = 0, wdSum = 0, wdCount = 0;
      for (const d of daily) {
        const dateObj = new Date(d.date);
        const dow = (dateObj.getDay() + 6) % 7;
        if (dow >= 5) {
          weSum += d.sales;
          weCount++;
        } else {
          wdSum += d.sales;
          wdCount++;
        }
      }
      const weAvg = weCount ? weSum / weCount : 0;
      const wdAvg = wdCount ? wdSum / wdCount : 0;

      if (weAvg > wdAvg * 1.20) {
        const premium = Math.round((weAvg / wdAvg - 1) * 100);
        recs.push({
          type: "trending",
          title: "Weekends Outperform Substantially",
          message: `Weekend daily revenue (${DataEngine.fmtINR(weAvg)}) is ${premium}% higher than weekdays (${DataEngine.fmtINR(wdAvg)}). Align customer support and fulfillment staff for Friday-Sunday surges.`,
          priority: "medium"
        });
      } else if (wdAvg > weAvg * 1.20) {
        const premium = Math.round((wdAvg / weAvg - 1) * 100);
        recs.push({
          type: "trending",
          title: "B2B / Weekdays Dominate Demand",
          message: `Weekday daily revenue (${DataEngine.fmtINR(wdAvg)}) is ${premium}% higher than weekends (${DataEngine.fmtINR(weAvg)}). Target marketing pushes between Tuesday and Thursday.`,
          priority: "medium"
        });
      }
    }

    // 4. Margin Health Check
    const hasCost = data.some(r => r.cost !== null && r.cost !== undefined);
    if (hasCost) {
      const totalSales = data.reduce((acc, r) => acc + (r.sales || 0), 0);
      const totalCost = data.reduce((acc, r) => acc + (r.cost || 0), 0);
      const margin = totalSales > 0 ? ((totalSales - totalCost) / totalSales) * 100 : 0;

      if (margin < 20) {
        recs.push({
          type: "slow",
          title: "Low Gross Profit Margin Warning",
          message: `Overall margin is currently ${margin.toFixed(1)}%. Review vendor unit costs, reduce discounting, or adjust retail price points to protect cash flow.`,
          priority: "high"
        });
      } else if (margin > 50) {
        recs.push({
          type: "trending",
          title: "Exceptional Margin Buffer",
          message: `Overall gross margin is robust at ${margin.toFixed(1)}%. You have comfortable headroom for aggressive acquisition campaigns, loyalty rewards, or volume discounting.`,
          priority: "low"
        });
      }
    }

    // 5. Forecast-based Projections
    if (forecastData && forecastData.forecast && forecastData.forecast.length >= 7 && n >= 7) {
      const recentAct = daily.slice(-7).reduce((acc, d) => acc + d.sales, 0) / 7;
      const futurePred = forecastData.forecast.slice(0, 7).reduce((acc, f) => acc + f.yhat, 0) / 7;
      const chg = recentAct > 0 ? ((futurePred - recentAct) / recentAct) * 100 : 0;

      if (chg > 15) {
        recs.push({
          type: "trending",
          title: "Forecast: Revenue Surge Anticipated",
          message: `Model predicts a +${chg.toFixed(0)}% revenue climb over the coming week (~${DataEngine.fmtINR(futurePred)}/day vs current ~${DataEngine.fmtINR(recentAct)}/day). Prepare logistics.`,
          priority: "high"
        });
      } else if (chg < -15) {
        recs.push({
          type: "slow",
          title: "Forecast: Expected Near-Term Dip",
          message: `Model projects a -${Math.abs(chg).toFixed(0)}% decrease in sales next week (~${DataEngine.fmtINR(futurePred)}/day vs current ~${DataEngine.fmtINR(recentAct)}/day). Schedule proactive customer re-engagement.`,
          priority: "high"
        });
      }
    }

    if (!recs.length) {
      recs.push({
        type: "trending",
        title: "All Business Metrics Stable",
        message: "No acute warnings or urgent anomalies detected. Continue routine operations and monitor daily updates.",
        priority: "low"
      });
    }

    return recs;
  }

  return {
    generateRecommendations
  };
})();
