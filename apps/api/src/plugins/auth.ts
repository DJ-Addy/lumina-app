import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { supabase } from "../lib/supabase.js";
import type { AuthUser } from "../types/index.js";

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
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin, { name: "auth" });
