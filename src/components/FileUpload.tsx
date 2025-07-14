import React, { useRef } from 'react';
import { useFileUpload, useDragAndDrop } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  File, 
  Image, 
  FileText, 
  X, 
  Loader2,
  Paperclip,
  Eye,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected?: (files: File[]) => void;
  onFilesUploaded?: (attachments: any[]) => void;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  onFilesUploaded,
  maxFiles = 5,
  className,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    uploadState,
    isUploading,
    error,
    selectFiles,
    uploadFiles,
    removeFile,
    clearFiles,
    clearError,
    formatFileSize,
    getFileProcessingStats,
    canProcessForOpenAI,
    getFileProcessingInfo
  } = useFileUpload();

  const { isDragOver, dragProps } = useDragAndDrop((files) => {
    if (!disabled) {
      handleFileSelection(files);
    }
  });

  const handleFileSelection = (fileList: FileList) => {
    const filesArray = Array.from(fileList);
    selectFiles(fileList);
    onFilesSelected?.(filesArray);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelection(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (uploadState.files.length === 0) return;
    
    try {
      const attachments = await uploadFiles();
      onFilesUploaded?.(attachments);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleRemoveFile = (index: number) => {
    removeFile(index);
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType.includes('text') || fileType.includes('document')) {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const getProcessingStatusIcon = (file: File) => {
    const canProcess = canProcessForOpenAI(file);
    const info = getFileProcessingInfo(file);
    
    if (canProcess) {
      if (info.includes('image')) {
        return <span title="Will be processed as image"><Eye className="h-3 w-3 text-green-600" /></span>;
      } else if (info.includes('document')) {
        return <span title="Will be processed as document"><FileText className="h-3 w-3 text-blue-600" /></span>;
      } else {
        return <span title="Supported file"><CheckCircle className="h-3 w-3 text-green-600" /></span>;
      }
    } else {
      return <span title="Cannot be processed by AI"><AlertTriangle className="h-3 w-3 text-orange-500" /></span>;
    }
  };

  const getProgressForFile = (index: number): number => {
    return uploadState.uploadProgress[index] || 0;
  };

  // Get processing stats for display
  const processingStats = getFileProcessingStats();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
        disabled={disabled}
      />

      {/* Drag and drop area */}
      <div
        {...dragProps}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragOver 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:border-gray-400",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={openFileDialog}
      >
        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 mb-1">
          {isDragOver ? 'Drop files here' : 'Drag and drop files here, or click to select'}
        </p>
        <p className="text-xs text-gray-500">
          Support for images (vision AI) and documents (text search) - max {maxFiles} files
        </p>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="h-auto p-0 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Processing stats and warnings */}
      {uploadState.files.length > 0 && (
        <div className="space-y-2">
          {/* Stats summary */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Info className="h-4 w-4" />
              <span>
                {processingStats.total} files
                {processingStats.images > 0 && ` (${processingStats.images} images)`}
                {processingStats.documents > 0 && ` (${processingStats.documents} documents)`}
              </span>
            </div>
            <div className="text-xs">
              {formatFileSize(processingStats.totalSize)}
            </div>
          </div>

          {/* Processing warnings */}
          {processingStats.processingWarnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {processingStats.processingWarnings.map((warning, index) => (
                    <div key={index} className="text-sm">
                      • {warning}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* AI processing info */}
          {!processingStats.canProcessAll && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>AI Processing:</strong> Images will be analyzed by vision AI, documents will be processed for text search. 
                  Files that cannot be processed will be uploaded but won't be analyzed by AI.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Selected files list */}
      {uploadState.files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Selected Files ({uploadState.files.length})</h4>
            <div className="space-x-2">
              {!isUploading && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFiles}
                    disabled={disabled}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpload}
                    disabled={disabled || uploadState.files.length === 0}
                  >
                    <Paperclip className="h-4 w-4 mr-1" />
                    Upload Files
                  </Button>
                </>
              )}
              {isUploading && (
                <Button size="sm" disabled>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Uploading...
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {uploadState.files.map((file, index) => {
              const progress = getProgressForFile(index);
              const isFileUploading = isUploading && progress > 0;
              const processingInfo = getFileProcessingInfo(file);
              
              return (
                <div key={`${file.name}-${index}`} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                      {getProcessingStatusIcon(file)}
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-gray-500">{processingInfo}</p>
                    </div>
                    
                    {isFileUploading && (
                      <div className="mt-2">
                        <Progress value={progress} className="h-1" />
                        <p className="text-xs text-gray-500 mt-1">{progress}% uploaded</p>
                      </div>
                    )}
                  </div>

                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      disabled={disabled}
                      className="flex-shrink-0 h-8 w-8 p-0 hover:bg-gray-200"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload progress summary */}
      {isUploading && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Uploading {uploadState.files.length} file{uploadState.files.length !== 1 ? 's' : ''}...</span>
        </div>
      )}
    </div>
  );
}; 