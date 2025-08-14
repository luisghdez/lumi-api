import { storage } from "../config/firebaseConfig";
import { nanoid } from "nanoid";

export interface UploadedFile {
  originalName: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

export const uploadFileToFirebaseStorage = async (
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string = "courses"
): Promise<UploadedFile> => {
  try {
    const bucket = storage.bucket();
    
    // Generate unique filename
    const fileExtension = originalName.split('.').pop() || '';
    const uniqueFileName = `${folder}/${nanoid()}.${fileExtension}`;
    
    // Create file reference
    const file = bucket.file(uniqueFileName);
    
    // Upload file
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          originalName: originalName,
          uploadedAt: new Date().toISOString(),
        }
      }
    });
    
    // Make file publicly accessible (optional - you might want to control access)
    await file.makePublic();
    
    // Get public URL
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
    
    return {
      originalName,
      fileName: uniqueFileName,
      fileUrl,
      mimeType,
      size: fileBuffer.length
    };
    
  } catch (error) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const deleteFileFromFirebaseStorage = async (fileName: string): Promise<void> => {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    
    await file.delete();
    console.log(`File ${fileName} deleted successfully`);
    
  } catch (error) {
    console.error("Error deleting file from Firebase Storage:", error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getFileUrl = (fileName: string): string => {
  const bucket = storage.bucket();
  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
};
