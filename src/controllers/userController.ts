import { FastifyRequest, FastifyReply } from "fastify";
import { createFireStoreUser, deleteFireStoreUser, getUserProfile, updateFireStoreUser } from "../services/userService";
import { checkStreakOnLogin } from "../services/streakService";
import { updateFcmTokenForUser } from "../services/userService";
import { getUserVideos } from "../services/videoService";
import { getUsersSavedCoursesFromFirebase } from "../services/courseService";
import { getFriends } from "../services/friendService";

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
      const { email, name, profilePicture, timezone } = request.body as {
        email?: string;
        name?: string;
        profilePicture?: string;
        timezone?: string;
      };

      const uid = user.uid;
  
      await createFireStoreUser(uid, { email, name, profilePicture, timezone });
  
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

  export async function updateUserProfileController(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user || !user.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      // Extract the fields from the request body.
      // name, profilePicture, timezone, and hasCompletedOnboarding are allowed for updates.
      const { name, profilePicture, timezone, hasCompletedOnboarding } = request.body as {
        name?: string;
        profilePicture?: string;
        timezone?: string;
        hasCompletedOnboarding?: boolean;
      };
  
      // Validate that at least one field is provided.
      if (!name && !profilePicture && !timezone && hasCompletedOnboarding === undefined) {
        return reply.status(400).send({ error: "No update fields provided." });
      }
  
      // Update the Firestore user document using the service.
      await updateFireStoreUser(user.uid, { name, profilePicture, timezone, hasCompletedOnboarding });
  
      reply.code(200).send({ message: "User profile updated successfully." });
    } catch (error) {
      console.error("Error updating user profile:", error);
      reply.code(500).send({ error: "Failed to update user profile" });
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



export async function updateFcmTokenController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { fcmToken } = request.body as { fcmToken: string };
    if (!fcmToken) {
      return reply.status(400).send({ error: "Missing FCM token" });
    }

    await updateFcmTokenForUser(user.uid, fcmToken);
    reply.code(200).send({ message: "FCM token updated successfully." });
  } catch (error) {
    console.error("Error updating FCM token:", error);
    reply.code(500).send({ error: "Failed to update FCM token" });
  }
}

/** Any authenticated user may list another user’s ready posts; strangers see public only, friends also see `visibility: friends` (same rules as `canReadVideo`). */
export async function getUserVideosController(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { cursor?: string; limit?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const viewer = (request as any).user;
    if (!viewer?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { userId } = request.params;
    if (!userId) {
      return reply.status(400).send({ error: "Missing userId parameter" });
    }

    const { cursor, limit } = request.query;

    const result = await getUserVideos(userId, viewer.uid, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });

    return reply.status(200).send(result);
  } catch (error) {
    console.error("Error fetching user videos:", error);
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    const message = error instanceof Error ? error.message : "Failed to fetch user videos";
    return reply.status(statusCode).send({ error: message });
  }
}

/** Any authenticated user may list another user’s saved courses (same data as their profile). */
export async function getUserSavedCoursesController(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { page?: string; limit?: string; subject?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const viewer = (request as any).user;
    if (!viewer?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { userId } = request.params;
    if (!userId) {
      return reply.status(400).send({ error: "Missing userId parameter" });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return reply.status(404).send({ error: "User not found" });
    }

    const page = parseInt(request.query.page || "1", 10);
    const limit = parseInt(request.query.limit || "10", 10);
    const subject = request.query.subject;

    if (page < 1) {
      return reply.status(400).send({ error: "Page must be greater than 0" });
    }
    if (limit < 1 || limit > 100) {
      return reply.status(400).send({ error: "Limit must be between 1 and 100" });
    }

    const { courses, totalCount, hasNextPage } = await getUsersSavedCoursesFromFirebase(
      userId,
      page,
      limit,
      subject
    );

    return reply.status(200).send({
      message: "Courses retrieved successfully",
      courses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user saved courses:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

/** Any authenticated user may list another user’s friends (same contract as GET /friends for that user). */
export async function getUserFriendsController(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { order?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const viewer = (request as any).user;
    if (!viewer?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { userId } = request.params;
    if (!userId) {
      return reply.status(400).send({ error: "Missing userId parameter" });
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return reply.status(404).send({ error: "User not found" });
    }

    const { order } = request.query;
    const orderByXp = order === "xp";
    const friends = await getFriends(userId, orderByXp);
    return reply.status(200).send({ friends });
  } catch (error) {
    console.error("Error fetching user friends:", error);
    return reply.status(500).send({ error: "Failed to retrieve friends" });
  }
}
