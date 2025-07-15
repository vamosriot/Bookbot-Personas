import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Trash2,
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
    <div className="w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-sidebar-foreground">Chat</h1>
          <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent h-7 w-7">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2 mb-2">
          <Button 
            size="sm"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-xs"
            onClick={handleNewConversation}
            disabled={isLoading}
          >
            <Plus className="h-3 w-3 mr-1" />
            New Conversation
          </Button>
          
          {onShowPersonas && (
            <Button 
              variant="outline" 
              size="sm"
              className="w-full text-xs"
              onClick={onShowPersonas}
            >
              <Users className="h-3 w-3 mr-1" />
              View Personas
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 bg-background border-input focus:border-primary focus:ring-primary text-xs h-8"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 px-2">
        <div className="space-y-1 py-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs">
                {searchTerm ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-[10px] mt-0.5">
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
                  className={`relative group rounded-md p-1.5 cursor-pointer transition-all hover:bg-sidebar-accent ${
                    isSelected
                      ? 'bg-sidebar-accent ring-1 ring-sidebar-accent-foreground/20'
                      : ''
                  }`}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start space-x-2 flex-1 min-w-0 overflow-hidden">
                      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                        <AvatarFallback 
                          className="text-[10px] font-medium text-white"
                          style={{ backgroundColor: conversationPersona.color }}
                        >
                          {conversationPersona.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 mb-0.5">
                          <h3 className="font-medium text-xs text-sidebar-foreground truncate">
                            {conversation.title}
                          </h3>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {conversation.message_count}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatDate(conversation.last_message_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative flex items-center flex-shrink-0">
                      {/* Direct delete button - always visible */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete "${conversation.title}"? This action cannot be undone.`)) {
                            handleDeleteConversation(conversation.id);
                          }
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
