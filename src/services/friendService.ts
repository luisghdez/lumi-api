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
