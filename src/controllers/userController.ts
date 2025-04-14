import { FastifyRequest, FastifyReply } from "fastify";
import { createFireStoreUser, deleteFireStoreUser, getUserProfile } from "../services/userService";
import { checkStreakOnLogin } from "../services/streakService";

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

  export async function getUserProfileController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const { userId } = request.params as { userId: string };
      if (!userId) {
        return reply.status(400).send({ error: "Missing userId parameter" });
      }
  
      // 1) Retrieve the user data from the database.
      const userData = await getUserProfile(userId);
      if (!userData) {
        return reply.status(404).send({ error: "User not found" });
      }
  
      // 2) Check and update the user's streak if necessary.
      // TODO fix streak or remove for now
      const updatedUserData = await checkStreakOnLogin(userData);
  
      // The response object now might look like:
      // { id: "abc", streakCount: 0, streakLost: true, name: "Example User", ... }
      return reply.status(200).send({ user: updatedUserData });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return reply.status(500).send({ error: "Failed to fetch user profile" });
    }
  }

  export async function deleteUserController(request: FastifyRequest, reply: FastifyReply) {
    try {
      // The user object is set by your authenticateUser middleware
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized - no user data" });
      }
  
      // Delete the doc from Firestore (or any other store).
      await deleteFireStoreUser(user.uid);
  
      return reply.status(200).send({ message: `User doc ${user.uid} deleted.` });
    } catch (error) {
      console.error("Error deleting user:", error);
      return reply.status(500).send({ error: "Failed to delete user" });
    }
  }