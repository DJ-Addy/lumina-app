import type { FastifyRequest } from "fastify";

export interface AuthUser {
  id: string;
  email: string | undefined;
  role: "user" | "admin";
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}
