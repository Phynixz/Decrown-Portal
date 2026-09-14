function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateName(value) {
  const v = normalizeText(value);
  return /^[A-Za-z][A-Za-z\s'.-]{2,49}$/.test(v);
}

function validateEmail(value) {
  const v = normalizeText(value).toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(v);
}

function validatePhone(value) {
  const v = normalizeText(value).replace(/\s+/g, '');
  return /^\+?[0-9]{11,15}$/.test(v);
}

function isTokenExpired(token) {
  if (!token) return true;
  const clean = String(token).replace(/^Bearer\s+/i, '');
  const payloadPart = clean.split('.')[1];
  if (!payloadPart) return false;

  try {
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (!payload.exp) return false;
    return Date.now() >= Number(payload.exp) * 1000;
  } catch {
    return false;
  }
}

module.exports = {
  normalizeText,
  validateName,
  validateEmail,
  validatePhone,
  isTokenExpired,
};
