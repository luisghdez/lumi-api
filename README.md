# 📖 Lumi API Documentation
This API allows users to create courses, retrieve their created courses, fetch lessons from a specific course, and manage friend requests.

---

## 🔐 Authentication
All routes require authentication via a Firebase ID token in the **Authorization** header.

```
Authorization: Bearer <Firebase-ID-Token>
```

If authentication is missing or invalid, the API will return:
```json
{
  "error": "Unauthorized"
}
```

---

## 📌 1. Create a New Course
### ➡️ POST `/courses`
#### 📥 Request (Multipart Form Data)
| Field          | Type     | Required | Description |
|---------------|----------|----------|-------------|
| `title`       | String   | ✅ Yes   | The course title. |
| `description` | String   | ✅ Yes   | A short description of the course. |
| `files`       | File     | ❌ No    | PDF, image, or text files containing course content. |
| `content`     | String   | ❌ No    | Raw text content for the course; at least one of files or content is required. |

#### 📤 Response
```json
{
  "message": "Course created successfully",
  "courseId": "courseId123"
}
```

#### ⚠️ Possible Errors
| HTTP Code | Error Message |
|-----------|----------------|
| 400       | "No valid text provided" |
| 401       | "Unauthorized" |
| 500       | "Internal Server Error" |

---

## 📌 2. Get All Courses Created by the User
### ➡️ GET `/courses`
#### 📥 Request (Headers)
Requires Firebase Authentication.

#### 📤 Response
```json
{
  "message": "Courses retrieved successfully",
  "courses": [
    {
      "id": "courseId123",
      "title": "Learn Fastify",
      "description": "Master Fastify in just a few lessons!",
      "createdBy": "userId123"
    },
    {
      "id": "courseId456",
      "title": "Intro to AI",
      "description": "Basics of AI and machine learning",
      "createdBy": "userId123"
    }
  ]
}
```

#### ⚠️ Possible Errors
| HTTP Code | Error Message |
|-----------|----------------|
| 401       | "Unauthorized" |
| 500       | "Internal Server Error" |

---

## 📌 3. Get Lessons for a Specific Course
### ➡️ GET `/courses/:courseId/lessons`
#### 📥 Request (Headers & Params)
| Parameter  | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `courseId` | String | ✅ Yes  | The ID of the course. |

#### 📤 Response
```json
{
  "message": "Lessons retrieved successfully",
  "lessons": [
    {
      "id": "lessonId123",
      "title": "Introduction to Fastify",
      "flashcards": [
        { "term": "Fastify", "definition": "A fast backend framework for Node.js" }
      ],
      "multipleChoice": [
        {
          "questionText": "What is Fastify used for?",
          "options": ["Frontend", "Database", "Backend"],
          "correctAnswer": "Backend"
        }
      ],
      "fillInTheBlank": [
        {
          "questionText": "Cells come in various forms including __________ and eukaryotic.",
          "options": ["progestogen", "prokaryotic", "protist", "pyruvate", "permeable", "polypeptide", "protein"],
          "correctAnswer": "prokaryotic",
          "lessonType": "fillInTheBlank"
        },
        {
          "questionText": "The __________ of the cell is primarily responsible for energy production through cellular respiration.",
          "options": ["cytoplasm", "nucleus", "ribosome", "mitochondria", "cell membrane", "endoplasmic reticulum", "Golgi apparatus"],
          "correctAnswer": "mitochondria",
          "lessonType": "fillInTheBlank"
        }
      ]
    }
  ]
}
```

#### ⚠️ Possible Errors
| HTTP Code | Error Message |
|-----------|----------------|
| 400       | "Missing courseId parameter" |
| 401       | "Unauthorized" |
| 404       | "No lessons found for this course" |
| 500       | "Internal Server Error" |

---

## 📌 4. Friend Request System

### ➡️ GET `/friend-requests/search?q={string}`
Search for users by name or email.

#### 📤 Response
```json
{
  "users": [
    {
      "id": "userId123",
      "email": "user@example.com",
      "name": "Example User",
      "profilePicture": "default",
      "xpCount": 0,
      "streakCount": 0,
      "createdAt": "2025-03-08T16:53:55.180Z",
      "nameLower": "example user",
      "emailLower": "user@example.com"
    }
  ]
}
```

