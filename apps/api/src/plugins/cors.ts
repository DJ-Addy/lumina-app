import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fp from "fastify-plugin";
import { env } from "../lib/env.js";

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: env.NODE_ENV === "production" ? env.CORS_ORIGIN.split(",") : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-ID"],
  });
}

export default fp(corsPlugin, { name: "cors" });
