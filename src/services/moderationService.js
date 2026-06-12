const bannedWords = new Set([
  'pirated',
  'cheatcode',
  'malware',
  'exploit',
  'hacked-account'
]);

const scanText = (text = '') => {
  const normalized = String(text).toLowerCase();
  const hits = [];

  bannedWords.forEach((word) => {
    if (normalized.includes(word)) {
      hits.push(word);
    }
  });

  return {
    approved: hits.length === 0,
    hits,
    score: Math.max(0, 100 - hits.length * 25)
  };
};

const moderateProduct = ({ title, description }) => {
  const titleScan = scanText(title);
  const descriptionScan = scanText(description);

  const approved = titleScan.approved && descriptionScan.approved;
  const hits = [...titleScan.hits, ...descriptionScan.hits];

  return {
    approved,
    hits,
    reason: approved ? null : `Content contains blocked terms: ${hits.join(', ')}`,
    score: Math.min(titleScan.score, descriptionScan.score)
  };
};

module.exports = {
  scanText,
  moderateProduct
};
