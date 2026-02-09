import { useState } from 'react';
import { api } from '@/lib/api';

interface FileUploadResult {
  fileId: string;
  filename: string;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<FileUploadResult> => {
    setIsUploading(true);
    setError(null);

    try {
      // 1. Get presigned URL
      const presignResponse = await api.post<{ uploadUrl: string; fileId: string; key: string }>('/files/presign', {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      const { uploadUrl, fileId } = presignResponse;

      // 2. Upload file to MinIO/S3 using the presigned URL
      // Note: We use fetch here because axios/api client might add headers (like Authorization) 
      // which could conflict with the presigned URL signature.
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // 3. Confirm upload
      await api.post(`/files/${fileId}/confirm`, {});

      return { fileId, filename: file.name };
    } catch (err) {
      console.error('File upload error:', err);
      setError('ファイルのアップロードに失敗しました');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, error };
}
