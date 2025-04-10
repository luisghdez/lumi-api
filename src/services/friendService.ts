import { admin, db } from "../config/firebaseConfig";

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
    const usersCollection = db.collection("users");

    // Query for sent friend request we can remove if needed, removed from fronteddsss
    const sentSnapshot = await friendRequestsRef.where("senderId", "==", userId).get();

    const receivedSnapshot = await friendRequestsRef
    .where("userIds", "array-contains", userId)
    .where("status", "==", "pending")
    .get();
  
    const sentRequests: any[] = [];
    for (const doc of sentSnapshot.docs) {
      const data = doc.data();
      const recipientId = data.userIds.find((id: string) => id !== userId);
      let recipientData = null;

      if (recipientId) {
        const recipientSnap = await usersCollection.doc(recipientId).get();
        if (recipientSnap.exists) {
          recipientData = recipientSnap.data();
        }
      }

      sentRequests.push({
        id: doc.id,
        ...data,
        name: recipientData?.name ?? null,
        email: recipientData?.email ?? null,
        avatarUrl: recipientData?.avatarUrl ?? null,
      });
    }

    const receivedRequests: any[] = [];
    for (const doc of receivedSnapshot.docs) {
      const data = doc.data();
      
      // Exclude requests sent by the current user
      if (data.senderId !== userId) {
        const senderSnap = await usersCollection.doc(data.senderId).get();
        let senderData = null;

        if (senderSnap.exists) {
          senderData = senderSnap.data();
        }

        receivedRequests.push({
          id: doc.id,
          ...data,
          name: senderData?.name ?? null,
          email: senderData?.email ?? null,
          avatarUrl: senderData?.avatarUrl ?? null,
        });
      }
    }

    return { sent: sentRequests, received: receivedRequests };
  } catch (error) {
    console.error("Error retrieving friend requests:", error);
    throw error;
  }
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
  userId: string
): Promise<any> {
  const friendRequestRef = db.collection("friendRequests").doc(requestId);

  try {
    const doc = await friendRequestRef.get();

    if (!doc.exists) throw new Error("Friend request not found");
    const data = doc.data();
    if (!data) throw new Error("Friend request data is undefined");

    const userIds: string[] = data.userIds;
    if (!userIds.includes(userId)) {
      throw new Error("Unauthorized: You are not a participant in this friend request");
    }

    if (accept) {
      // Start a Firestore transaction
      await db.runTransaction(async (transaction) => {
        // Update friend request
        transaction.update(friendRequestRef, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
        });

        // Increment friend count for both users
        const userRefs = userIds.map((id) => db.collection("users").doc(id));

        userRefs.forEach((ref) => {
          transaction.update(ref, {
            friendCount: admin.firestore.FieldValue.increment(1),
          });
        });
      });

      const updatedDoc = await friendRequestRef.get();
      return {
        message: "Friend request accepted",
        friendRequest: { id: updatedDoc.id, ...updatedDoc.data() },
      };
    } else {
      // Decline or cancel
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