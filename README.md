# 📖 Lumi Course API Documentation
This API allows users to create courses, retrieve their created courses, and fetch lessons from a specific course.

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
### ➡️ **POST `/courses`**
#### 📥 **Request (Multipart Form Data)**
| Field          | Type     | Required | Description |
|---------------|---------|----------|-------------|
| `title`       | String  | ✅ Yes   | The course title. |
| `description` | String  | ✅ Yes   | A short description of the course. |
| `files`       | File    | ❌ No    | PDF, image, or text files containing course content. |
| `content`     | String  | ❌ No    | Raw text content for the course at least one of files or content is required. |

#### 📤 **Response**
```json
{
  "message": "Course created successfully",
  "courseId": "abcd1234"
}
```

#### ⚠️ **Possible Errors**
| HTTP Code | Error Message |
|-----------|--------------|
| 400       | `"No valid text provided"` |
| 401       | `"Unauthorized"` |
| 500       | `"Internal Server Error"` |

---

## 📌 2. Get All Courses Created by the User
### ➡️ **GET `/courses`**
#### 📥 **Request (Headers)**
Requires Firebase Authentication.

#### 📤 **Response**
```json
{
  "message": "Courses retrieved successfully",
  "courses": [
    {
      "id": "course123",
      "title": "Learn Fastify",
      "description": "Master Fastify in just a few lessons!",
      "createdBy": "user123"
    },
    {
      "id": "course456",
      "title": "Intro to AI",
      "description": "Basics of AI and machine learning",
      "createdBy": "user123"
    }
  ]
}
```

#### ⚠️ **Possible Errors**
| HTTP Code | Error Message |
|-----------|--------------|
| 401       | `"Unauthorized"` |
| 500       | `"Internal Server Error"` |

---

## 📌 3. Get Lessons for a Specific Course
### ➡️ **GET `/courses/:courseId/lessons`**
#### 📥 **Request (Headers & Params)**
| Parameter  | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `courseId` | String | ✅ Yes  | The ID of the course. |

#### 📤 **Response**
```json
{
  "message": "Lessons retrieved successfully",
  "lessons": [
    {
      "id": "lesson123",
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
              "options": [
                        "progestogen",
                        "prokaryotic",
                        "protist",
                        "pyruvate",
                        "permeable",
                        "polypeptide",
                        "protein"
                    ],
                    "correctAnswer": "prokaryotic",
                    "lessonType": "fillInTheBlank"
                },
                {
                    "questionText": "The __________ of the cell is primarily responsible for energy production through cellular respiration.",
                    "options": [
                        "cytoplasm",
                        "nucleus",
                        "ribosome",
                        "mitochondria",
                        "cell membrane",
                        "endoplasmic reticulum",
                        "Golgi apparatus"
                    ],
                    "correctAnswer": "mitochondria",
                    "lessonType": "fillInTheBlank"
                },
            ]
    },
    {
      "id": "lesson456",
      "title": "Advanced Fastify",
      "flashcards": [
        { "term": "Middleware", "definition": "Functions that execute during request processing in Fastify" }
      ],
      "multipleChoice": [
        {
          "questionText": "What is the purpose of middleware?",
          "options": ["Styling", "Data Fetching", "Handling Requests"],
          "correctAnswer": "Handling Requests"
        }
      ]
    }
  ]
}
```

#### ⚠️ **Possible Errors**
| HTTP Code | Error Message |
|-----------|--------------|
| 400       | `"Missing courseId parameter"` |
| 401       | `"Unauthorized"` |
| 404       | `"No lessons found for this course"` |
| 500       | `"Internal Server Error"` |

---

## 📌 Summary of Available Routes
| Method | Endpoint | Description | Requires Auth |
|--------|----------|-------------|--------------|
| **POST** | `/courses` | Create a new course | ✅ Yes |
| **GET** | `/courses` | Get all courses created by the user | ✅ Yes |
| **GET** | `/courses/:courseId/lessons` | Get all lessons from a specific course | ✅ Yes |

---
