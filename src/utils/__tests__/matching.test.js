const { calculateMatchScore, calculateTextRelevance, calculateSpecScore, extractKeywords } = require('../matching');

describe('extractKeywords', () => {
  test('extracts meaningful words, removes stop words', () => {
    const keywords = extractKeywords('I need a pressure washer for my driveway');
    expect(keywords).toContain('pressure');
    expect(keywords).toContain('washer');
    expect(keywords).toContain('driveway');
    expect(keywords).not.toContain('i');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('for');
    expect(keywords).not.toContain('my');
  });

  test('removes short words (2 chars or less)', () => {
    const keywords = extractKeywords('go to the big red car');
    expect(keywords).not.toContain('go');
    expect(keywords).toContain('big');
    expect(keywords).toContain('red');
    expect(keywords).toContain('car');
  });

  test('lowercases all keywords', () => {
    const keywords = extractKeywords('Electric Drill and Hammer');
    expect(keywords).toContain('electric');
    expect(keywords).toContain('drill');
    expect(keywords).toContain('hammer');
  });

  test('handles empty/null input', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords(null)).toEqual([]);
    expect(extractKeywords(undefined)).toEqual([]);
  });

  test('removes punctuation', () => {
    const keywords = extractKeywords("it's a high-quality, brand-new item!");
    expect(keywords.every(w => /^[a-z0-9]+$/.test(w))).toBe(true);
  });
});

describe('calculateTextRelevance', () => {
  test('returns high score for matching keywords', () => {
    const request = { title: 'Pressure Washer', description: 'Need to clean driveway' };
    const item = { title: 'Pressure Washer 3000 PSI', description: 'Great for driveways and patios' };
    const { score, titleMatch } = calculateTextRelevance(request, item);
    expect(score).toBeGreaterThan(50);
    expect(titleMatch).toBe(false); // Not exact match due to "3000 PSI"
  });

  test('detects exact title match', () => {
    const request = { title: 'Pressure Washer', description: '' };
    const item = { title: 'Pressure Washer', description: '' };
    const { titleMatch } = calculateTextRelevance(request, item);
    expect(titleMatch).toBe(true);
  });

  test('title match ignores case and punctuation', () => {
    const request = { title: 'pressure-washer', description: '' };
    const item = { title: 'Pressure Washer!', description: '' };
    const { titleMatch } = calculateTextRelevance(request, item);
    expect(titleMatch).toBe(true);
  });

  test('returns low score for unrelated items', () => {
    const request = { title: 'Chainsaw', description: 'Need to cut trees' };
    const item = { title: 'Yoga Mat', description: 'Perfect for stretching and meditation' };
    const { score } = calculateTextRelevance(request, item);
    expect(score).toBeLessThan(20);
  });

  test('returns 50 when request has no extractable keywords', () => {
    const request = { title: 'A', description: '' };
    const item = { title: 'Power Drill', description: '' };
    const { score } = calculateTextRelevance(request, item);
    expect(score).toBe(50);
  });
});

describe('calculateSpecScore', () => {
  const specDefs = [
    { key: 'length', type: 'number', matchWeight: 2, defaultFlexibility: 10 },
    { key: 'color', type: 'select', matchWeight: 1 },
    { key: 'waterproof', type: 'boolean', matchWeight: 1 },
  ];

  test('returns 0 when no spec defs provided', () => {
    const result = calculateSpecScore({}, {}, null);
    expect(result.score).toBe(0);
    expect(result.excluded).toBe(false);
  });

  test('returns 0 when no specs on either side', () => {
    const result = calculateSpecScore({}, {}, specDefs);
    expect(result.score).toBe(0);
  });

  test('scores exact number match as 1.0', () => {
    const reqDetails = { specs: { length: { value: 180 } } };
    const itemDetails = { specs: { length: { value: 180 } } };
    const result = calculateSpecScore(reqDetails, itemDetails, specDefs);
    expect(result.score).toBeGreaterThan(0);
    expect(result.excluded).toBe(false);
  });

  test('scores number within flexibility range', () => {
    const reqDetails = { specs: { length: { value: 180, flexibility: 10 } } };
    const itemDetails = { specs: { length: { value: 185 } } };
    const result = calculateSpecScore(reqDetails, itemDetails, specDefs);
    expect(result.score).toBeGreaterThan(0);
    expect(result.excluded).toBe(false);
  });

  test('excludes on required match failure', () => {
    const reqDetails = { specs: { color: { value: 'red', requiredMatch: true } } };
    const itemDetails = { specs: { color: { value: 'blue' } } };
    const result = calculateSpecScore(reqDetails, itemDetails, specDefs);
    expect(result.excluded).toBe(true);
  });

  test('scores boolean match correctly', () => {
    const reqDetails = { specs: { waterproof: { value: true } } };
    const itemDetails = { specs: { waterproof: { value: true } } };
    const result = calculateSpecScore(reqDetails, itemDetails, specDefs);
    expect(result.score).toBeGreaterThan(0);
  });

  test('scores boolean mismatch as 0 for that field', () => {
    const reqDetails = { specs: { waterproof: { value: true } } };
    const itemDetails = { specs: { waterproof: { value: false } } };
    const result = calculateSpecScore(reqDetails, itemDetails, specDefs);
    expect(result.breakdown.waterproof.score).toBe(0);
  });

  test('handles multi-select spec type', () => {
    const multiDefs = [{ key: 'features', type: 'multi-select', matchWeight: 1 }];
    const reqDetails = { specs: { features: { value: ['wifi', 'bluetooth'] } } };
    const itemDetails = { specs: { features: { value: ['wifi', 'usb'] } } };
    const result = calculateSpecScore(reqDetails, itemDetails, multiDefs);
    // 1 out of 2 match = 0.5
    expect(result.breakdown.features.score).toBe(0.5);
  });

  test('score is capped at 15', () => {
    const reqDetails = { specs: { length: { value: 100 }, color: { value: 'red' }, waterproof: { value: true } } };
    const itemDetails = { specs: { length: { value: 100 }, color: { value: 'red' }, waterproof: { value: true } } };
    const result = calculateSpecScore(reqDetails, itemDetails, specDefs);
    expect(result.score).toBeLessThanOrEqual(15);
    expect(result.score).toBeGreaterThan(10); // Should be close to max
  });
});

