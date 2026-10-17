export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateName(value) {
  const v = normalizeText(value);
  return /^[A-Za-z][A-Za-z\s'.-]{2,49}$/.test(v);
}

export function validateEmail(value) {
  const v = normalizeText(value).toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(v);
}

export function validatePhone(value) {
  const v = normalizeText(value).replace(/\s+/g, "");
  return /^\+?[0-9]{11,15}$/.test(v);
}

export function validatePassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

export function isTokenExpired(token) {
  if (!token) return true;
  const clean = token.replace(/^Bearer\s+/i, "");
  const payloadPart = clean.split(".")[1];
  if (!payloadPart) return false;

  try {
    const payload = JSON.parse(
      typeof window === "undefined"
        ? Buffer.from(payloadPart, "base64").toString("utf8")
        : atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!payload.exp) return false;
    return Date.now() >= Number(payload.exp) * 1000;
  } catch {
    return false;
  }
}
