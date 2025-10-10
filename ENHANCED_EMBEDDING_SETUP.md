# Enhanced Embedding with File and Slide/Page Metadata

## Overview
The enhanced embedding system now processes different file types with specific metadata tracking:
- **PDF files**: Chunked by page with page number metadata
- **PPTX files**: Chunked by slide with slide number metadata  
- **DOCX/Text files**: Chunked using existing semantic chunking with chunk index metadata

## How It Works

### 1. File Type Detection and Processing

#### PDF Files (`application/pdf`)
- Extracts text page by page using `pdf-parse`
- Each page is further chunked using semantic chunking
- Metadata includes: `pageNumber`, `chunkIndex`, `originalName`

#### PPTX Files (`application/vnd.openxmlformats-officedocument.presentationml.presentation`)
- Extracts text using `officeparser`
- Attempts to detect slide boundaries using multiple patterns:
  - Slide/Page number indicators
  - Multiple newlines
  - All-caps titles (common slide title pattern)
- Each slide is further chunked using semantic chunking
- Metadata includes: `slideNumber`, `chunkIndex`, `originalName`

#### DOCX/Text Files
- Uses existing semantic chunking logic
- Metadata includes: `chunkIndex`, `originalName`

### 2. Enhanced Metadata Storage

Each chunk in Qdrant now includes:
```typescript
{
  text: string;
  idx: number;
  fileIndex: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  slideNumber?: number;    // For PPTX files
  pageNumber?: number;     // For PDF files
  chunkIndex?: number;     // For all files
}
```

### 3. Enhanced RAG Responses

The RAG service now returns sources with detailed file information:

```typescript
interface RetrievedChunk {
  text: string;
  score: number;
  fileIndex?: number;
  fileName?: string;
  originalName?: string;
  mimeType?: string;
  slideNumber?: number;
  pageNumber?: number;
  chunkIndex?: number;
}
```

### 4. Source Attribution in Responses

When the RAG service returns sources, they now include:
- **PDF**: "Source 1 (document.pdf - Page 3)"
- **PPTX**: "Source 2 (presentation.pptx - Slide 5)"
- **Text/DOCX**: "Source 3 (document.docx - Chunk 2)"

## API Changes

### Course Creation
The course creation endpoint now processes files with enhanced metadata:
- Files are processed individually with type-specific logic
- Metadata is stored in both Qdrant and Firestore
- Backward compatibility maintained for existing text-only content

### RAG Endpoints
RAG responses now include enhanced source information:
- File names and types
- Slide/page numbers for presentations/documents
- Chunk indices for text documents

## Example Usage

### Creating a course with mixed file types:
```javascript
const formData = new FormData();
formData.append('title', 'Mixed Content Course');
formData.append('description', 'Course with PDF, PPTX, and text');
formData.append('files', pdfFile);    // Will be chunked by page
formData.append('files', pptxFile);   // Will be chunked by slide
formData.append('files', docxFile);   // Will use semantic chunking
```

### RAG Response Example:
```json
{
  "answer": "Based on the course materials...",
  "sources": [
    {
      "text": "The key concept is...",
      "score": 0.95,
      "originalName": "lecture.pdf",
      "pageNumber": 3,
      "chunkIndex": 1
    },
    {
      "text": "As shown in the diagram...",
      "score": 0.87,
      "originalName": "presentation.pptx", 
      "slideNumber": 5,
      "chunkIndex": 2
    }
  ]
}
```

## Benefits

1. **Precise Source Attribution**: Users can identify exactly which document and slide/page contains the information
2. **Better Context**: Slide/page numbers provide better context for the source material
3. **Improved User Experience**: More specific source references help users navigate course materials
4. **Maintained Performance**: Enhanced metadata doesn't impact embedding or retrieval performance

## Technical Implementation

### Key Files Modified:
- `src/services/enhancedEmbedAndChunk.ts` - New enhanced embedding service
- `src/services/ragService.ts` - Updated to return enhanced metadata
- `src/controllers/courseController.ts` - Updated to use enhanced embedding
- `src/services/embedAndChunk.ts` - Maintained for backward compatibility

### Backward Compatibility:
- Existing courses continue to work without changes
- Text-only content uses the same chunking logic as before
- API responses maintain the same structure with additional metadata
