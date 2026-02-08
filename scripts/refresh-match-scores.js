const prisma = require('../src/config/database');
const { calculateDistance } = require('../src/utils/distance');

function extractKeywords(text) {
  if (!text) return [];
  const stopWords = new Set(['a','an','the','and','or','but','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','shall','can','need','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','under','again','further','then','once','here','there','when','where','why','how','all','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','i','me','my','we','our','you','your','he','him','his','she','her','it','its','they','them','their','what','which','who','whom','this','that','these','those','am','any','looking','need','want','like','please','thanks']);
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));
}

function titlesMatch(t1, t2) {
  if (!t1 || !t2) return false;
  const normalize = t => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(t1) === normalize(t2);
}

function calcTextRelevance(req, item) {
  const titleMatch = titlesMatch(req.title, item.title);
  const reqKw = new Set([...extractKeywords(req.title), ...extractKeywords(req.description)]);
  const itemKw = new Set([...extractKeywords(item.title), ...extractKeywords(item.description)]);
  if (reqKw.size === 0) return { score: 50, titleMatch };
  let matchCount = 0;
  for (const kw of reqKw) {
    for (const ikw of itemKw) {
      if (ikw === kw || ikw.includes(kw) || kw.includes(ikw)) { matchCount++; break; }
    }
  }
  return { score: Math.round((matchCount / reqKw.size) * 100), titleMatch };
}

function calcScore(req, item, distance, textRel, titleMatch) {
  if (titleMatch) {
    let score = 88;
    if (item.category === req.category) score += 2;
    if (item.pricingType === 'free') score += 2;
    const maxDist = parseFloat(req.maxDistanceMiles);
    score -= Math.min(3, (distance / maxDist) * 3);
    return Math.max(85, Math.min(95, Math.round(score)));
  }
  let score = (textRel / 100) * 60;
  if (item.category === req.category) score += 8;
  const maxDist = parseFloat(req.maxDistanceMiles);
  score += Math.max(0, ((maxDist - distance) / maxDist) * 12);
  if (item.pricingType === 'free') score += 8;
  else score += 4;
  const condScores = { new: 4, excellent: 3, good: 2, fair: 1, poor: 0 };
  score += condScores[item.condition] || 0;
  return Math.max(0, Math.min(98, Math.round(score)));
}

async function refreshMatches() {
  const matches = await prisma.match.findMany({
    include: {
      request: true,
      item: { include: { owner: true } }
    }
  });

  console.log('Refreshing ' + matches.length + ' matches...');
  let updated = 0;

  for (const match of matches) {
    const req = match.request;
    const item = match.item;
    if (!req || !item) continue;

    const distance = calculateDistance(
      parseFloat(req.latitude), parseFloat(req.longitude),
      parseFloat(item.owner?.latitude || 0), parseFloat(item.owner?.longitude || 0)
    );

    const { score: textRel, titleMatch } = calcTextRelevance(req, item);
    const newScore = calcScore(req, item, distance, textRel, titleMatch);

    console.log(`Match: "${req.title}" <-> "${item.title}" | Old: ${match.matchScore} | New: ${newScore} | TextRel: ${textRel} | TitleMatch: ${titleMatch}`);

    if (newScore !== match.matchScore) {
      await prisma.match.update({
        where: { id: match.id },
        data: { matchScore: newScore }
      });
      updated++;
    }
  }

  console.log('\nUpdated ' + updated + ' match scores');
  process.exit(0);
}

refreshMatches().catch(e => { console.error(e); process.exit(1); });
