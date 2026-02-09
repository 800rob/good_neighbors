/**
 * Shared fee calculation utility.
 * Used by transactionController (direct borrow) and matchController (auto-create on accept).
 */

/**
 * Calculate the rental fee for a given pricing tier and duration.
 * @param {number} rate - Price per unit for this tier
 * @param {string} tierType - 'hourly' | 'daily' | 'weekly' | 'monthly'
 * @param {Date} pickup - Pickup date
 * @param {Date} returnDate - Return date
 * @returns {number} Total rental fee for this tier
 */
function calculateRentalFeeForTier(rate, tierType, pickup, returnDate) {
  const diffMs = returnDate - pickup;
  if (diffMs <= 0) return rate; // minimum 1 unit

  const msPerHour = 1000 * 60 * 60;
  const msPerDay = msPerHour * 24;

  switch (tierType) {
    case 'hourly': {
      const hours = Math.ceil(diffMs / msPerHour);
      return rate * hours;
    }
    case 'daily': {
      const days = Math.max(1, Math.ceil(diffMs / msPerDay));
      return rate * days;
    }
    case 'weekly': {
      const weeks = Math.max(1, Math.ceil(diffMs / msPerDay / 7));
      return rate * weeks;
    }
    case 'monthly': {
      const months = Math.max(1, Math.ceil(diffMs / msPerDay / 30));
      return rate * months;
    }
    default:
      return rate;
  }
}

/**
 * Calculate all fees for a transaction, choosing the cheapest pricing tier.
 * @param {object} item - The item (must include priceAmount, pricingType, replacementValue, depositPercentage, details)
 * @param {Date|string} pickupTime - Pickup date/time
 * @param {Date|string} returnTime - Return date/time
 * @param {string} protectionType - 'waiver' | 'insurance' | 'deposit'
 * @param {number} [taxRate=0] - Sales tax rate as decimal (e.g. 0.029 for 2.9%)
 * @returns {{ rentalFee: number, platformFee: number, borrowerPlatformFee: number, lenderPlatformFee: number, taxRate: number, taxAmount: number, depositAmount: number|null, insuranceFee: number|null, totalCharged: number, chosenTier: string, chosenRate: number }}
 */
function calculateFees(item, pickupTime, returnTime, protectionType, taxRate = 0) {
  const pickup = new Date(pickupTime);
  const returnDate = new Date(returnTime);

  // Build list of all available pricing tiers
  const tiers = [];
  const pricingTiers = item.details?.pricingTiers;

  if (pricingTiers && typeof pricingTiers === 'object') {
    // Use all tiers from the item's pricingTiers
    for (const [tierType, rate] of Object.entries(pricingTiers)) {
      if (rate && parseFloat(rate) > 0) {
        tiers.push({ tierType, rate: parseFloat(rate) });
      }
    }
  }

  // If no pricingTiers, fall back to the primary pricingType/priceAmount
  if (tiers.length === 0 && item.pricingType && item.priceAmount) {
    tiers.push({ tierType: item.pricingType, rate: parseFloat(item.priceAmount) });
  }

  // Calculate rental fee for each tier and pick the cheapest
  let bestRentalFee = Infinity;
  let chosenTier = item.pricingType || 'daily';
  let chosenRate = parseFloat(item.priceAmount) || 0;

  for (const { tierType, rate } of tiers) {
    const fee = calculateRentalFeeForTier(rate, tierType, pickup, returnDate);
    if (fee < bestRentalFee) {
      bestRentalFee = fee;
      chosenTier = tierType;
      chosenRate = rate;
    }
  }

  const rentalFee = bestRentalFee === Infinity ? 0 : bestRentalFee;

  // Platform fee: $1 + 3% of rental fee (full amount, split 50/50)
  const platformFee = 1 + (rentalFee * 0.03);
  const borrowerPlatformFee = platformFee / 2;
  const lenderPlatformFee = platformFee / 2;

  // Sales tax on the rental fee
  const taxAmount = parseFloat((rentalFee * taxRate).toFixed(2));

  // Calculate protection costs
  let depositAmount = null;
  let insuranceFee = null;

  if (protectionType === 'deposit') {
    depositAmount = parseFloat(item.replacementValue) * (item.depositPercentage / 100);
  } else if (protectionType === 'insurance') {
    // Insurance fee: 5% of replacement value
    insuranceFee = parseFloat(item.replacementValue) * 0.05;
  }

  // Total charged = what the BORROWER actually pays
  const totalCharged = rentalFee + borrowerPlatformFee + taxAmount + (insuranceFee || 0) + (depositAmount || 0);

  return {
    rentalFee, platformFee, borrowerPlatformFee, lenderPlatformFee,
    taxRate, taxAmount, depositAmount, insuranceFee,
    totalCharged, chosenTier, chosenRate,
  };
}

module.exports = { calculateFees };