### ➡️ POST `/friend-requests`
Send a friend request.

#### 📥 Request Body
```json
{
  "recipientId": "recipient-user-id"
}
```

#### 📤 Response
```json
{
  "friendRequest": {
    "id": "requestId123",
    "userIds": [
      "senderId123",
      "recipientId456"
    ],
    "senderId": "senderId123",
    "status": "pending",
    "createdAt": "2025-03-16T20:26:31.996Z"
  }
}
```

### ➡️ GET `/friend-requests`
Retrieve sent and received friend requests.

#### 📤 Response
```json
{
  "sent": [
    {
      "id": "requestId123",
      "userIds": [
        "senderId123",
        "recipientId456"
      ],
      "senderId": "senderId123",
      "status": "pending",
      "createdAt": "2025-03-16T20:26:31.996Z"
    }
  ],
  "received": []
}
```

### ➡️ PATCH `/friend-requests/:id`
Accept a friend request.

#### 📤 Response
```json
{
  "message": "Friend request accepted",
  "friendRequest": {
    "id": "requestId123",
    "userIds": [
      "senderId123",
      "recipientId456"
    ],
    "senderId": "senderId123",
    "createdAt": "2025-03-16T20:26:31.996Z",
    "acceptedAt": "2025-03-16T20:38:41.529Z",
    "status": "accepted"
  }
}
```

### ➡️ GET `/friends?order=xp`
Retrieve friends list, optionally ordered by XP.

#### 📤 Response
```json
{
  "friends": [
    {
      "id": "userId123",
      "email": "user@example.com",
      "name": "Example User",
      "profilePicture": "default",
      "xpCount": 0,
      "streakCount": 0,
      "createdAt": "2025-03-08T16:53:55.180Z",
      "nameLower": "example user",
      "emailLower": "user@example.com"
    }
  ]
}
```

### ➡️ GET `/users/:userId`
Fetch a user by ID.

#### 📤 Response
```json
{
  "user": {
    "id": "userId123",
    "email": "user@example.com",
    "name": "Example User",
    "profilePicture": "default",
    "xpCount": 0,
    "streakCount": 0,
    "createdAt": "2025-03-08T16:53:55.180Z",
    "nameLower": "example user",
    "emailLower": "user@example.com"
  }
}
```

---

## 📌 5. Short Video Feed

All video routes require Firebase authentication. Videos use a direct-to-Firebase Storage flow: create metadata first, upload the binary to the returned signed URL, then mark the upload complete.

### ➡️ POST `/videos`
Create a video document and receive a signed upload URL.

#### 📥 Request
```json
{
  "caption": "Study tip in 30 seconds",
  "mimeType": "video/mp4",
  "visibility": "public"
}
```

#### 📤 Response
```json
{
  "video": {
    "id": "videoId123",
    "caption": "Study tip in 30 seconds",
    "status": "uploading",
    "visibility": "public",
    "likeCount": 0,
    "commentCount": 0,
    "playbackUrl": null
  },
  "upload": {
    "uploadUrl": "https://storage.googleapis.com/...",
    "storagePath": "videos/userId123/videoId123/original.mp4",
    "expiresAt": "2026-04-29T01:00:00.000Z"
  }
}
```

Upload the video file with `PUT` to `upload.uploadUrl` using the same `Content-Type` as `mimeType`.

### ➡️ PATCH `/videos/:videoId/complete`
Mark an uploaded video as ready after the Storage upload finishes.

#### 📥 Request
```json
{
  "durationMs": 18000,
  "thumbnailUrl": "https://example.com/thumb.jpg"
}
```

### ➡️ GET `/videos/feed?cursor=&limit=`
Retrieve public ready videos ordered by newest first.

