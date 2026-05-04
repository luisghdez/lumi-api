import { storage } from "../config/firebaseConfig";

export interface UploadedFile {
  originalName: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  publicUrl: string;
}

export const uploadFileToFirebaseStorage = async (
  fileBuffer: Buffer,
  fileId: string,
  originalName: string,
  mimeType: string,
  folder: string = "courses"
): Promise<UploadedFile> => {
  try {
    const bucket = storage.bucket();

    // Sanitize file ID to avoid path errors
    const safeId = fileId.replace(/[^\w.-]/g, "_");
    const fileExtension = originalName.split(".").pop() || "mp3";
    const uniqueFileName = `${folder}/${safeId}.${fileExtension}`;

    // Create file reference
    const file = bucket.file(uniqueFileName);

    // Upload file
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          originalName,
          uploadedAt: new Date().toISOString(),
        },
      },
      resumable: false,
    });

    // Make public
    await file.makePublic();

    // Generate public URL
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

    return {
      originalName,
      fileName: uniqueFileName,
      fileUrl,
      mimeType,
      size: fileBuffer.length,
      publicUrl: fileUrl,
    };
  } catch (error) {
    console.error("❌ Error uploading file to Firebase Storage:", error);
    throw new Error(
      `Failed to upload file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

export const deleteFileFromFirebaseStorage = async (
  fileName: string
): Promise<void> => {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.delete();
    console.log(`🗑️ File ${fileName} deleted successfully`);
  } catch (error) {
    console.error("❌ Error deleting file from Firebase Storage:", error);
    throw new Error(
      `Failed to delete file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

export const getFileUrl = (fileName: string): string => {
  const bucket = storage.bucket();
  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
};
