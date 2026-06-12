const fs = require('fs');
const crypto = require('crypto');

const createChecksumFromFile = (filePath, algorithm = 'sha256') => {
  const content = fs.readFileSync(filePath);
  return crypto.createHash(algorithm).update(content).digest('hex');
};

const createChecksumFromString = (value, algorithm = 'sha256') => {
  return crypto.createHash(algorithm).update(value).digest('hex');
};

const verifyChecksum = ({ value, expected, algorithm = 'sha256' }) => {
  const hash = createChecksumFromString(value, algorithm);
  return hash === expected;
};

module.exports = {
  createChecksumFromFile,
  createChecksumFromString,
  verifyChecksum
};