#### 📤 Response
```json
{
  "videos": [
    {
      "id": "videoId123",
      "ownerId": "userId123",
      "caption": "Study tip in 30 seconds",
      "playbackUrl": "https://storage.googleapis.com/...",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "likeCount": 4,
      "commentCount": 2,
      "likedByMe": false,
      "createdAt": "2026-04-29T01:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### ➡️ GET `/videos/:videoId`
Fetch a single video, including a short-lived playback URL and `likedByMe`.

### ➡️ DELETE `/videos/:videoId`
Delete a video owned by the authenticated user.

### ➡️ POST `/videos/:videoId/like`
Like a video. Safe to call multiple times.

### ➡️ DELETE `/videos/:videoId/like`
Unlike a video. Safe to call multiple times.

### ➡️ GET `/videos/:videoId/comments?cursor=&limit=`
Retrieve paginated comments for a video.

### ➡️ POST `/videos/:videoId/comments`
Create a comment.

#### 📥 Request
```json
{
  "text": "This helped a lot!"
}
```

### ➡️ DELETE `/videos/:videoId/comments/:commentId`
Delete a comment when the authenticated user is the comment author or video owner.

---


---

## 📌 6. Submit Review for AI Feedback
### ➡️ POST `/review`
Process user explanation of terms and get guided AI feedback.

#### 📥 Request (JSON)
```json
{
  "transcript": "My explanation of osmosis and mitosis...",
  "terms": [
    { "term": "osmosis", "status": "unattempted" },
    { "term": "mitosis", "status": "needs_improvement" },
    { "term": "photosynthesis", "status": "unattempted" }
  ],
  "attemptNumber": 1
}
```

#### 📤 Response
```json
{
  "sessionId": "abc123-session-id",
  "updatedTerms": [
    { "term": "osmosis", "status": "mastered" },
    { "term": "mitosis", "status": "needs_improvement" },
    { "term": "photosynthesis", "status": "unattempted" }
  ],
  "feedbackMessage": "Great job! You explained osmosis and mitosis well..."
}
```

---

## 📌 7. Get AI Feedback Audio
### ➡️ GET `/review/audio?sessionId=abc123-session-id`
Retrieve the TTS audio for the AI feedback associated with a previous review session.

#### 📤 Response
- Returns an `audio/mpeg` file (MP3).
- Can be streamed or downloaded by the client.

#### ⚠️ Possible Errors
| HTTP Code | Error Message |
|-----------|----------------|
| 400       | "Missing sessionId parameter" |
| 404       | "Audio not found or expired." |

---

## 📌 Summary of Available Routes
| Method | Endpoint | Description | Requires Auth |
|--------|-----------------------------|-------------------------------|----------------|
| POST   | `/courses` | Create a new course | ✅ Yes |
| GET    | `/courses` | Get all courses created by the user | ✅ Yes |
| GET    | `/courses/:courseId/lessons` | Get all lessons from a specific course | ✅ Yes |
| GET    | `/friend-requests/search?q=` | Search users by name/email | ✅ Yes |
| POST   | `/friend-requests` | Send a friend request | ✅ Yes |
| GET    | `/friend-requests` | Get sent and received friend requests | ✅ Yes |
| PATCH  | `/friend-requests/:id` | Accept a friend request | ✅ Yes |
| GET    | `/friends` | Get list of friends | ✅ Yes |
| GET    | `/users/:userId` | Get user profile by ID | ✅ Yes |
| POST   | `/videos` | Create video metadata and signed upload URL | ✅ Yes |
| PATCH  | `/videos/:videoId/complete` | Mark an uploaded video as ready | ✅ Yes |
| GET    | `/videos/feed` | Get public video feed | ✅ Yes |
| GET    | `/videos/:videoId` | Get a video by ID | ✅ Yes |
| DELETE | `/videos/:videoId` | Delete an owned video | ✅ Yes |
| POST   | `/videos/:videoId/like` | Like a video | ✅ Yes |
| DELETE | `/videos/:videoId/like` | Unlike a video | ✅ Yes |
| GET    | `/videos/:videoId/comments` | Get video comments | ✅ Yes |
| POST   | `/videos/:videoId/comments` | Create a video comment | ✅ Yes |
| DELETE | `/videos/:videoId/comments/:commentId` | Delete a video comment | ✅ Yes |
| POST   | `/review`                            | Submit transcript for review + feedback     | ✅ Yes |
| GET    | `/review/audio?sessionId=...`        | Retrieve audio feedback (MP3)               | ✅ Yes |
