import { db } from "../config/firebaseConfig";

// Service that queries Firestore for users matching the given string.
// Uses lowercased fields for case-insensitive prefix matches.
export async function searchUsers(query: string): Promise<any[]> {
  try {
    const usersRef = db.collection("users");
    const lowerQuery = query.toLowerCase(); 

    // Query to match the beginning of "nameLower"
    const nameQuery = usersRef
      .orderBy("nameLower")
      .startAt(lowerQuery)
      .endAt(lowerQuery + "\uf8ff");

    // Query to match the beginning of "emailLower"
    const emailQuery = usersRef
      .orderBy("emailLower")
      .startAt(lowerQuery)
      .endAt(lowerQuery + "\uf8ff");

    // Run both queries concurrently.
    const [nameSnapshot, emailSnapshot] = await Promise.all([
      nameQuery.get(),
      emailQuery.get(),
    ]);

    // Combine documents in a Map to avoid duplicates
    const usersMap = new Map<string, any>();

    nameSnapshot.forEach((doc) =>
      usersMap.set(doc.id, { id: doc.id, ...doc.data() })
    );
    emailSnapshot.forEach((doc) =>
      usersMap.set(doc.id, { id: doc.id, ...doc.data() })
    );

    return Array.from(usersMap.values());
  } catch (error) {
    console.error("Error searching users:", error);
    throw error;
  }
}

interface FriendRequestInput {
  userIds: string[];
  senderId: string;
  status: string;
}

export async function createFriendRequest(senderId: string, recipientId: string): Promise<any> {
  try {
    const friendRequest = {
      userIds: [senderId, recipientId],
      senderId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Store the friend request in the "friendRequests" collection.
    const friendRequestRef = await db.collection("friendRequests").add(friendRequest);
    console.log(`Friend request created with id: ${friendRequestRef.id}`);
    return { id: friendRequestRef.id, ...friendRequest };
  } catch (error) {
    console.error("Error saving friend request:", error);
    throw error;
  }
}

export async function getFriendRequests(userId: string): Promise<{ sent: any[]; received: any[] }> {
  try {
    const friendRequestsRef = db.collection("friendRequests");

    // Query for sent friend requests.
    const sentSnapshot = await friendRequestsRef.where("senderId", "==", userId).get();

    // Query for friend requests where the current user is included in the userIds array.
    const receivedSnapshot = await friendRequestsRef.where("userIds", "array-contains", userId).get();

    const sentRequests: any[] = [];
    sentSnapshot.forEach((doc) => {
      sentRequests.push({ id: doc.id, ...doc.data() });
    });

    const receivedRequests: any[] = [];
    receivedSnapshot.forEach((doc) => {
      const data = doc.data();
      // Exclude requests sent by the current user (as these are already in sentRequests)
      if (data.senderId !== userId) {
        receivedRequests.push({ id: doc.id, ...data });
      }
    });

    return { sent: sentRequests, received: receivedRequests };
  } catch (error) {
    console.error("Error retrieving friend requests:", error);
    throw error;
  }
}

// Responds to a friend request.
// If "accept" is true, updates the status to "accepted" and sets an optional "acceptedAt" timestamp.
// If "accept" is false, deletes the friend request.
export async function respondFriendRequest(requestId: string, accept: boolean, userId: string): Promise<any> {
  try {
    const friendRequestRef = db.collection("friendRequests").doc(requestId);
    const doc = await friendRequestRef.get();
    if (!doc.exists) {
      throw new Error("Friend request not found");
    }
    const data = doc.data();
    if (!data) {
      throw new Error("Friend request data is undefined");
    }

    // Verify the current user is a participant in the friend request.
    if (!data.userIds.includes(userId)) {
      throw new Error("Unauthorized: You are not a participant in this friend request");
    }
    
    if (accept) {
      // Update the friend request status to "accepted".
      await friendRequestRef.update({
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });
      const updatedDoc = await friendRequestRef.get();
      return { message: "Friend request accepted", friendRequest: { id: updatedDoc.id, ...updatedDoc.data() } };
    } else {
      // Delete the friend request to decline/cancel it.
      await friendRequestRef.delete();
      return { message: "Friend request declined/cancelled and removed" };
    }
  } catch (error) {
    console.error("Error responding to friend request:", error);
    throw error;
  }
}

interface Friend {
  id: string;
  xpCount?: number; // optional, default to 0 when sorting if missing
  [key: string]: any; // include any other fields from the document
}

// Retrieves a list of friend user information for the given user.
// It queries accepted friend requests where the current user is in "userIds",
// extracts the other user's id, then fetches full user information.
// If orderByXp is true, the results are sorted in descending order of xpCount.
export async function getFriends(userId: string, orderByXp?: boolean): Promise<Friend[]> {
  try {
    const friendRequestsRef = db.collection("friendRequests");
    
    // Query accepted friend requests that include the current user.
    const snapshot = await friendRequestsRef
      .where("userIds", "array-contains", userId)
      .where("status", "==", "accepted")
      .get();

    const friendIds: string[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userIds && Array.isArray(data.userIds) && data.userIds.length === 2) {
        // Determine the friend id: the id that is not equal to the current user's id.
        const friendId = data.userIds.find((id: string) => id !== userId);
        if (friendId) {
          friendIds.push(friendId);
        }
      }
    });

    // Retrieve full user information for each friend ID.
    const friendsInfo = await Promise.all(
      friendIds.map(async (friendId) => {
        const userDoc = await db.collection("users").doc(friendId).get();
        if (!userDoc.exists) {
          return null;
        }
        return { id: userDoc.id, ...userDoc.data() } as Friend;
      })
    );

    // Filter out any null results.
    const friends = friendsInfo.filter((friend): friend is Friend => friend !== null);

    // Optionally sort friends by xpCount in descending order.
    if (orderByXp) {
      friends.sort((a, b) => (b.xpCount || 0) - (a.xpCount || 0));
    }

    return friends;
  } catch (error) {
    console.error("Error getting friends:", error);
    throw error;
  }
}