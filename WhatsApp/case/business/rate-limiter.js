// All state below is keyed per botId. Several bots can run in the same Node
// process (see WhatsApp/index.js), so a single shared counter would let one
// broken bot's send failures trip the circuit breaker for every other bot.
const bulkCountByBot = new Map();
const consecutiveFailuresByBot = new Map();
const MAX_BULK_PER_HOUR = 150;
const MAX_BULK_PER_DAY = 1000;
const BULK_DELAY_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 5;

function getBulkCount(botId) {
  let entry = bulkCountByBot.get(botId);
  if (!entry) {
    entry = { hour: 0, day: 0, lastHourReset: Date.now(), lastDayReset: Date.now() };
    bulkCountByBot.set(botId, entry);
  }
  return entry;
}

function resetCountersIfNeeded(botId) {
  const bulkCount = getBulkCount(botId);
  const now = Date.now();
  if (now - bulkCount.lastHourReset > 60 * 60 * 1000) {
    bulkCount.hour = 0;
    bulkCount.lastHourReset = now;
  }
  if (now - bulkCount.lastDayReset > 24 * 60 * 60 * 1000) {
    bulkCount.day = 0;
    bulkCount.lastDayReset = now;
  }
  return bulkCount;
}

// Circuit breaker: if too many real send failures happen (connection/account issue),
// pause ALL sends — including direct replies — since this signals the session itself
// is in trouble, not a spam-volume problem.
function isCircuitOpen(botId) {
  return (consecutiveFailuresByBot.get(botId) || 0) >= MAX_CONSECUTIVE_FAILURES;
}

function recordSuccess(botId) {
  consecutiveFailuresByBot.set(botId, 0);
}

function recordFailure(botId) {
  const failures = (consecutiveFailuresByBot.get(botId) || 0) + 1;
  consecutiveFailuresByBot.set(botId, failures);
  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    console.log(`[RATE LIMIT] [${botId}] Circuit breaker OPENED after ${failures} failures`);
    setTimeout(() => {
      consecutiveFailuresByBot.set(botId, 0);
      console.log(`[RATE LIMIT] [${botId}] Circuit breaker reset`);
    }, 10 * 60 * 1000);
  }
}

// Direct 1-on-1 reply to a customer who just messaged the bot. This is normal
// conversational traffic (not spam), so it is NOT subject to the hourly/daily
// bulk caps — only the circuit breaker (real connection failures) can block it.
export async function replySend(lenwy, jid, content, options = {}, botId = "default") {
  if (isCircuitOpen(botId)) {
    console.log(`[RATE LIMIT] [${botId}] Circuit breaker open, pausing sends`);
    return { skipped: true, reason: "circuit_open" };
  }
  try {
    const result = await lenwy.sendMessage(jid, content, options);
    recordSuccess(botId);
    return result;
  } catch (err) {
    recordFailure(botId);
    throw err;
  }
}

// Throttled send for automated/system messages (low stock alert, urgent ticket
// alert, new-order alert to owner, payment reminders, delivery followups).
// Subject to the bulk hourly/daily caps to avoid burst patterns.
export async function throttledSend(lenwy, jid, content, options = {}, botId = "default") {
  const bulkCount = resetCountersIfNeeded(botId);

  if (bulkCount.hour >= MAX_BULK_PER_HOUR) {
    console.log(`[RATE LIMIT] [${botId}] Hourly bulk limit reached, skipping message`);
    return { skipped: true, reason: "hourly_limit" };
  }
  if (bulkCount.day >= MAX_BULK_PER_DAY) {
    console.log(`[RATE LIMIT] [${botId}] Daily bulk limit reached, skipping message`);
    return { skipped: true, reason: "daily_limit" };
  }
  if (isCircuitOpen(botId)) {
    console.log(`[RATE LIMIT] [${botId}] Circuit breaker open, pausing sends`);
    return { skipped: true, reason: "circuit_open" };
  }

  try {
    const result = await lenwy.sendMessage(jid, content, options);
    bulkCount.hour++;
    bulkCount.day++;
    recordSuccess(botId);
    return result;
  } catch (err) {
    recordFailure(botId);
    throw err;
  }
}

