import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fileUploadService, FileUploadResult } from '@/services/fileUpload';
import { FileAttachment, FileUploadState } from '@/types';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

export interface FileProcessingStats {
  total: number;
  images: number;
  documents: number;
  unsupported: number;
  totalSize: number;
  canProcessAll: boolean;
  processingWarnings: string[];
}

export interface UseFileUploadReturn {
  // State
  uploadState: FileUploadState;
  isUploading: boolean;
  error: string | null;
  
  // Actions
  selectFiles: (files: FileList) => void;
  uploadFiles: (conversationId?: string) => Promise<FileAttachment[]>;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  clearError: () => void;
  
  // Utilities
  validateFile: (file: File) => boolean;
  formatFileSize: (bytes: number) => string;
  getFileProcessingStats: () => FileProcessingStats;
  canProcessForOpenAI: (file: File) => boolean;
  getFileProcessingInfo: (file: File) => string;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const { user } = useAuth();
  
  const [uploadState, setUploadState] = useState<FileUploadState>({
    files: [],
    uploading: false,
    uploadProgress: {},
    error: null
  });
  
  const [error, setError] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setUploadState(prev => ({ ...prev, error: null }));
  }, []);

  // Validate a single file
  const validateFile = useCallback((file: File): boolean => {
    const validation = fileUploadService.validateFile(file);
    if (!validation.isValid) {
      setError(validation.error || ERROR_MESSAGES.FILE_TYPE_NOT_ALLOWED);
      return false;
    }
    return true;
  }, []);

  // Check if file can be processed by OpenAI
  const canProcessForOpenAI = useCallback((file: File): boolean => {
    return fileUploadService.canProcessForOpenAI(file);
  }, []);

  // Get file processing information
  const getFileProcessingInfo = useCallback((file: File): string => {
    const info = fileUploadService.getFileProcessingInfo(file);
    
    if (!info.canProcessForOpenAI) {
      return 'Cannot be processed by AI';
    }
    
    if (info.fileType === 'image') {
      return 'Will be processed as image (vision)';
    } else if (info.fileType === 'document') {
      return 'Will be processed as document (text search)';
    }
    
    return 'Supported file';
  }, []);

  // Get processing stats for all selected files
  const getFileProcessingStats = useCallback((): FileProcessingStats => {
    const stats = fileUploadService.getFileStats(uploadState.files);
    const warnings: string[] = [];
    
    if (stats.unsupported > 0) {
      warnings.push(`${stats.unsupported} file${stats.unsupported > 1 ? 's' : ''} cannot be processed by AI`);
    }
    
    if (stats.images > 5) {
      warnings.push('Too many images may slow down processing');
    }
    
    if (stats.totalSize > 50 * 1024 * 1024) { // 50MB
      warnings.push('Large file sizes may slow down processing');
    }
    
    return {
      ...stats,
      canProcessAll: stats.unsupported === 0,
      processingWarnings: warnings
    };
  }, [uploadState.files]);

  // Select files for upload
  const selectFiles = useCallback((fileList: FileList) => {
    const files = Array.from(fileList);
    
    // Validate all files
    const validation = fileUploadService.validateFiles(files);
    if (!validation.isValid) {
      setError(validation.error || ERROR_MESSAGES.FILE_TYPE_NOT_ALLOWED);
      return;
    }

    // Add files to state
    setUploadState(prev => ({
      ...prev,
      files: [...prev.files, ...files],
      error: null
    }));
    
    clearError();
  }, [clearError]);

  // Remove a file from the list
  const removeFile = useCallback((index: number) => {
    setUploadState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
      uploadProgress: {
        ...prev.uploadProgress,
        [index]: undefined
      }
    }));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setUploadState({
      files: [],
      uploading: false,
      uploadProgress: {},
      error: null
    });
    clearError();
  }, [clearError]);

  // Upload files to Supabase Storage
  const uploadFiles = useCallback(async (conversationId?: string): Promise<FileAttachment[]> => {
    if (!user) {
      setError(ERROR_MESSAGES.AUTH_ERROR);
      return [];
    }

    if (uploadState.files.length === 0) {
      return [];
    }

    try {
      setUploadState(prev => ({ ...prev, uploading: true, error: null }));
      setError(null);

      const uploadResults = await fileUploadService.uploadFiles(
        uploadState.files,
        user.id,
        conversationId,
        (fileIndex: number, progress: number) => {
          setUploadState(prev => ({
            ...prev,
            uploadProgress: {
              ...prev.uploadProgress,
              [fileIndex]: progress
            }
          }));
        }
      );

      // Check for any failed uploads
      const failedUploads = uploadResults.filter(result => !result.success);
      if (failedUploads.length > 0) {
        const errorMessage = failedUploads
          .map(result => result.error)
          .filter(Boolean)
          .join(', ');
        setError(errorMessage || 'Some files failed to upload');
      }

      // Get successful uploads
      const successfulUploads = uploadResults
        .filter(result => result.success && result.fileAttachment)
        .map(result => result.fileAttachment!);

      // Clear uploaded files from state
      if (successfulUploads.length > 0) {
        setUploadState(prev => ({
          ...prev,
          files: prev.files.slice(successfulUploads.length),
          uploadProgress: {}
        }));
      }

      return successfulUploads;

    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload files');
      return [];
    } finally {
      setUploadState(prev => ({ ...prev, uploading: false }));
    }
  }, [user, uploadState.files]);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number): string => {
    return fileUploadService.formatFileSize(bytes);
  }, []);

  return {
    uploadState,
    isUploading: uploadState.uploading,
    error,
    selectFiles,
    uploadFiles,
    removeFile,
    clearFiles,
    clearError,
    validateFile,
    formatFileSize,
    getFileProcessingStats,
    canProcessForOpenAI,
    getFileProcessingInfo
  };
};

// Additional hook for drag and drop functionality
export interface UseDragAndDropReturn {
  isDragOver: boolean;
  dragProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export const useDragAndDrop = (
  onFilesDropped: (files: FileList) => void
): UseDragAndDropReturn => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFilesDropped(files);
    }
  }, [onFilesDropped]);

  return {
    isDragOver,
    dragProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop
    }
  };
};

// Hook for file preview functionality
export interface UseFilePreviewReturn {
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  generatePreview: (fileAttachment: FileAttachment) => Promise<void>;
  clearPreview: () => void;
}

export const useFilePreview = (): UseFilePreviewReturn => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePreview = useCallback(async (fileAttachment: FileAttachment) => {
    try {
      setIsLoading(true);
      setError(null);

      const preview = await fileUploadService.generatePreviewUrl(fileAttachment);
      setPreviewUrl(preview);
    } catch (err: any) {
      console.error('Error generating preview:', err);
      setError(err.message || 'Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewUrl(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    previewUrl,
    isLoading,
    error,
    generatePreview,
    clearPreview
  };
}; 