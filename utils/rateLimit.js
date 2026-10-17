// Minimal in-memory fixed-window rate limiter — appropriate for the current
// single-instance deployment (Render). If the app ever scales to multiple
// instances, swap this for a shared store (Redis) without changing call sites.
//
// NOTE: in production set `app.set("trust proxy", 1)` (already done in
// server.js) so req.ip reflects the real client, not the proxy.

const buckets = new Map();

function rateLimit({ name, windowMs, max }) {
  if (!name || !windowMs || !max) {
    throw new Error("rateLimit requires name, windowMs, and max");
  }

  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip || "unknown"}`;
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 10000) {
      for (const [bucketKey, entry] of buckets) {
        if (now >= entry.resetAt) buckets.delete(bucketKey);
      }
    }

    if (bucket.count > max) {
      const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(seconds));
      return res
        .status(429)
        .json({ error: "Too many attempts. Please try again later." });
    }

    next();
  };
}

module.exports = { rateLimit };
