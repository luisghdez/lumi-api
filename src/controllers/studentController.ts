import { FastifyRequest, FastifyReply } from "fastify";
import { getStudentClassesForUser, StudentClassSummary } from "../services/classService";

export async function getStudentClassesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user;
  if (!user?.uid) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  try {
    const classes: StudentClassSummary[] = await getStudentClassesForUser(user.uid);
    return reply.status(200).send(classes);
  } catch (err) {
    console.error("Error fetching student classes:", err);
    return reply.status(500).send({ error: "Failed to fetch classes" });
  }
}