import React, { useState } from 'react';
import { Message, FileAttachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  File, 
  Image, 
  FileText, 
  Download, 
  Eye, 
  ExternalLink,
  Paperclip,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fileUploadService } from '@/services/fileUpload';
import { getFileUrl } from '@/lib/supabase';

interface MessageWithFilesProps {
  message: Message;
  className?: string;
  showTimestamp?: boolean;
  isOwn?: boolean;
  onFeedback?: (messageId: string, feedbackType: 'upvote' | 'downvote') => void;
}

export const MessageWithFiles: React.FC<MessageWithFilesProps> = ({ 
  message, 
  className,
  showTimestamp = true,
  isOwn = false,
  onFeedback
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [brokenImageUrls, setBrokenImageUrls] = useState<Set<string>>(new Set());

  const formatFileSize = (bytes: number): string => {
    return fileUploadService.formatFileSize(bytes);
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

  const getValidImageUrl = (file: FileAttachment): string => {
    // If the original URL is broken and we have a storage_path, regenerate the URL
    if (brokenImageUrls.has(file.url) && file.storage_path) {
      return getFileUrl(file.storage_path);
    }
    return file.url;
  };

  const handleImageError = (file: FileAttachment) => {
    // Mark this URL as broken
    setBrokenImageUrls(prev => new Set(prev).add(file.url));
  };

  const handleFilePreview = async (fileAttachment: FileAttachment) => {
    try {
      setIsPreviewLoading(true);
      const preview = await fileUploadService.generatePreviewUrl(fileAttachment);
      setPreviewUrl(preview);
    } catch (error) {
      console.error('Error generating preview:', error);
      // Fallback to opening file in new tab
      window.open(fileAttachment.url, '_blank');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleFileDownload = (fileAttachment: FileAttachment) => {
    const link = document.createElement('a');
    link.href = getValidImageUrl(fileAttachment);
    link.download = fileAttachment.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImageFile = (fileType: string): boolean => {
    return fileType.startsWith('image/');
  };

  const canPreview = async (fileAttachment: FileAttachment): Promise<boolean> => {
    const fileInfo = await fileUploadService.getFileInfo(fileAttachment.url);
    return fileInfo.canPreview;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <div 
      className={cn(
        "group relative flex flex-col space-y-2 max-w-3xl",
        isOwn ? "items-end" : "items-start",
        className
      )}
    >


      {/* Message content */}
      {message.content && (
        <Card className={cn(
          "relative",
          isOwn 
            ? "bg-blue-600 text-white ml-12" 
            : "bg-white border mr-12"
        )}>
          <CardContent className="p-3">
            <div className="prose prose-sm max-w-none">
              <p className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap",
                isOwn ? "text-white" : "text-gray-900"
              )}>
                {message.content}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File attachments */}
      {message.files && message.files.length > 0 && (
        <div className={cn(
          "space-y-2 w-full max-w-md",
          isOwn ? "items-end" : "items-start"
        )}>
          <div className={cn(
            "flex items-center space-x-1 text-xs text-gray-500",
            isOwn ? "justify-end" : "justify-start"
          )}>
            <Paperclip className="h-3 w-3" />
            <span>{message.files.length} attachment{message.files.length !== 1 ? 's' : ''}</span>
          </div>

          {message.files.map((file, index) => (
            <Card key={`${file.id}-${index}`} className="border">
              <CardContent className="p-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-gray-400">
                    {getFileIcon(file.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-2">
                      {file.type}
                    </p>

                    {/* Image preview for image files */}
                    {isImageFile(file.type) && (
                      <div className="mb-2">
                        <img 
                          src={getValidImageUrl(file)} 
                          alt={file.name}
                          className="max-w-full h-auto rounded border max-h-48 object-cover cursor-pointer"
                          onClick={() => window.open(getValidImageUrl(file), '_blank')}
                          onError={() => handleImageError(file)}
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileDownload(file)}
                        className="text-xs h-7"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getValidImageUrl(file), '_blank')}
                        className="text-xs h-7"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>

                      {!isImageFile(file.type) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFilePreview(file)}
                          disabled={isPreviewLoading}
                          className="text-xs h-7"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {showTimestamp && (
        <div className={cn(
          "text-xs text-gray-500 px-1",
          isOwn ? "text-right" : "text-left"
        )}>
          {formatTimestamp(message.created_at)}
        </div>
      )}

      {/* Feedback buttons for AI messages */}
      {message.role === 'assistant' && onFeedback && (
        <div className={cn(
          "flex items-center space-x-2 px-1",
          isOwn ? "justify-end" : "justify-start"
        )}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFeedback(message.id, 'upvote')}
            className={cn(
              "h-6 px-2 text-xs hover:bg-green-50 hover:text-green-600",
              message.feedback?.feedback_type === 'upvote' 
                ? "bg-green-50 text-green-600" 
                : "text-gray-400"
            )}
          >
            <ThumbsUp className="h-3 w-3 mr-1" />
            Helpful
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFeedback(message.id, 'downvote')}
            className={cn(
              "h-6 px-2 text-xs hover:bg-red-50 hover:text-red-600",
              message.feedback?.feedback_type === 'downvote' 
                ? "bg-red-50 text-red-600" 
                : "text-gray-400"
            )}
          >
            <ThumbsDown className="h-3 w-3 mr-1" />
            Not helpful
          </Button>
        </div>
      )}

      {/* Preview modal would go here - for now, opening in new tab */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">File Preview</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewUrl(null)}
              >
                Close
              </Button>
            </div>
            <iframe 
              src={previewUrl} 
              className="w-full h-96"
              title="File Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}; 