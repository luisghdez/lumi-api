import { FastifyRequest, FastifyReply } from "fastify";
import { createFireStoreUser, getUserProfile } from "../services/userService";

interface CreateUserRequestBody {
  email: string;
  name: string;
  profilePicture: string;
}

export async function ensureUserExistsController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const user = (request as any).user;

        if (!user || !user.uid) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
      
      // Optionally, you might also pass user email, name, etc. from the client body:
      const { email, name, profilePicture } = request.body as {
        email?: string;
        name?: string;
        profilePicture?: string;
      };

      const uid = user.uid;
  
      await createFireStoreUser(uid, { email, name, profilePicture });
  
      // Return success (could also return the user doc if you like)
      reply.code(200).send({ message: "User ensured/created successfully." });
    } catch (error) {
      console.error("🔥 Error ensuring user exists:", error);
      reply.code(500).send({ error: "Error ensuring user exists" });
    }
  }

  export async function getUserProfileController(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as { userId: string };
      if (!userId) {
        return reply.status(400).send({ error: "Missing userId parameter" });
      }
  
      const userProfile = await getUserProfile(userId);
      if (!userProfile) {
        return reply.status(404).send({ error: "User not found" });
      }
      
      return reply.status(200).send({ user: userProfile });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return reply.status(500).send({ error: "Failed to fetch user profile" });
    }
  }