/** Merge by id without mutating either input. Incoming records win. */
/** @template {{id: string}} T @param {T[]} incoming @param {T[]} existing @param {number} limit @returns {T[]} */
export function mergeFeedPosts(incoming, existing, limit = 100) {
  const records = new Map();
  for (const post of [...incoming, ...existing]) {
    if (post && typeof post.id === 'string' && post.id && !records.has(post.id)) records.set(post.id, post);
    if (records.size >= limit) break;
  }
  return [...records.values()];
}
/** @param {string | null} value @param {Date} now @returns {Date | null} */
export function parseFeedCursor(value, now = new Date()) {
  if (!value) return new Date(now.getTime() - 20000);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed <= now ? parsed : null;
}
