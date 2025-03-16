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
