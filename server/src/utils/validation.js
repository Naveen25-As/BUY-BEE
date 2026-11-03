const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isPositiveInt(value) {
  return Number.isInteger(value) && value >= 1;
}

export function isNonNegativeInt(value) {
  return Number.isInteger(value) && value >= 0;
}

export function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Escapes LIKE/ILIKE wildcards so user input is matched literally.
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}

// Builds a quoted PostgREST filter value (for use inside .or()) that is safe against filter-syntax injection.
export function pgrstQuote(value) {
  return `"${String(value).replace(/[\\"]/g, (m) => `\\${m}`)}"`;
}

export function containsPattern(value) {
  return `%${escapeLike(value)}%`;
}

// Express router.param handler that rejects malformed ids with a 404 before they reach the database.
export function uuidParam(label = 'Resource') {
  return (req, res, next, value) => {
    if (!isUuid(value)) {
      return res.status(404).json({ success: false, message: `${label} not found` });
    }
    next();
  };
}
