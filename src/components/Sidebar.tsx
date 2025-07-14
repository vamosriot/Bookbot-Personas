import { useState } from "react";
import { Search, Plus, MessageSquare, Settings, User, Menu, LogOut, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChat as useChatContext } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  
  const {
    conversations,
    currentConversation,
    selectedPersona,
    createNewConversation,
    switchConversation,
    deleteConversation,
    isLoading,
    error
  } = useChatContext();

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 7 * 24) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleNewConversation = async () => {
    try {
      await createNewConversation(selectedPersona.id);
    } catch (err) {
      console.error('Error creating new conversation:', err);
    }
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(conversationId);
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  if (!isOpen) {
    return (
      <div className="w-12 bg-sidebar-background border-r border-sidebar-border flex flex-col items-center py-4">
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent">
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-sidebar-background border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-sidebar-foreground">Chat</h1>
          <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="space-y-3 mb-3">
          <Button 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            onClick={handleNewConversation}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/marketing-lab')}
          >
            <Target className="h-4 w-4 mr-2" />
            Marketing Lab
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background border-input focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Loading conversations...
            </div>
          )}
          
          {error && (
            <div className="text-center text-sm text-red-600 py-4">
              {error}
            </div>
          )}
          
          {!isLoading && !error && filteredConversations.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              {searchTerm ? 'No conversations found' : 'No conversations yet. Create your first one!'}
            </div>
          )}
          
          {filteredConversations.map((conversation) => (
            <div key={conversation.id} className="relative group">
              <Button
                variant="ghost"
                className={cn(
                  "w-full p-3 h-auto justify-start mb-1 text-left hover:bg-sidebar-accent transition-colors rounded-lg",
                  currentConversation?.id === conversation.id && "bg-sidebar-accent border border-sidebar-border"
                )}
                onClick={() => switchConversation(conversation.id)}
              >
                <div className="flex items-start space-x-3 w-full">
                  <MessageSquare className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm text-sidebar-foreground">
                      {conversation.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimestamp(conversation.last_message_at)}
                    </p>
                  </div>
                </div>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => handleDeleteConversation(conversation.id, e)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-sm text-sidebar-foreground">
              <User className="h-4 w-4" />
              <span className="truncate max-w-[120px]">{user?.email}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
