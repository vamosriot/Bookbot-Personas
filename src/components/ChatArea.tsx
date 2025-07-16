import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { getAllPersonas } from "@/config/personas";
import { MessageWithFiles } from "./MessageWithFiles";
import { FileUpload } from "./FileUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { fileUploadService, ProcessedFileContent } from '@/services/fileUpload';
import { openAIService } from "@/services/openai";
import { FileAttachment, Persona } from "@/types";
import { useChat as useChatHook } from '@/hooks/useChat';
import { createMessageFeedback, deleteMessageFeedback } from '@/lib/supabase';
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  conversationId: string | null;
  onToggleSidebar: () => void;
}

export function ChatArea({ conversationId, onToggleSidebar }: ChatAreaProps) {
  const { user } = useAuth();
  const { 
    messages, 
    selectedPersona, 
    currentConversation, 
    setSelectedPersona, 
    createNewConversation, 
    addMessage,
    loadMessages,
    isLoading,
    error 
  } = useChat();
  
  // Get delete functionality from chat hook
  const { deleteMessage } = useChatHook();
  
  const { toast } = useToast();
  
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFileContent[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const personas = getAllPersonas();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && pendingFiles.length === 0) || !currentConversation || isSending) return;

    const messageContent = inputValue.trim();
    setInputValue("");
    setIsSending(true);

    try {
      // Process and upload files if any
      let uploadedFiles: FileAttachment[] = [];
      let fileProcessingResults: ProcessedFileContent[] = [];

      if (pendingFiles.length > 0 && user) {
        for (const file of pendingFiles) {
          try {
            const { uploadResult, processedContent } = await fileUploadService.uploadFileWithProcessing(
              file,
              user.id,
              currentConversation.id
            );

            if (uploadResult.success && uploadResult.fileAttachment) {
              uploadedFiles.push(uploadResult.fileAttachment);
              
              if (processedContent) {
                fileProcessingResults.push(processedContent);
              }
            }
          } catch (error) {
            console.error('Error processing file:', error);
          }
        }
      }

      // Add user message to database
      await addMessage({
        conversation_id: currentConversation.id,
        content: messageContent,
        role: 'user',
        persona_id: selectedPersona.id,
        files: uploadedFiles
      });

      // Clear pending files after sending
      setPendingFiles([]);
      setProcessedFiles([]);

      // Create complete message context including the current user message
      const currentUserMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversation.id,
        content: messageContent,
        role: 'user' as const,
        persona_id: selectedPersona.id,
        files: uploadedFiles,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const messagesWithCurrentUser = [...messages, currentUserMessage];

      // Get AI response using enhanced OpenAI service with file processing
      let aiResponseContent = '';
      
      await openAIService.sendMessage(
        messagesWithCurrentUser,
        selectedPersona.id,
        (chunk: string) => {
          // Handle streaming response chunks
          aiResponseContent += chunk;
        },
        async (fullResponse: string) => {
          // Handle complete response
          await addMessage({
            conversation_id: currentConversation.id,
            content: fullResponse,
            role: 'assistant',
            persona_id: selectedPersona.id
          });
          setIsSending(false);
        },
        (error: string) => {
          // Handle error
          console.error('OpenAI API error:', error);
          addMessage({
            conversation_id: currentConversation.id,
            content: `I apologize, but I'm having trouble connecting to the AI service right now. Error: ${error}. Please try again later.`,
            role: 'assistant',
            persona_id: selectedPersona.id
          });
          setIsSending(false);
        },
        fileProcessingResults // Pass processed file content
      );

    } catch (err) {
      console.error('Error sending message:', err);
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePersonaChange = async (persona: Persona) => {
    setSelectedPersona(persona);
    
    // Create new conversation with the selected persona
    if (user) {
      await createNewConversation(persona.id);
    }
  };

  const handleFilesUploaded = (files: File[]) => {
    setPendingFiles(prev => [...prev, ...files]);
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleMessageFeedback = async (messageId: string, feedbackType: 'upvote' | 'downvote') => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to provide feedback.",
        variant: "destructive",
      });
      return;
    }

    try {
      const currentMessage = messages.find(m => m.id === messageId);
      const currentFeedback = currentMessage?.feedback;

      if (currentFeedback?.feedback_type === feedbackType) {
        // Same feedback type clicked - remove feedback
        await deleteMessageFeedback(messageId, user.id);
        toast({
          title: "Feedback removed",
          description: "Your feedback has been removed.",
        });
      } else {
        // New or different feedback - create/update
        await createMessageFeedback(messageId, user.id, feedbackType);
        toast({
          title: "Feedback recorded",
          description: `Thank you for marking this response as ${feedbackType === 'upvote' ? 'helpful' : 'not helpful'}.`,
        });
      }

      // Refresh messages to show updated feedback
      if (currentConversation) {
        await loadMessages(currentConversation.id);
      }
    } catch (error) {
      console.error('Failed to handle feedback:', error);
      toast({
        title: "Feedback failed",
        description: "There was an error processing your feedback. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-background">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="md:hidden hover:bg-accent">
            <Menu className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-background hover:bg-accent border-border shadow-sm">
                <div className="flex items-center space-x-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback style={{ backgroundColor: selectedPersona.color }} className="text-white text-xs">
                      {selectedPersona.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{selectedPersona.displayName}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-popover border-border shadow-md z-50">
              {personas.map((persona) => (
                <DropdownMenuItem
                  key={persona.id}
                  onClick={() => handlePersonaChange(persona)}
                  className="flex items-center space-x-3 p-3 hover:bg-accent cursor-pointer focus:bg-accent"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback style={{ backgroundColor: persona.color }} className="text-white text-sm">
                      {persona.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-foreground">{persona.displayName}</span>
                    <span className="text-sm text-muted-foreground">{persona.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Start a conversation with {selectedPersona.displayName}
              </h3>
              <p className="text-muted-foreground">{selectedPersona.description}</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageWithFiles 
                key={message.id} 
                message={message} 
                isOwn={message.role === 'user'}
                showTimestamp={true}
                onFeedback={handleMessageFeedback}
              />
            ))
          )}
          {isSending && (
            <div className="flex items-start space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback style={{ backgroundColor: selectedPersona.color }} className="text-white">
                  {selectedPersona.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="inline-block p-4 rounded-2xl bg-muted text-foreground">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-background">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* File Upload Component */}
          <FileUpload 
            onFilesSelected={handleFilesUploaded}
            maxFiles={5}
            disabled={isSending || isLoading}
            className="w-full"
          />

          {/* Pending Files Display */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
              {pendingFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-2 bg-background px-3 py-1 rounded-full text-sm">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePendingFile(index)}
                    className="h-4 w-4 p-0 hover:bg-destructive/20"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Message Input */}
          <div className="relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Type your message to ${selectedPersona.displayName}...`}
              className="min-h-[60px] pr-12 resize-none bg-background border-input focus:border-primary focus:ring-primary shadow-sm"
              rows={2}
              disabled={isSending || isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={(!inputValue.trim() && pendingFiles.length === 0) || isSending || isLoading}
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 bg-primary hover:bg-primary/90 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

