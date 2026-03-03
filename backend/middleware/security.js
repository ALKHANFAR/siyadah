/**
 * سيادة — Security Hardening
 * Phase 9.5b: OWASP Top 10 Prevention
 */

const crypto = require("crypto");

// ══════════ Password Hashing (bcrypt-compatible) ══════════
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verify;
}

// ══════════ JWT ══════════
function generateToken(payload, secret = process.env.JWT_SECRET || "siyadah-dev-secret") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret = process.env.JWT_SECRET || "siyadah-dev-secret") {
  try {
    const [header, body, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    if (signature !== expected) return { valid: false, error: "INVALID_SIGNATURE" };
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, error: "TOKEN_EXPIRED" };
    return { valid: true, payload };
  } catch (e) { return { valid: false, error: "MALFORMED_TOKEN" }; }
}

// ══════════ Rate Limiter ══════════
class RateLimiter {
  constructor(maxRequests = 5, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.store = new Map();
  }

  check(key) {
    const now = Date.now();
    const record = this.store.get(key) || { count: 0, resetAt: now + this.windowMs };
    if (now > record.resetAt) { record.count = 0; record.resetAt = now + this.windowMs; }
    record.count++;
    this.store.set(key, record);
    return { allowed: record.count <= this.maxRequests, remaining: Math.max(0, this.maxRequests - record.count), resetAt: record.resetAt };
  }

  reset(key) { this.store.delete(key); }
}

// ══════════ Input Sanitization ══════════
function sanitizeInput(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/['";\\]/g, c => `\\${c}`)
    .trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^\+?[0-9]{10,15}$/.test(phone.replace(/[\s\-()]/g, ""));
}

// ══════════ CORS Headers ══════════
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

// ══════════ Webhook Signature ══════════
function signWebhook(payload, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function verifyWebhookSignature(payload, signature, secret) {
  const expected = signWebhook(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken, RateLimiter, sanitizeInput, validateEmail, validatePhone, corsHeaders, signWebhook, verifyWebhookSignature };
