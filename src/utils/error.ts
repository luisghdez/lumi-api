import { FastifyReply } from "fastify";

export function sendError(reply: FastifyReply, status: number, message: string, meta?: any) {
  reply.status(status).send({ success: false, error: message, ...(meta ? { meta } : {}) });
}

export function asMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}