describe('calculateMatchScore', () => {
  const baseRequest = {
    title: 'Drill',
    description: 'Need a drill',
    category: 'tools',
    maxDistanceMiles: '10',
    maxBudget: '50',
    details: {},
  };

  const baseItem = {
    title: 'Power Drill',
    description: 'Cordless drill',
    category: 'tools',
    condition: 'good',
    pricingType: 'daily',
    priceAmount: '10',
    details: {},
    owner: { ratingsReceived: [] },
  };

  test('returns score between 0 and 100', () => {
    const score = calculateMatchScore(baseRequest, baseItem, 2, 60, false, 0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('exact title match gives high score (85-97)', () => {
    const score = calculateMatchScore(baseRequest, baseItem, 2, 100, true, 0);
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(97);
  });

  test('higher text relevance gives higher score', () => {
    const lowRelevance = calculateMatchScore(baseRequest, baseItem, 2, 20, false, 0);
    const highRelevance = calculateMatchScore(baseRequest, baseItem, 2, 80, false, 0);
    expect(highRelevance).toBeGreaterThan(lowRelevance);
  });

  test('closer distance gives higher score', () => {
    const farScore = calculateMatchScore(baseRequest, baseItem, 9, 60, false, 0);
    const nearScore = calculateMatchScore(baseRequest, baseItem, 1, 60, false, 0);
    expect(nearScore).toBeGreaterThan(farScore);
  });

  test('free items get maximum price score', () => {
    const freeItem = { ...baseItem, pricingType: 'free', priceAmount: '0' };
    const paidItem = { ...baseItem, pricingType: 'daily', priceAmount: '40' };
    const freeScore = calculateMatchScore(baseRequest, freeItem, 2, 60, false, 0);
    const paidScore = calculateMatchScore(baseRequest, paidItem, 2, 60, false, 0);
    expect(freeScore).toBeGreaterThan(paidScore);
  });

  test('better condition gives higher score', () => {
    const poorItem = { ...baseItem, condition: 'poor' };
    const newItem = { ...baseItem, condition: 'new' };
    const poorScore = calculateMatchScore(baseRequest, poorItem, 2, 60, false, 0);
    const newScore = calculateMatchScore(baseRequest, newItem, 2, 60, false, 0);
    expect(newScore).toBeGreaterThan(poorScore);
  });

  test('owner ratings boost score', () => {
    const ratedItem = {
      ...baseItem,
      owner: { ratingsReceived: [{ overallRating: 5 }, { overallRating: 5 }] },
    };
    const unratedScore = calculateMatchScore(baseRequest, baseItem, 2, 60, false, 0);
    const ratedScore = calculateMatchScore(baseRequest, ratedItem, 2, 60, false, 0);
    expect(ratedScore).toBeGreaterThan(unratedScore);
  });

  test('spec score adds to total', () => {
    const noSpec = calculateMatchScore(baseRequest, baseItem, 2, 60, false, 0);
    const withSpec = calculateMatchScore(baseRequest, baseItem, 2, 60, false, 10);
    expect(withSpec).toBeGreaterThan(noSpec);
  });

  test('category match gives bonus', () => {
    const sameCategory = calculateMatchScore(baseRequest, baseItem, 2, 60, false, 0);
    const diffItem = { ...baseItem, category: 'outdoor_recreation' };
    const diffCategory = calculateMatchScore(baseRequest, diffItem, 2, 60, false, 0);
    expect(sameCategory).toBeGreaterThan(diffCategory);
  });
});
