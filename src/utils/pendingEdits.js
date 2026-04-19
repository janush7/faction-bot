/**
 * pendingEdits.js — Tiny in-memory TTL store for preview/confirm edit flows.
 *
 * Panel edits (Rotation, Nodes, Server Details, Lineup Caption) route through
 * a preview step before the live Discord message is updated. We stash the
 * parsed payload here, keyed by a short random nonce, and consume it when the
 * admin clicks Apply (or drop it on Cancel / timeout).
 *
 * Store layout (per kind namespace): Map<nonce, { ...entry, expiresAt }>
 * Entries older than TTL_MS are evicted on every read/write.
 */

const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000; // 10 min
const stores = new Map(); // kind → Map<nonce, entry>

function _store(kind) {
  let s = stores.get(kind);
  if (!s) { s = new Map(); stores.set(kind, s); }
  return s;
}

function _evictExpired(kind, now = Date.now()) {
  const s = _store(kind);
  for (const [nonce, entry] of s) {
    if (entry.expiresAt <= now) s.delete(nonce);
  }
}

function storePendingEdit(kind, entry) {
  _evictExpired(kind);
  const nonce = crypto.randomBytes(6).toString('hex');
  _store(kind).set(nonce, { ...entry, expiresAt: Date.now() + TTL_MS });
  return nonce;
}

/**
 * Pops an entry out of the store. Returns `null` if expired / already used.
 * Caller is expected to verify ownership (entry.ownerId) and re-insert with
 * `restorePendingEdit` if it needs to bounce back (e.g. wrong owner clicked).
 */
function consumePendingEdit(kind, nonce) {
  _evictExpired(kind);
  const s = _store(kind);
  const entry = s.get(nonce);
  if (!entry) return null;
  s.delete(nonce);
  return entry;
}

function restorePendingEdit(kind, nonce, entry) {
  _store(kind).set(nonce, entry);
}

module.exports = {
  storePendingEdit,
  consumePendingEdit,
  restorePendingEdit,
};
