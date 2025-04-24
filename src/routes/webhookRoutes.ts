// import { FastifyInstance } from "fastify";
// import { deleteUserController, ensureUserExistsController, getUserProfileController, updateUserProfileController } from "../controllers/userController";
// import { authenticateUser } from "../middleware/authUser";
// import { applyReferralCodeController } from "../controllers/userController";


// fastify.post('/webhooks/revenuecat', async (req, res) => {
//     try {
//       const { event } = req.body;
  
//       const uid = event?.app_user_id;
//       const productId = event?.product_id;
//       const purchasedAt = event?.purchased_at;
  
//       if (!uid || !productId) {
//         return res.status(400).send({ error: 'Missing fields' });
//       }
  
//       const userDoc = await db.collection("users").doc(uid).get();
//       if (!userDoc.exists) {
//         return res.status(404).send({ error: 'User not found' });
//       }
  
//       const userData = userDoc.data();
//       const referrerCode = userData?.referrerCode || null;
  
//       // Save to a "referrals" or "purchases" collection
//       await db.collection("referrals").add({
//         uid,
//         referrerCode,
//         productId,
//         purchasedAt: purchasedAt || new Date().toISOString(),
//         revenueCatEvent: event.name,
//       });
  
//       return res.send({ message: 'Purchase tracked' });
//     } catch (error) {
//       console.error("🔥 RevenueCat webhook error:", error);
//       return res.status(500).send({ error: 'Webhook failed' });
//     }
//   });
  






//   Great — let’s get you straight to the right spot.

// ---

// ## 🔗 How to Access Your RevenueCat Dashboard:

// 1. **Go to** [https://app.revenuecat.com](https://app.revenuecat.com)
// 2. **Log in** with your RevenueCat account
//    - If you haven’t created a project yet, it’ll prompt you to set one up.

// ---

// ## 🛠 Once You’re In the Dashboard:

// To find **Webhooks**:

// 1. In the **left-hand menu**, scroll down to **"Integrations"**
// 2. Click on **"Webhooks"**
// 3. Click **"New Webhook"**
// 4. Enter your backend URL:
//    ```
//    https://your-api.com/webhooks/revenuecat
//    ```
// 5. Choose events to listen for:
//    - ✅ `INITIAL_PURCHASE`
//    - ✅ `RENEWAL`
//    - ✅ `CANCELLATION` *(optional, for full analytics)*

// ---

// ## 🧠 Need to Know:

// - Make sure `app_user_id` in RevenueCat matches your **Firebase UID**
//   → You can set this when initializing the SDK in your app:
//   ```ts
//   Purchases.configure({ apiKey: "your_rc_key", appUserID: firebaseUid });
//   ```

// Want help checking that your app is using the correct `appUserID`, or confirming that webhook events are being sent properly?