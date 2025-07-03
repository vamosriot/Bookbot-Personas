import { useState, useRef, useEffect } from "react";
import { Send, Menu, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { personas } from "@/config/personas";
import { MessageWithFiles } from "./MessageWithFiles";
import { FileUpload } from "./FileUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { openAIService } from "@/services/openai";
import { FileAttachment } from "@/types";

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
    isLoading,
    error 
  } = useChat();
  
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileAttachment[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
      // Add user message with pending files
      await addMessage({
        conversation_id: currentConversation.id,
        content: messageContent,
        role: 'user',
        persona_id: selectedPersona.id,
        files: pendingFiles
      });

      // Clear pending files after sending
      setPendingFiles([]);

      // Get AI response using OpenAI service
      let aiResponseContent = '';
      
      await openAIService.sendMessage(
        messages, // Pass current messages for context
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
          // Add fallback message
          addMessage({
            conversation_id: currentConversation.id,
            content: `I apologize, but I'm having trouble connecting to the AI service right now. Error: ${error}. Please try again later.`,
            role: 'assistant',
            persona_id: selectedPersona.id
          });
          setIsSending(false);
        }
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

  const handlePersonaChange = async (persona: typeof personas[0]) => {
    setSelectedPersona(persona);
    
    // Create new conversation with the selected persona
    if (user) {
      await createNewConversation(persona.id);
    }
  };

  const handleFilesUploaded = (attachments: FileAttachment[]) => {
    setPendingFiles(prev => [...prev, ...attachments]);
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
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
            onFilesUploaded={handleFilesUploaded}
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

