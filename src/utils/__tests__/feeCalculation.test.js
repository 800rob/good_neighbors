const { calculateFees } = require('../feeCalculation');

describe('calculateFees', () => {
  const baseItem = {
    pricingType: 'daily',
    priceAmount: '10.00',
    replacementValue: '200.00',
    depositPercentage: 25,
    details: {},
  };

  const pickup = new Date('2026-03-01T09:00:00Z');
  const returnDate = new Date('2026-03-04T09:00:00Z');

  test('calculates daily rental fee correctly (inclusive days)', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'waiver');
    // Mar 1-4 inclusive = 4 days at $10/day
    expect(result.rentalFee).toBe(40);
    expect(result.chosenTier).toBe('daily');
    expect(result.chosenRate).toBe(10);
  });

  test('calculates platform fee as $1 + 3%', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'waiver');
    // $1 + 3% of $40 = $1 + $1.20 = $2.20
    expect(result.platformFee).toBe(2.2);
    expect(result.borrowerPlatformFee).toBe(1.1);
    expect(result.lenderPlatformFee).toBe(1.1);
  });

  test('calculates deposit correctly', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'deposit');
    // 25% of $200 replacement value = $50
    expect(result.depositAmount).toBe(50);
    expect(result.insuranceFee).toBeNull();
  });

  test('calculates insurance fee correctly', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'insurance');
    // 5% of $200 replacement value = $10
    expect(result.insuranceFee).toBe(10);
    expect(result.depositAmount).toBeNull();
  });

  test('waiver has no deposit or insurance', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'waiver');
    expect(result.depositAmount).toBeNull();
    expect(result.insuranceFee).toBeNull();
  });

  test('calculates tax correctly', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'waiver', 0.06);
    // 6% of $40 = $2.40
    expect(result.taxRate).toBe(0.06);
    expect(result.taxAmount).toBe(2.4);
  });

  test('totalCharged includes rental + borrowerPlatformFee + tax + protection', () => {
    const result = calculateFees(baseItem, pickup, returnDate, 'deposit', 0.06);
    const expected = result.rentalFee + result.borrowerPlatformFee + result.taxAmount + result.depositAmount;
    expect(result.totalCharged).toBeCloseTo(expected, 2);
  });

  test('handles free items (zero price)', () => {
    const freeItem = { ...baseItem, pricingType: 'free', priceAmount: '0' };
    const result = calculateFees(freeItem, pickup, returnDate, 'waiver');
    expect(result.rentalFee).toBe(0);
    expect(result.platformFee).toBe(1); // $1 + 3% of $0
  });

  test('handles hourly pricing', () => {
    const hourlyItem = { ...baseItem, pricingType: 'hourly', priceAmount: '5.00' };
    const oneHourLater = new Date(pickup.getTime() + 3 * 60 * 60 * 1000); // 3 hours
    const result = calculateFees(hourlyItem, pickup, oneHourLater, 'waiver');
    expect(result.rentalFee).toBe(15); // 3 hours * $5
    expect(result.chosenTier).toBe('hourly');
  });

  test('handles weekly pricing', () => {
    const weeklyItem = { ...baseItem, pricingType: 'weekly', priceAmount: '50.00' };
    const twoWeeksLater = new Date('2026-03-15T09:00:00Z');
    const result = calculateFees(weeklyItem, pickup, twoWeeksLater, 'waiver');
    // Mar 1-15 = 15 inclusive days = ceil(15/7) = 3 weeks
    expect(result.rentalFee).toBe(150);
    expect(result.chosenTier).toBe('weekly');
  });

  test('handles monthly pricing', () => {
    const monthlyItem = { ...baseItem, pricingType: 'monthly', priceAmount: '100.00' };
    const twoMonthsLater = new Date('2026-05-01T09:00:00Z');
    const result = calculateFees(monthlyItem, pickup, twoMonthsLater, 'waiver');
    // Mar 1 - May 1 = 62 inclusive days = ceil(62/30) = 3 months
    expect(result.rentalFee).toBe(300);
  });

  test('picks cheapest pricing tier from pricingTiers', () => {
    const multiTierItem = {
      ...baseItem,
      details: {
        pricingTiers: {
          daily: 10,
          weekly: 50,
        },
      },
    };
    // 10 day rental: daily = $100, weekly = ceil(10/7)*50 = $100. Equal, but daily checked first
    const tenDaysLater = new Date('2026-03-11T09:00:00Z');
    const result = calculateFees(multiTierItem, pickup, tenDaysLater, 'waiver');
    // 11 inclusive days: daily = $110, weekly = ceil(11/7)=2 weeks * $50 = $100
    expect(result.rentalFee).toBe(100);
    expect(result.chosenTier).toBe('weekly');
  });

  test('handles same day (zero duration)', () => {
    const result = calculateFees(baseItem, pickup, pickup, 'waiver');
    // Minimum 1 unit = $10
    expect(result.rentalFee).toBe(10);
  });

  test('handles missing priceAmount gracefully', () => {
    const noPrice = { ...baseItem, priceAmount: null, pricingType: 'daily', details: {} };
    const result = calculateFees(noPrice, pickup, returnDate, 'waiver');
    expect(result.rentalFee).toBe(0);
  });
});
