import { FileAttachment } from '@/types';
import { 
  uploadFile, 
  getFileUrl, 
  deleteFile, 
  supabase 
} from '@/lib/supabase';
import { 
  MAX_FILE_SIZE, 
  ALLOWED_FILE_TYPES, 
  MAX_FILES_PER_MESSAGE,
  STORAGE_BUCKET,
  ERROR_MESSAGES 
} from '@/config/constants';

// Feature flags
const ENABLE_PDF_PROCESSING = false; // Set to false to disable PDF processing temporarily

// Dynamically import PDF.js to avoid SSR issues
let pdfjsLib: any = null;
let pdfInitialized = false;

// Initialize PDF.js
const initPDFJS = async () => {
  if (!ENABLE_PDF_PROCESSING) {
    throw new Error('PDF processing is disabled');
  }
  
  if (!pdfjsLib && !pdfInitialized) {
    try {
      pdfInitialized = true;
      pdfjsLib = await import('pdfjs-dist');
      // Configure PDF.js worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      console.log('PDF.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PDF.js:', error);
      pdfjsLib = null;
      throw new Error('PDF processing not available');
    }
  }
  return pdfjsLib;
};

export interface FileUploadResult {
  success: boolean;
  fileAttachment?: FileAttachment;
  error?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ProcessedFileContent {
  type: 'pdf' | 'image' | 'text' | 'document';
  content?: string;
  pages?: number;
  metadata?: any;
  url: string;
}

export interface FileProcessingInfo {
  canProcessForOpenAI: boolean;
  fileType: 'image' | 'document' | 'unsupported';
  processingMethod: 'base64' | 'vector_store' | 'text_extraction' | 'none';
  maxDimensionsForImage?: { width: number; height: number };
}

export class FileUploadService {
  private static instance: FileUploadService;

