import { FastifyRequest, FastifyReply } from "fastify";
import { createFriendRequest, getFriendRequests, searchUsers } from "../services/friendService";

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

export async function createFriendRequestController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { recipientId } = request.body as { recipientId?: string };
    if (!recipientId) {
      return reply.status(400).send({ error: "Missing recipientId" });
    }

    // Get the senderId from the authenticated user's token.
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const senderId = user.uid;

    // Create the friend request.
    const friendRequest = await createFriendRequest(senderId, recipientId);
    return reply.status(201).send({ friendRequest });
  } catch (error) {
    console.error("Error creating friend request:", error);
    return reply.status(500).send({ error: "Failed to create friend request" });
  }
}

export async function getFriendRequestsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const userId = user.uid;
    const friendRequests = await getFriendRequests(userId);
    return reply.status(200).send(friendRequests);
  } catch (error) {
    console.error("Error retrieving friend requests:", error);
    return reply.status(500).send({ error: "Failed to retrieve friend requests" });
  }
}
