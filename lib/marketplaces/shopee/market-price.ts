/** The min/max the seller sees has to come from the prices we stored, not from a number the model restated. */
export function marketPriceRange(competitors: { price: number | null }[]) {
  const prices = competitors.map((c) => c.price).filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (!prices.length) return { min: null, median: null, max: null, sampleSize: 0 };
  const middle = prices.length / 2;
  return {
    min: prices[0],
    median: prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[middle - 1] + prices[middle]) / 2,
    max: prices[prices.length - 1],
    sampleSize: prices.length,
  };
}
