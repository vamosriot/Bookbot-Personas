import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChat } from '@/contexts/ChatContext';
import { getPersonaById } from '@/config/personas';
import { Conversation, Message } from '@/types';
import { 
  Menu, 
  Plus, 
  Search, 
  MessageSquare, 
  Users,
  MoreVertical,
  Trash2,
  Edit2,
  Clock
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowPersonas?: () => void;
}

export function Sidebar({ 
  isOpen, 
  onToggle,
  onShowPersonas 
}: SidebarProps) {
  const navigate = useNavigate();
  const { 
    conversations, 
    currentConversation,
    createNewConversation, 
    switchConversation,
    deleteConversation, 
    isLoading,
    selectedPersona 
  } = useChat();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewConversation = async () => {
    try {
      await createNewConversation(selectedPersona.id);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      await switchConversation(conversationId);
    } catch (error) {
      console.error('Failed to switch conversation:', error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);
      setShowDropdown(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get persona for a specific conversation
  const getConversationPersona = (conversation: Conversation) => {
    return getPersonaById(conversation.persona_id) || selectedPersona;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
          
          {onShowPersonas && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onShowPersonas}
            >
              <Users className="h-4 w-4 mr-2" />
              View Personas
            </Button>
          )}
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
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 py-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {searchTerm ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-xs mt-1">
                {searchTerm ? 'Try a different search term' : 'Start a new conversation to begin'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const conversationPersona = getConversationPersona(conversation);
              const isSelected = currentConversation?.id === conversation.id;
              
              return (
                <div
                  key={conversation.id}
                  className={`relative group rounded-lg p-3 cursor-pointer transition-all hover:bg-sidebar-accent ${
                    isSelected
                      ? 'bg-sidebar-accent ring-1 ring-sidebar-accent-foreground/20'
                      : ''
                  }`}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                        <AvatarFallback 
                          className="text-xs font-medium text-white"
                          style={{ backgroundColor: conversationPersona.color }}
                        >
                          {conversationPersona.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-sm text-sidebar-foreground truncate">
                            {conversation.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {conversation.message_count}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(conversation.last_message_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDropdown(showDropdown === conversation.id ? null : conversation.id);
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      
                      {showDropdown === conversation.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-background border border-border rounded-md shadow-lg z-50">
                          <div className="py-1">
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center space-x-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Handle edit functionality
                                setShowDropdown(null);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Rename</span>
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-destructive flex items-center space-x-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(conversation.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
