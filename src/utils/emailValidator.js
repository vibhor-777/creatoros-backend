const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
};

const getAllowedEduDomains = () => {
  const raw = process.env.EDU_EMAIL_DOMAINS || 'edu';
  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
};

const isValidEmail = (email) => EMAIL_REGEX.test(normalizeEmail(email));

const isEduEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return false;
  }

  const domain = normalized.split('@')[1] || '';
  const allowedDomains = getAllowedEduDomains();

  return allowedDomains.some((allowedDomain) => {
    if (allowedDomain.startsWith('.')) {
      return domain.endsWith(allowedDomain.slice(1));
    }

    if (allowedDomain.includes('.')) {
      return domain === allowedDomain || domain.endsWith(`.${allowedDomain}`);
    }

    return domain.endsWith(`.${allowedDomain}`) || domain === allowedDomain;
  });
};

module.exports = {
  normalizeEmail,
  getAllowedEduDomains,
  isValidEmail,
  isEduEmail
};
