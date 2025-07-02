

import { useState } from "react";
import { Send, Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatAreaProps {
  conversationId: string | null;
  onToggleSidebar: () => void;
}

const models = [
  { id: "pepa", name: "Pepa", description: "Creative and expressive" },
  { id: "jarka", name: "Jarka", description: "Analytical and precise" },
  { id: "honza", name: "Honza", description: "Technical specialist" },
  { id: "alena", name: "Alena", description: "Friendly and helpful" },
  { id: "sofie", name: "Sofie", description: "Academic and thorough" },
];

const mockMessages: Message[] = [
  {
    id: "1",
    content: "Hello! How can I help you today?",
    isUser: false,
    timestamp: "10:30 AM",
  },
  {
    id: "2",
    content: "I need help with creating a React component for a chat interface. Can you guide me through the process?",
    isUser: true,
    timestamp: "10:31 AM",
  },
  {
    id: "3",
    content: "I'd be happy to help you create a React chat interface component! Let's break this down into steps:\n\n1. **Component Structure**: We'll need components for the chat container, message list, individual messages, and input area.\n\n2. **State Management**: We'll use React hooks to manage messages, input state, and user interactions.\n\n3. **Styling**: We'll use modern CSS or a UI library for a clean, responsive design.\n\nWould you like me to start with a basic example, or do you have specific requirements for your chat interface?",
    isUser: false,
    timestamp: "10:32 AM",
  },
];

export function ChatArea({ conversationId, onToggleSidebar }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState(models[0]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "Thank you for your message! I'm here to help you with any questions or tasks you have.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
                  <span className="font-medium text-foreground">{selectedModel.name}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-popover border-border shadow-md z-50">
              {models.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => setSelectedModel(model)}
                  className="flex flex-col items-start p-3 hover:bg-accent cursor-pointer focus:bg-accent"
                >
                  <span className="font-medium text-foreground">{model.name}</span>
                  <span className="text-sm text-muted-foreground">{model.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.isUser ? "flex-row-reverse space-x-reverse" : ""
              }`}
            >
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className={message.isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
                  {message.isUser ? "U" : "AI"}
                </AvatarFallback>
              </Avatar>
              <div className={`flex-1 ${message.isUser ? "text-right" : ""}`}>
                <div
                  className={`inline-block p-4 rounded-2xl max-w-[80%] shadow-sm ${
                    message.isUser
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-2">
                  {message.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              className="min-h-[60px] pr-12 resize-none bg-background border-input focus:border-primary focus:ring-primary shadow-sm"
              rows={2}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 bg-primary hover:bg-primary/90 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

