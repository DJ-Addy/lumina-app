import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../lib/env.js";
import { supabase } from "../lib/supabase.js";

const RevenueCatEventSchema = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    expiration_at_ms: z.number().int().nullable().optional(),
    product_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
  }),
});

const ACTIVATING_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "TRIAL_STARTED",
  "TRIAL_CONVERTED",
  "NON_RENEWING_PURCHASE",
]);

const DEACTIVATING_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIPTION_PAUSED",
]);

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post("/revenuecat", async (request, reply) => {
    if (env.REVENUECAT_WEBHOOK_TOKEN) {
      const auth = request.headers.authorization;
      if (auth !== `Bearer ${env.REVENUECAT_WEBHOOK_TOKEN}`) {
        return reply.status(401).send({ code: "UNAUTHORIZED" });
      }
    }

    const parsed = RevenueCatEventSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ err: parsed.error.flatten() }, "Invalid RevenueCat payload");
      return reply.status(400).send({ code: "BAD_PAYLOAD" });
    }

    const { event } = parsed.data;
    const userId = event.app_user_id;

    if (!isUuid(userId)) {
      request.log.info({ userId }, "Ignoring webhook for non-Supabase user id");
      return reply.send({ ok: true, ignored: true });
    }

    const updates: Record<string, unknown> = {};

    if (ACTIVATING_EVENTS.has(event.type)) {
      updates["subscription_tier"] = "pro";
      updates["subscription_expires_at"] = event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;
      updates["monthly_chat_credits_used"] = 0;
    } else if (DEACTIVATING_EVENTS.has(event.type)) {
      updates["subscription_tier"] = "free";
      updates["subscription_expires_at"] = null;
    } else {
      return reply.send({ ok: true, ignored: true, type: event.type });
    }

    const { error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      request.log.error({ err: error, userId }, "Failed to update subscription");
      return reply.status(500).send({ code: "DB_ERROR" });
    }

    return reply.send({ ok: true, type: event.type, userId });
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
