const {
  normalizeEmail,
  isValidEmail,
  isEduEmail,
  getAllowedEduDomains
} = require('../src/utils/emailValidator');

describe('emailValidator utility', () => {
  beforeEach(() => {
    process.env.EDU_DOMAIN_WHITELIST = 'edu,ac.in,college.edu';
  });

  test('normalizes email safely', () => {
    expect(normalizeEmail('  USER@Campus.EDU ')).toBe('user@campus.edu');
    expect(normalizeEmail(null)).toBe('');
  });

  test('validates email format', () => {
    expect(isValidEmail('student@college.edu')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
  });

  test('supports edu allow-list checks', () => {
    expect(isEduEmail('alice@iit.ac.in')).toBe(true);
    expect(isEduEmail('bob@privatecompany.com')).toBe(false);
  });

  test('reads allowed domains from env', () => {
    expect(getAllowedEduDomains()).toEqual(['edu', 'ac.in', 'college.edu']);
  });
});
