const messageQueue = [];
let isProcessing = false;
let sentCount = { hour: 0, day: 0, lastHourReset: Date.now(), lastDayReset: Date.now() };
let consecutiveFailures = 0;
const MAX_PER_HOUR = 150;
const MAX_PER_DAY = 1000;
const MIN_DELAY_MS = 3000;
const BULK_DELAY_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 5;

function resetCountersIfNeeded() {
  const now = Date.now();
  if (now - sentCount.lastHourReset > 60 * 60 * 1000) {
    sentCount.hour = 0;
    sentCount.lastHourReset = now;
  }
  if (now - sentCount.lastDayReset > 24 * 60 * 60 * 1000) {
    sentCount.day = 0;
    sentCount.lastDayReset = now;
  }
}

// Circuit breaker: if too many failures, pause sending
function isCircuitOpen() {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}

function resetCircuit() {
  consecutiveFailures = 0;
}

// Throttled send — returns a promise. All outbound messages go through this.
export async function throttledSend(lenwy, jid, content, options = {}) {
  resetCountersIfNeeded();

  if (sentCount.hour >= MAX_PER_HOUR) {
    console.log("[RATE LIMIT] Hourly limit reached, skipping message");
    return { skipped: true, reason: "hourly_limit" };
  }
  if (sentCount.day >= MAX_PER_DAY) {
    console.log("[RATE LIMIT] Daily limit reached, skipping message");
    return { skipped: true, reason: "daily_limit" };
  }
  if (isCircuitOpen()) {
    console.log("[RATE LIMIT] Circuit breaker open, pausing sends");
    return { skipped: true, reason: "circuit_open" };
  }

  try {
    const result = await lenwy.sendMessage(jid, content, options);
    sentCount.hour++;
    sentCount.day++;
    consecutiveFailures = 0;
    return result;
  } catch (err) {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log("[RATE LIMIT] Circuit breaker OPENED after " + consecutiveFailures + " failures");
      // Auto-reset circuit after 10 minutes
      setTimeout(() => { consecutiveFailures = 0; console.log("[RATE LIMIT] Circuit breaker reset"); }, 10 * 60 * 1000);
    }
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

    if (sentCount.hour >= MAX_PER_HOUR || sentCount.day >= MAX_PER_DAY || isCircuitOpen()) {
      skipped += recipients.length - i;
      console.log(`[RATE LIMIT] Stopping bulk send: sent=${sent}, skipped=${skipped}`);
      break;
    }

    try {
      const content = typeof contentFn === "function" ? contentFn(recipients[i]) : contentFn;
      await lenwy.sendMessage(recipients[i].jid, content);
      sentCount.hour++;
      sentCount.day++;
      consecutiveFailures = 0;
      sent++;
    } catch (err) {
      consecutiveFailures++;
      failed++;
      if (isCircuitOpen()) {
        skipped += recipients.length - i - 1;
        console.log("[RATE LIMIT] Circuit breaker opened during bulk send");
        setTimeout(() => { consecutiveFailures = 0; }, 10 * 60 * 1000);
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
    hourly: { sent: sentCount.hour, limit: MAX_PER_HOUR },
    daily: { sent: sentCount.day, limit: MAX_PER_DAY },
    circuitOpen: isCircuitOpen(),
    consecutiveFailures,
  };
}

// Simple delay helper with jitter
export function delay(ms) {
  const jitter = Math.floor(Math.random() * 1000);
  return new Promise(r => setTimeout(r, ms + jitter));
}
