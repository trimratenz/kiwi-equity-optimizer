export function lowestRateBanks(records = [], termInMonths) {
  const comparable = records.filter(
    (record) => record.termInMonths === termInMonths && Number.isFinite(Number(record.rate))
  );
  if (!comparable.length) return { rate: null, banks: [] };

  const rate = Math.min(...comparable.map((record) => Number(record.rate)));
  return {
    rate,
    banks: comparable
      .filter((record) => Math.abs(Number(record.rate) - rate) < 1e-9)
      .map((record) => record.institution)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  };
}
