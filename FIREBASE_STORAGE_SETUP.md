# Firebase Storage Integration for Course Files

## Overview
This implementation adds Firebase Storage functionality to save uploaded files when creating courses. Files are stored in the Firebase Storage bucket and their metadata is saved in the course document.

## Environment Variables Required
Make sure you have the following environment variables set:

```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...} # Your Firebase service account JSON
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

## How It Works

### 1. File Upload Process
When a course is created via `POST /courses`:
1. Files are uploaded to Firebase Storage in the `courses/` folder
2. Each file gets a unique filename using `nanoid()`
3. File metadata is stored in the course document
4. Files are made publicly accessible (configurable)

### 2. File Storage Structure
```
Firebase Storage:
└── courses/
    ├── {unique-id-1}.pdf
    ├── {unique-id-2}.docx
    └── {unique-id-3}.jpg

Firestore:
└── courses/
    └── {courseId}/
        ├── title: string
        ├── description: string
        ├── createdBy: string
        ├── uploadedFiles: UploadedFile[]
        └── lessons/
```

### 3. UploadedFile Interface
```typescript
interface UploadedFile {
  originalName: string;    // Original filename
  fileName: string;        // Firebase Storage filename
  fileUrl: string;         // Public URL
  mimeType: string;        // File MIME type
  size: number;           // File size in bytes
}
```

## API Endpoints

### Create Course with Files
**POST** `/courses`
- Uploads files to Firebase Storage
- Returns course data including uploaded files info

### Get Course Files
**GET** `/courses/:courseId/files`
- Retrieves metadata for all files uploaded to a course
- Returns array of `UploadedFile` objects

## Error Handling
- File upload failures don't prevent course creation
- Upload errors are logged but processing continues
- Course creation succeeds even if file uploads fail

## Security Considerations
- Files are made publicly accessible by default
- Consider implementing access control if needed
- File size limits should be configured in Firebase Storage rules

## Usage Example

### Creating a course with files:
```javascript
const formData = new FormData();
formData.append('title', 'My Course');
formData.append('description', 'Course description');
formData.append('files', file1);
formData.append('files', file2);

const response = await fetch('/courses', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + firebaseIdToken
  },
  body: formData
});

const result = await response.json();
// result.uploadedFiles contains file metadata
```

### Retrieving course files:
```javascript
const response = await fetch(`/courses/${courseId}/files`, {
  headers: {
    'Authorization': 'Bearer ' + firebaseIdToken
  }
});

const result = await response.json();
// result.uploadedFiles contains all file metadata
```
