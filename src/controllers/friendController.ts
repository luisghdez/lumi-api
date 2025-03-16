import { FastifyRequest, FastifyReply } from "fastify";
import { searchUsers } from "../services/friendService";

// Controller for handling user search requests.
export async function searchUsersController(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Expecting the search string as a query parameter "q".
    const { q } = request.query as { q?: string };
    if (!q) {
      return reply.status(400).send({ error: "Missing search query parameter 'q'" });
    }

    // Call the service to perform the search.
    const users = await searchUsers(q);
    return reply.status(200).send({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return reply.status(500).send({ error: "Failed to search users" });
  }
}