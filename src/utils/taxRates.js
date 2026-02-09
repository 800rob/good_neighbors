/**
 * State-level sales tax rates for the US.
 * Rates are general state-level rates (excludes local/city taxes).
 * Source: standard state sales tax rates as of 2025.
 */

const STATE_TAX_RATES = {
  AL: 0.04,
  AK: 0,       // No state sales tax
  AZ: 0.056,
  AR: 0.065,
  CA: 0.0725,
  CO: 0.029,
  CT: 0.0635,
  DE: 0,       // No state sales tax
  FL: 0.06,
  GA: 0.04,
  HI: 0.04,
  ID: 0.06,
  IL: 0.0625,
  IN: 0.07,
  IA: 0.06,
  KS: 0.065,
  KY: 0.06,
  LA: 0.0445,
  ME: 0.055,
  MD: 0.06,
  MA: 0.0625,
  MI: 0.06,
  MN: 0.0688,
  MS: 0.07,
  MO: 0.0423,
  MT: 0,       // No state sales tax
  NE: 0.055,
  NV: 0.0685,
  NH: 0,       // No state sales tax
  NJ: 0.0663,
  NM: 0.0513,
  NY: 0.04,
  NC: 0.0475,
  ND: 0.05,
  OH: 0.0575,
  OK: 0.045,
  OR: 0,       // No state sales tax
  PA: 0.06,
  RI: 0.07,
  SC: 0.06,
  SD: 0.045,
  TN: 0.07,
  TX: 0.0625,
  UT: 0.061,
  VT: 0.06,
  VA: 0.053,
  WA: 0.065,
  WV: 0.06,
  WI: 0.05,
  WY: 0.04,
  DC: 0.06,
};

/**
 * Get sales tax rate for a US state.
 * @param {string|null|undefined} state - Two-letter state abbreviation (e.g. "CO")
 * @returns {number} Tax rate as a decimal (e.g. 0.029 for 2.9%). Returns 0 if unknown.
 */
function getTaxRate(state) {
  if (!state) return 0;
  const normalized = state.trim().toUpperCase();
  return STATE_TAX_RATES[normalized] ?? 0;
}

module.exports = { getTaxRate, STATE_TAX_RATES };
