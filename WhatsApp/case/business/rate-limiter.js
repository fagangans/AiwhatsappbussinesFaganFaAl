let bulkCount = { hour: 0, day: 0, lastHourReset: Date.now(), lastDayReset: Date.now() };
let consecutiveFailures = 0;
const MAX_BULK_PER_HOUR = 150;
const MAX_BULK_PER_DAY = 1000;
const BULK_DELAY_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 5;

function resetCountersIfNeeded() {
  const now = Date.now();
  if (now - bulkCount.lastHourReset > 60 * 60 * 1000) {
    bulkCount.hour = 0;
    bulkCount.lastHourReset = now;
  }
  if (now - bulkCount.lastDayReset > 24 * 60 * 60 * 1000) {
    bulkCount.day = 0;
    bulkCount.lastDayReset = now;
  }
}

// Circuit breaker: if too many real send failures happen (connection/account issue),
// pause ALL sends — including direct replies — since this signals the session itself
// is in trouble, not a spam-volume problem.
function isCircuitOpen() {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}

function recordSuccess() {
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.log("[RATE LIMIT] Circuit breaker OPENED after " + consecutiveFailures + " failures");
    setTimeout(() => { consecutiveFailures = 0; console.log("[RATE LIMIT] Circuit breaker reset"); }, 10 * 60 * 1000);
  }
}

// Direct 1-on-1 reply to a customer who just messaged the bot. This is normal
// conversational traffic (not spam), so it is NOT subject to the hourly/daily
// bulk caps — only the circuit breaker (real connection failures) can block it.
export async function replySend(lenwy, jid, content, options = {}) {
  if (isCircuitOpen()) {
    console.log("[RATE LIMIT] Circuit breaker open, pausing sends");
    return { skipped: true, reason: "circuit_open" };
  }
  try {
    const result = await lenwy.sendMessage(jid, content, options);
    recordSuccess();
    return result;
  } catch (err) {
    recordFailure();
    throw err;
  }
}

// Throttled send for automated/system messages (low stock alert, urgent ticket
// alert, new-order alert to owner, payment reminders, delivery followups).
// Subject to the bulk hourly/daily caps to avoid burst patterns.
export async function throttledSend(lenwy, jid, content, options = {}) {
  resetCountersIfNeeded();

  if (bulkCount.hour >= MAX_BULK_PER_HOUR) {
    console.log("[RATE LIMIT] Hourly bulk limit reached, skipping message");
    return { skipped: true, reason: "hourly_limit" };
  }
  if (bulkCount.day >= MAX_BULK_PER_DAY) {
    console.log("[RATE LIMIT] Daily bulk limit reached, skipping message");
    return { skipped: true, reason: "daily_limit" };
  }
  if (isCircuitOpen()) {
    console.log("[RATE LIMIT] Circuit breaker open, pausing sends");
    return { skipped: true, reason: "circuit_open" };
  }

  try {
    const result = await lenwy.sendMessage(jid, content, options);
    bulkCount.hour++;
    bulkCount.day++;
    recordSuccess();
    return result;
  } catch (err) {
    recordFailure();
    throw err;
  }
}

// For bulk sends: sends to multiple recipients with proper delays and batching
export async function bulkSend(lenwy, recipients, contentFn, options = {}) {
  const batchSize = options.batchSize || 30;
  const delayBetween = options.delay || BULK_DELAY_MS;
  const pauseBetweenBatches = options.batchPause || 60000; // 1 min between batches
  let sent = 0, failed = 0, skipped = 0;

  for (let i = 0; i < recipients.length; i++) {
    resetCountersIfNeeded();

    if (bulkCount.hour >= MAX_BULK_PER_HOUR || bulkCount.day >= MAX_BULK_PER_DAY || isCircuitOpen()) {
      skipped += recipients.length - i;
      console.log(`[RATE LIMIT] Stopping bulk send: sent=${sent}, skipped=${skipped}`);
      break;
    }

    try {
      const content = typeof contentFn === "function" ? contentFn(recipients[i]) : contentFn;
      await lenwy.sendMessage(recipients[i].jid, content);
      bulkCount.hour++;
      bulkCount.day++;
      recordSuccess();
      sent++;
    } catch (err) {
      recordFailure();
      failed++;
      if (isCircuitOpen()) {
        skipped += recipients.length - i - 1;
        console.log("[RATE LIMIT] Circuit breaker opened during bulk send");
        break;
      }
    }

    // Delay between messages
    await new Promise(r => setTimeout(r, delayBetween + Math.floor(Math.random() * 2000)));

    // Pause between batches
    if ((i + 1) % batchSize === 0 && i + 1 < recipients.length) {
      console.log(`[RATE LIMIT] Batch ${Math.floor(i/batchSize) + 1} done, pausing ${pauseBetweenBatches/1000}s...`);
      await new Promise(r => setTimeout(r, pauseBetweenBatches));
    }
  }

  return { sent, failed, skipped };
}

// Get current rate limit status (for dashboard API)
export function getRateLimitStatus() {
  resetCountersIfNeeded();
  return {
    hourly: { sent: bulkCount.hour, limit: MAX_BULK_PER_HOUR },
    daily: { sent: bulkCount.day, limit: MAX_BULK_PER_DAY },
    circuitOpen: isCircuitOpen(),
    consecutiveFailures,
  };
}

// Simple delay helper with jitter
export function delay(ms) {
  const jitter = Math.floor(Math.random() * 1000);
  return new Promise(r => setTimeout(r, ms + jitter));
}
