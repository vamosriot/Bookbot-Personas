import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/components/auth/LoginPage";
import Index from "./pages/index";
import MarketingLab from "./pages/MarketingLab";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Get the base path for React Router - works in both dev and production
const basename = process.env.NODE_ENV === 'production' ? '/Bookbot-Personas/' : '/';

// Debug component to log current route
const RouteDebugger = () => {
  const location = useLocation();
  
  useEffect(() => {
    console.log('Current route:', location.pathname);
    console.log('Current search:', location.search);
    console.log('Current hash:', location.hash);
    console.log('Basename:', basename);
  }, [location]);
  
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <RouteDebugger />
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <ChatProvider>
                    <Index />
                  </ChatProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/marketing-lab" 
              element={
                <ProtectedRoute>
                  <ChatProvider>
                    <MarketingLab />
                  </ChatProvider>
                </ProtectedRoute>
              } 
            />
            <Route path="/login" element={<LoginPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