// For bulk sends: sends to multiple recipients with proper delays and batching
export async function bulkSend(lenwy, recipients, contentFn, options = {}, botId = "default") {
  const batchSize = options.batchSize || 30;
  const delayBetween = options.delay || BULK_DELAY_MS;
  const pauseBetweenBatches = options.batchPause || 60000; // 1 min between batches
  let sent = 0, failed = 0, skipped = 0;
  const sentKeys = [];

  for (let i = 0; i < recipients.length; i++) {
    const bulkCount = resetCountersIfNeeded(botId);

    if (bulkCount.hour >= MAX_BULK_PER_HOUR || bulkCount.day >= MAX_BULK_PER_DAY || isCircuitOpen(botId)) {
      skipped += recipients.length - i;
      console.log(`[RATE LIMIT] [${botId}] Stopping bulk send: sent=${sent}, skipped=${skipped}`);
      break;
    }

    try {
      const content = typeof contentFn === "function" ? contentFn(recipients[i]) : contentFn;
      const result = await lenwy.sendMessage(recipients[i].jid, content);
      sentKeys.push({ jid: recipients[i].jid, messageId: result?.key?.id || "" });
      bulkCount.hour++;
      bulkCount.day++;
      recordSuccess(botId);
      sent++;
    } catch (err) {
      recordFailure(botId);
      failed++;
      if (isCircuitOpen(botId)) {
        skipped += recipients.length - i - 1;
        console.log(`[RATE LIMIT] [${botId}] Circuit breaker opened during bulk send`);
        break;
      }
    }

    // Delay between messages
    await new Promise(r => setTimeout(r, delayBetween + Math.floor(Math.random() * 2000)));

    // Pause between batches
    if ((i + 1) % batchSize === 0 && i + 1 < recipients.length) {
      console.log(`[RATE LIMIT] [${botId}] Batch ${Math.floor(i/batchSize) + 1} done, pausing ${pauseBetweenBatches/1000}s...`);
      await new Promise(r => setTimeout(r, pauseBetweenBatches));
    }
  }

  return { sent, failed, skipped, sentKeys };
}

// Get current rate limit status (for dashboard API)
export function getRateLimitStatus(botId = "default") {
  const bulkCount = resetCountersIfNeeded(botId);
  return {
    hourly: { sent: bulkCount.hour, limit: MAX_BULK_PER_HOUR },
    daily: { sent: bulkCount.day, limit: MAX_BULK_PER_DAY },
    circuitOpen: isCircuitOpen(botId),
    consecutiveFailures: consecutiveFailuresByBot.get(botId) || 0,
  };
}

// Simple delay helper with jitter
export function delay(ms) {
  const jitter = Math.floor(Math.random() * 1000);
  return new Promise(r => setTimeout(r, ms + jitter));
}

// Per-customer media-burst guard. Sending several product photos in a row
// during one chat is normal conversational behaviour (not bulk broadcast),
// so it isn't subject to the bulk hour/day caps above. But an unbounded
// stream of images to the same customer still looks like burst/spam traffic
// to WhatsApp, so it gets its own rolling-24h cap per botId+customer.
const mediaCountByCustomer = new Map();
const MAX_MEDIA_PER_CUSTOMER_PER_DAY = 24;

function getMediaCount(botId, customerKey) {
  const key = `${botId}:${customerKey}`;
  let entry = mediaCountByCustomer.get(key);
  const now = Date.now();
  if (!entry || now - entry.lastReset > 24 * 60 * 60 * 1000) {
    entry = { count: 0, lastReset: now };
    mediaCountByCustomer.set(key, entry);
  }
  return entry;
}

export function canSendMedia(botId, customerKey, max = MAX_MEDIA_PER_CUSTOMER_PER_DAY) {
  return getMediaCount(botId || "default", customerKey).count < max;
}

export function recordMediaSent(botId, customerKey) {
  getMediaCount(botId || "default", customerKey).count++;
}
