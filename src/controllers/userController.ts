import { FastifyRequest, FastifyReply } from "fastify";
import { createFireStoreUser } from "../services/userService";

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
