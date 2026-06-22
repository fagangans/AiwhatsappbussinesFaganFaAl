import {
  getActiveAutomationRules, incrementRuleExecution, logRuleExecution,
  getOrCreateCustomer, getAllCustomers,
} from "../../database/business/db.js";
import { throttledSend } from "./rate-limiter.js";

export async function evaluateRules(lenwy, { customerJid, customerName, body, ownerId, botId }) {
  let rules;
  try {
    rules = getActiveAutomationRules(ownerId);
  } catch (_) {
    return;
  }
  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    try {
      const triggerConfig = JSON.parse(rule.trigger_config || "{}");
      const actionConfig = JSON.parse(rule.action_config || "{}");
      const matched = checkTrigger(rule.trigger_type, triggerConfig, { customerJid, customerName, body });
      if (!matched) continue;

      await executeAction(lenwy, rule.action_type, actionConfig, { customerJid, customerName, body, ownerId, botId });
      incrementRuleExecution(rule.id);
      logRuleExecution(rule.id, customerJid, "success");
    } catch (err) {
      try { logRuleExecution(rule.id, customerJid, `error: ${err.message}`); } catch (_) {}
    }
  }
}

function checkTrigger(type, config, ctx) {
  switch (type) {
    case "keyword": {
      if (!config.keywords || !ctx.body) return false;
      const keywords = Array.isArray(config.keywords) ? config.keywords : config.keywords.split(",").map(k => k.trim());
      const lower = ctx.body.toLowerCase();
      const mode = config.match_mode || "any";
      if (mode === "all") return keywords.every(k => lower.includes(k.toLowerCase()));
      return keywords.some(k => lower.includes(k.toLowerCase()));
    }
    case "regex": {
      if (!config.pattern || !ctx.body) return false;
      try {
        return new RegExp(config.pattern, "i").test(ctx.body);
      } catch (_) {
        return false;
      }
    }
    case "first_message": {
      try {
        const cust = getOrCreateCustomer(ctx.customerJid, ctx.customerName, 1);
        return cust && cust.total_orders === 0;
      } catch (_) {
        return false;
      }
    }
    case "contains_media": {
      return false;
    }
    default:
      return false;
  }
}

async function executeAction(lenwy, type, config, ctx) {
  switch (type) {
    case "send_message": {
      if (!config.message) return;
      let text = config.message;
      text = text.replace(/\{name\}/gi, ctx.customerName || "Customer");
      text = text.replace(/\{phone\}/gi, ctx.customerJid.split("@")[0]);
      await throttledSend(lenwy, ctx.customerJid, { text }, {}, ctx.botId || "default");
      break;
    }
    case "add_tag": {
      if (!config.tag) return;
      try {
        const cust = getOrCreateCustomer(ctx.customerJid, ctx.customerName, ctx.ownerId, ctx.botId || "");
        const tags = JSON.parse(cust.tags || "[]");
        if (!tags.includes(config.tag)) {
          tags.push(config.tag);
          const { updateCustomer } = await import("../../database/business/db.js");
          updateCustomer(cust.id, { tags: JSON.stringify(tags) });
        }
      } catch (_) {}
      break;
    }
    case "notify_agent": {
      if (!config.agent_jid) return;
      const agentJid = config.agent_jid.includes("@") ? config.agent_jid : config.agent_jid + "@s.whatsapp.net";
      const text = `🔔 *Notifikasi Otomatis*\n\nCustomer *${ctx.customerName || ctx.customerJid.split("@")[0]}* mengirim pesan yang cocok dengan rule.\n\nPesan: _${(ctx.body || "").slice(0, 200)}_`;
      await throttledSend(lenwy, agentJid, { text }, {}, ctx.botId || "default");
      break;
    }
    default:
      break;
  }
}
