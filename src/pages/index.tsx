
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { PersonaModeSwitcher } from "@/components/PersonaModeSwitcher";
import { SidebarProvider } from "@/components/ui/sidebar";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";

const Index = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showPersonas, setShowPersonas] = useState(false);

  const handleShowPersonas = () => {
    setShowPersonas(true);
    setSelectedConversation(null);
  };

  const handleBackToChat = () => {
    setShowPersonas(false);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <Sidebar 
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onShowPersonas={handleShowPersonas}
        />
        
        {showPersonas ? (
          <div className="flex-1 overflow-hidden">
            <div className="h-full bg-gray-50">
              {/* Header */}
              <div className="bg-white shadow-sm border-b">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="ghost"
                        onClick={handleBackToChat}
                        className="flex items-center space-x-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Chat</span>
                      </Button>
                      <div className="h-6 w-px bg-gray-300" />
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">Customer Personas</h1>
                        <p className="text-sm text-gray-600">
                          Detailed information about your customer segments
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        {isSidebarOpen ? "Hide" : "Show"} Sidebar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto h-full">
                <PersonaModeSwitcher />
              </div>
            </div>
          </div>
        ) : (
          <ChatArea 
            conversationId={selectedConversation}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default Index;
