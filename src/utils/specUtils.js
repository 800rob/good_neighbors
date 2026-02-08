const specDefinitions = require('../data/specDefinitions.json');

/**
 * Get spec definitions for a specific tier3 item/service.
 * Resolves tier2 inheritance and tier3 overrides.
 *
 * @param {string} type - 'item' or 'service'
 * @param {string} tier1 - e.g., 'Outdoor & Recreation'
 * @param {string} tier2 - e.g., 'Winter Sports'
 * @param {string} tier3 - e.g., 'Alpine Skis'
 * @returns {Array|null} Array of spec field definitions, or null if none defined
 */
function getSpecsForItem(type, tier1, tier2, tier3) {
  if (!type || !tier1 || !tier2 || !tier3) return null;
  if (tier3 === 'Other') return null;

  const key = type === 'item' ? 'items' : 'services';
  const categoryData = specDefinitions[key]?.[tier1];
  if (!categoryData) return null;

  // Get tier2 default specs
  const tier2Defaults = categoryData._tier2Defaults?.[tier2] || [];

  // Check for tier3-specific overrides
  const tier3Data = categoryData[tier2]?.[tier3];

  if (!tier3Data) {
    // No tier3-specific config — return tier2 defaults if they exist
    return tier2Defaults.length > 0 ? tier2Defaults : null;
  }

  if (tier3Data.inherit === false) {
    // Don't inherit tier2 defaults, only use tier3's own specs
    return tier3Data.specs && tier3Data.specs.length > 0 ? tier3Data.specs : null;
  }

  // inherit: true (or default) — merge tier2 defaults with tier3 specs
  const tier3Specs = tier3Data.specs || [];
  const merged = [...tier2Defaults, ...tier3Specs];

  return merged.length > 0 ? merged : null;
}

/**
 * Validate lender spec values against spec definitions.
 * Lender values are simple: { value: <any> }
 *
 * @param {Array} specDefs - Spec field definitions from getSpecsForItem
 * @param {Object} specValues - The specs object from lender's details, e.g., { skiLength: { value: 190 } }
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLenderSpecs(specDefs, specValues) {
  const errors = [];

  if (!specDefs || !specValues) {
    return { valid: true, errors: [] };
  }

  for (const def of specDefs) {
    const specVal = specValues[def.key];

    // Check required fields
    if (def.required && (!specVal || specVal.value === undefined || specVal.value === null || specVal.value === '')) {
      errors.push(`${def.label} is required`);
      continue;
    }

    // Skip validation if not provided
    if (!specVal || specVal.value === undefined || specVal.value === null || specVal.value === '') {
      continue;
    }

    const val = specVal.value;

    // Type validation
    switch (def.type) {
      case 'number':
        if (typeof val !== 'number' || isNaN(val)) {
          errors.push(`${def.label} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof val !== 'boolean') {
          errors.push(`${def.label} must be true or false`);
        }
        break;
      case 'select':
        if (def.options && !def.options.includes(val)) {
          errors.push(`${def.label} must be one of: ${def.options.join(', ')}`);
        }
        break;
      case 'multi-select':
        if (!Array.isArray(val)) {
          errors.push(`${def.label} must be an array`);
        } else if (def.options) {
          const invalid = val.filter(v => !def.options.includes(v));
          if (invalid.length > 0) {
            errors.push(`${def.label} contains invalid options: ${invalid.join(', ')}`);
          }
        }
        break;
      case 'text':
        if (typeof val !== 'string') {
          errors.push(`${def.label} must be text`);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate borrower spec values against spec definitions.
 * Borrower values include flexibility and requiredMatch flags:
 * { value: <any>, flexibility?: number, requiredMatch?: boolean }
 *
 * @param {Array} specDefs - Spec field definitions from getSpecsForItem
 * @param {Object} specValues - The specs object from borrower's details
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBorrowerSpecs(specDefs, specValues) {
  const errors = [];

  if (!specDefs || !specValues) {
    return { valid: true, errors: [] };
  }

  for (const def of specDefs) {
    const specVal = specValues[def.key];

    // Skip if not provided (borrower specs are always optional)
    if (!specVal || specVal.value === undefined || specVal.value === null || specVal.value === '') {
      continue;
    }

    const val = specVal.value;

    // Type validation (same as lender)
    switch (def.type) {
      case 'number':
        if (typeof val !== 'number' || isNaN(val)) {
          errors.push(`${def.label} must be a number`);
        }
        // Validate flexibility if present
        if (specVal.flexibility !== undefined && specVal.flexibility !== null) {
          if (typeof specVal.flexibility !== 'number' || specVal.flexibility < 0) {
            errors.push(`${def.label} flexibility must be a non-negative number`);
          }
        }
        break;
      case 'boolean':
        if (typeof val !== 'boolean') {
          errors.push(`${def.label} must be true or false`);
        }
        break;
      case 'select':
        if (def.options && !def.options.includes(val)) {
          errors.push(`${def.label} must be one of: ${def.options.join(', ')}`);
        }
        break;
      case 'multi-select':
        if (!Array.isArray(val)) {
          errors.push(`${def.label} must be an array`);
        } else if (def.options) {
          const invalid = val.filter(v => !def.options.includes(v));
          if (invalid.length > 0) {
            errors.push(`${def.label} contains invalid options: ${invalid.join(', ')}`);
          }
        }
        break;
      case 'text':
        if (typeof val !== 'string') {
          errors.push(`${def.label} must be text`);
        }
        break;
    }

    // Validate requiredMatch flag
    if (specVal.requiredMatch !== undefined && typeof specVal.requiredMatch !== 'boolean') {
      errors.push(`${def.label} requiredMatch must be true or false`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { getSpecsForItem, validateLenderSpecs, validateBorrowerSpecs };
