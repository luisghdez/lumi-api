import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";

dotenv.config(); // Load .env variables

if (!admin.apps.length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable");
    }

    // Parse JSON and fix private_key formatting
    const serviceAccount = JSON.parse(serviceAccountKey);
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n"); // Restore newlines

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    console.log("✅ Firebase Admin SDK initialized successfully!");
  } catch (error) {
    console.error("🔥 Firebase initialization error:", error);
    process.exit(1); // Stop server if Firebase fails to initialize
  }
}

// Firestore & Auth Instances
// TODO: switch to production db
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

export { admin, db, auth, storage };
