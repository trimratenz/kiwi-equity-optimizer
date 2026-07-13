export function getVisibleStepLabels(showOcrForecast) {
  return {
    loanDetails: "Step 1",
    repayment: "Step 2",
    marketComparison: "Step 3",
    ocrForecast: showOcrForecast ? "Step 4" : null,
    optimization: `Step ${showOcrForecast ? 5 : 4}`
  };
}