  static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  // File validation
  validateFile(file: File): FileValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.FILE_TOO_LARGE
      };
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.FILE_TYPE_NOT_ALLOWED
      };
    }

    return { isValid: true };
  }

  validateFiles(files: File[]): FileValidationResult {
    // Check number of files
    if (files.length > MAX_FILES_PER_MESSAGE) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.TOO_MANY_FILES
      };
    }

    // Validate each file
    for (const file of files) {
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return validation;
      }
    }

    return { isValid: true };
  }

  // Enhanced PDF processing using browser-compatible pdfjs-dist
  async processPDFFile(file: File): Promise<ProcessedFileContent> {
    try {
      console.log('Starting PDF processing for:', file.name);
      
      // Initialize PDF.js
      const pdfjs = await initPDFJS();
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log('Loading PDF document...');
      
      // Load the PDF document
      const loadingTask = pdfjs.getDocument({ data: uint8Array });
      const pdfDocument = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdfDocument.numPages;
      
      console.log(`PDF has ${numPages} pages, extracting text...`);
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items into a single string for this page
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          fullText += pageText + '\n\n';
        } catch (pageError) {
          console.warn(`Error extracting text from page ${pageNum}:`, pageError);
          // Continue processing other pages
        }
      }
      
      // Clean up the extracted text
      const cleanedText = fullText
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n\n') // Clean up multiple newlines
        .trim();
      
      console.log(`Successfully extracted ${cleanedText.length} characters from PDF`);
      
      return {
        type: 'pdf',
        content: cleanedText,
        pages: numPages,
        metadata: {
          totalPages: numPages,
          title: file.name,
          size: file.size
        },
        url: '' // Will be set after upload
      };
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      
      // Fallback: return basic file info without text content
      return {
        type: 'pdf',
        content: `[PDF file: ${file.name} - Text extraction failed]`,
        pages: 0,
        metadata: {
          totalPages: 0,
          title: file.name,
          size: file.size,
          error: error.message
        },
        url: ''
      };
    }
  }

  // Process text file content
  async processTextFile(file: File): Promise<ProcessedFileContent> {
    try {
      const text = await file.text();
      
      return {
        type: 'text',
        content: text,
        metadata: {
          encoding: 'utf-8',
          size: file.size
        },
        url: '' // Will be set after upload
      };
    } catch (error: any) {
      console.error('Error processing text file:', error);
      throw new Error(`Failed to process text file: ${error.message}`);
    }
  }

  // Enhanced file processing for AI
  async processFileForAI(file: File, uploadedUrl: string): Promise<ProcessedFileContent> {
    const mimeType = file.type;
    
    if (mimeType === 'application/pdf') {
      const processed = await this.processPDFFile(file);
      processed.url = uploadedUrl;
      return processed;
    } else if (mimeType.startsWith('text/')) {
      const processed = await this.processTextFile(file);
      processed.url = uploadedUrl;
      return processed;
    } else if (this.isImageFile(mimeType)) {
      return {
        type: 'image',
        url: uploadedUrl,
        metadata: {
          type: mimeType,
          size: file.size
        }
      };
    } else {
      return {
        type: 'document',
        url: uploadedUrl,
        metadata: {
          type: mimeType,
          size: file.size,
          name: file.name
        }
      };
    }
  }

  // Enhanced file processing information
  getFileProcessingInfo(file: File): FileProcessingInfo {
    const mimeType = file.type;
    
    if (this.isImageFile(mimeType)) {
      return {
        canProcessForOpenAI: true,
        fileType: 'image',
        processingMethod: 'base64',
        maxDimensionsForImage: { width: 1024, height: 1024 }
      };
    } else if (mimeType === 'application/pdf') {
      return {
        canProcessForOpenAI: true,
        fileType: 'document',
        processingMethod: 'text_extraction'
      };
    } else if (mimeType.startsWith('text/')) {
      return {
        canProcessForOpenAI: true,
        fileType: 'document',
        processingMethod: 'text_extraction'
      };
    } else if (this.isDocumentFile(mimeType)) {
      return {
        canProcessForOpenAI: true,
        fileType: 'document',
        processingMethod: 'vector_store'
      };
    } else {
      return {
        canProcessForOpenAI: false,
        fileType: 'unsupported',
        processingMethod: 'none'
      };
    }
  }

  // Check if file can be processed by OpenAI
  canProcessForOpenAI(file: File): boolean {
    return this.getFileProcessingInfo(file).canProcessForOpenAI;
  }

  // Check if file is an image that can be processed by vision models
  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/') && 
           ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
  }

  // Check if file is a document that can be processed by file_search
  isDocumentFile(mimeType: string): boolean {
    const documentTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    return documentTypes.includes(mimeType);
  }

  // Single file upload
  async uploadFile(
    file: File, 
    userId: string,
    conversationId?: string,
    onProgress?: (progress: number) => void
  ): Promise<FileUploadResult> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Generate unique file path
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2);
      const extension = this.getFileExtension(file.name);
      const fileName = `${userId}/${conversationId || 'temp'}/${timestamp}_${randomId}${extension}`;

      // Upload to Supabase Storage
      const uploadResult = await uploadFile(file, fileName);

      // Get public URL
      const publicUrl = getFileUrl(fileName);

      // Create file attachment record
      const fileAttachment: FileAttachment = {
        id: uploadResult.id || randomId,
        name: file.name,
        type: file.type,
        size: file.size,
        url: publicUrl,
        uploaded_at: new Date().toISOString()
      };

      // If progress callback is provided, simulate progress
      if (onProgress) {
        onProgress(100);
      }

      return {
        success: true,
        fileAttachment
      };

    } catch (error: any) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error.message || 'File upload failed'
      };
    }
  }

  // Multiple file upload with OpenAI processing validation
  async uploadFiles(
    files: File[], 
    userId: string,
    conversationId?: string,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<FileUploadResult[]> {
    // Validate all files first
    const validation = this.validateFiles(files);
    if (!validation.isValid) {
      return files.map(() => ({
        success: false,
        error: validation.error
      }));
    }

    // Check which files can be processed by OpenAI
    const processableFiles = files.filter(file => this.canProcessForOpenAI(file));
    const unprocessableFiles = files.filter(file => !this.canProcessForOpenAI(file));

    if (unprocessableFiles.length > 0) {
      console.warn('Some files cannot be processed by OpenAI:', unprocessableFiles.map(f => f.name));
    }

    const results: FileUploadResult[] = [];

    // Upload files in parallel with limited concurrency
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(files, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map((file, index) => 
        this.uploadFile(
          file, 
          userId, 
          conversationId,
          onProgress ? (progress) => onProgress(index, progress) : undefined
        )
      );

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  // Enhanced upload with processing
  async uploadFileWithProcessing(
    file: File, 
    userId: string,
    conversationId?: string,
    onProgress?: (progress: number) => void
  ): Promise<{ uploadResult: FileUploadResult; processedContent?: ProcessedFileContent }> {
    try {
      // First upload the file
      const uploadResult = await this.uploadFile(file, userId, conversationId, onProgress);
      
      if (!uploadResult.success || !uploadResult.fileAttachment) {
        return { uploadResult };
      }

      // Then process the file content if it's supported
      let processedContent: ProcessedFileContent | undefined;
      
      if (this.canProcessForOpenAI(file)) {
        try {
          processedContent = await this.processFileForAI(file, uploadResult.fileAttachment.url);
        } catch (error) {
          console.error('Error processing file for AI:', error);
          // Don't fail the upload if processing fails
        }
      }

      return { uploadResult, processedContent };
    } catch (error: any) {
      console.error('File upload with processing error:', error);
      return {
        uploadResult: {
          success: false,
          error: error.message || 'File upload failed'
        }
      };
    }
  }

  // Get file upload and processing stats
  getFileStats(files: File[]): {
    total: number;
    images: number;
    documents: number;
    unsupported: number;
    totalSize: number;
  } {
    let images = 0;
    let documents = 0;
    let unsupported = 0;
    let totalSize = 0;

    files.forEach(file => {
      const info = this.getFileProcessingInfo(file);
      totalSize += file.size;
      
      switch (info.fileType) {
        case 'image':
          images++;
          break;
        case 'document':
          documents++;
          break;
        case 'unsupported':
          unsupported++;
          break;
      }
    });

    return {
      total: files.length,
      images,
      documents,
      unsupported,
      totalSize
    };
  }

  // Save file attachment to database
  async saveFileAttachment(
    messageId: string, 
    fileAttachment: FileAttachment
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('file_attachments')
        .insert({
          message_id: messageId,
          name: fileAttachment.name,
          type: fileAttachment.type,
          size: fileAttachment.size,
          url: fileAttachment.url
        });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error saving file attachment:', error);
      throw new Error('Failed to save file attachment');
    }
  }

  // Delete file from storage and database
  async deleteFileAttachment(fileAttachment: FileAttachment): Promise<void> {
    try {
      // Extract file path from URL
      const filePath = this.extractFilePathFromUrl(fileAttachment.url);
      
      if (filePath) {
        // Delete from storage
        await deleteFile(filePath);
      }

      // Delete from database
      const { error } = await supabase
        .from('file_attachments')
        .delete()
        .eq('id', fileAttachment.id);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error deleting file attachment:', error);
      throw new Error('Failed to delete file attachment');
    }
  }

  // Get file info for preview
  async getFileInfo(url: string): Promise<{
    isImage: boolean;
    isDocument: boolean;
    canPreview: boolean;
    mimeType?: string;
  }> {
    try {
      // Determine file type from URL or fetch metadata
      const extension = this.getFileExtensionFromUrl(url);
      const mimeType = this.getMimeTypeFromExtension(extension);

      const isImage = mimeType?.startsWith('image/') || false;
      const isDocument = [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/json'
      ].includes(mimeType || '');

      return {
        isImage,
        isDocument,
        canPreview: isImage || isDocument,
        mimeType
      };
    } catch (error: any) {
      console.error('Error getting file info:', error);
      return {
        isImage: false,
        isDocument: false,
        canPreview: false
      };
    }
  }

  // Generate file preview URL for supported types
  async generatePreviewUrl(fileAttachment: FileAttachment): Promise<string | null> {
    try {
      const fileInfo = await this.getFileInfo(fileAttachment.url);
      
      if (fileInfo.isImage) {
        // For images, return the direct URL
        return fileAttachment.url;
      }

      // For other supported types, you might implement preview generation
      // For now, return null
      return null;
    } catch (error: any) {
      console.error('Error generating preview URL:', error);
      return null;
    }
  }

  // Cleanup temporary files
  async cleanupTempFiles(userId: string): Promise<void> {
    try {
      const { data: files, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(`${userId}/temp`);

      if (error) {
        throw error;
      }

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${userId}/temp/${file.name}`);
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(filePaths);
      }
    } catch (error: any) {
      console.error('Error cleaning up temp files:', error);
      // Don't throw here as this is cleanup
    }
  }

  // Utility methods
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  }

  private getFileExtensionFromUrl(url: string): string {
    const pathname = new URL(url).pathname;
    return this.getFileExtension(pathname);
  }

  private getMimeTypeFromExtension(extension: string): string | undefined {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[extension.toLowerCase()];
  }

  private extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // Find the part after 'object/public/BUCKET_NAME'
      const bucketIndex = pathParts.indexOf(STORAGE_BUCKET);
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting file path from URL:', error);
      return null;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // File size formatting utility
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Check storage quota (if available)
  async checkStorageQuota(userId: string): Promise<{
    used: number;
    available: number;
    percentage: number;
  } | null> {
    try {
      // This would require custom implementation based on your storage policy
      // For now, return null to indicate quota checking is not implemented
      return null;
    } catch (error: any) {
      console.error('Error checking storage quota:', error);
      return null;
    }
  }
}

// Export singleton instance
export const fileUploadService = FileUploadService.getInstance(); 