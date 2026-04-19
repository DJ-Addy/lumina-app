import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { supabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";

const SUSPENDED_KEY_PREFIX = "community:suspended";
const SUSPENDED_TTL_SECONDS = 60 * 60 * 24 * 7;

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ code: "UNAUTHORIZED", message: "Missing bearer token" });
    }
    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return reply.status(401).send({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
    }
    request.user = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: (data.user.user_metadata?.["role"] as "user" | "admin") ?? "user",
    };
  });

  /**
   * Use after `authenticate` on any community route. Blocks suspended profiles
   * with HTTP 403 ACCOUNT_SUSPENDED. Reads from a Redis flag for speed and
   * falls back to the DB only when the flag is missing.
   */
  fastify.decorate(
    "requireActiveCommunityProfile",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      const userId = request.user.id;
      const redis = getRedis();
      const cacheKey = `${SUSPENDED_KEY_PREFIX}:${userId}`;

      const cached = await redis.get(cacheKey);
      if (cached === "1") {
        return reply.status(403).send({
          code: "ACCOUNT_SUSPENDED",
          message:
            "Your community account has been suspended due to repeated guideline violations. The rest of Lumina is unaffected.",
        });
      }
      if (cached === "0") return; // active, no DB hit needed

      // Cold cache: hit the DB once and remember the answer
      const { data, error } = await supabase
        .from("community_profiles")
        .select("suspended_at, suspension_reason")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        request.log.warn({ err: error }, "Failed to load community profile suspension status");
        return; // fail open rather than block legitimate users
      }

      if (data?.["suspended_at"]) {
        await redis.set(cacheKey, "1", "EX", SUSPENDED_TTL_SECONDS);
        return reply.status(403).send({
          code: "ACCOUNT_SUSPENDED",
          message:
            (data["suspension_reason"] as string | null) ??
            "Your community account has been suspended due to repeated guideline violations.",
        });
      }

      await redis.set(cacheKey, "0", "EX", 60 * 5); // cache "active" for 5 minutes
    },
  );
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireActiveCommunityProfile: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

export default fp(authPlugin, { name: "auth" });
