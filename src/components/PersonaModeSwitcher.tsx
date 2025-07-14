import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  switchPersonaMode, 
  getCurrentPersonaMode, 
  getAllPersonas 
} from '@/config/personas';
import { getAllMarketingPersonas } from '@/config/marketing-personas';
import { 
  Users, 
  Target, 
  BookOpen, 
  MessageSquare, 
  Lightbulb,
  Settings,
  Info
} from 'lucide-react';

interface PersonaModeSwitcherProps {
  onModeChange?: (mode: 'regular' | 'marketing') => void;
}

export function PersonaModeSwitcher({ onModeChange }: PersonaModeSwitcherProps) {
  const [currentMode, setCurrentMode] = React.useState<'regular' | 'marketing'>(getCurrentPersonaMode());
  
  const handleModeSwitch = (mode: 'regular' | 'marketing') => {
    switchPersonaMode(mode);
    setCurrentMode(mode);
    onModeChange?.(mode);
    
    // Force a page reload to ensure all components use the new personas
    window.location.reload();
  };

  const regularPersonas = getAllPersonas();
  const marketingPersonas = getAllMarketingPersonas();

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Persona Mode</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Switch between regular AI assistants and customer research personas for marketing testing.
            </AlertDescription>
          </Alert>

          <Tabs value={currentMode} onValueChange={handleModeSwitch}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="regular" className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>AI Assistants</span>
              </TabsTrigger>
              <TabsTrigger value="marketing" className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>Customer Research</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="regular" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">AI Assistant Mode</h3>
                  <p className="text-sm text-gray-600">
                    Chat with specialized AI assistants for various tasks and projects
                  </p>
                </div>
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>{regularPersonas.length} Assistants</span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {regularPersonas.map((persona) => (
                  <div key={persona.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: persona.color }}
                    >
                      {persona.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{persona.displayName}</div>
                      <div className="text-sm text-gray-600">{persona.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Perfect for:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• General assistance and task completion</li>
                  <li>• Creative projects and brainstorming</li>
                  <li>• Technical support and coding help</li>
                  <li>• Research and analysis tasks</li>
                  <li>• Personal development and planning</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="marketing" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Customer Research Mode</h3>
                  <p className="text-sm text-gray-600">
                    Interact with AI personas representing your customer segments for marketing testing
                  </p>
                </div>
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Target className="h-3 w-3" />
                  <span>{marketingPersonas.length} Customer Segments</span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketingPersonas.map((persona) => (
                  <div key={persona.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: persona.color }}
                    >
                      {persona.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{persona.displayName}</div>
                      <div className="text-sm text-gray-600">{persona.segment}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Perfect for:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Testing marketing campaigns and messaging</li>
                  <li>• Validating product features and UX changes</li>
                  <li>• Understanding customer reactions to pricing</li>
                  <li>• Training team members on customer segments</li>
                  <li>• Conducting market research interviews</li>
                </ul>
              </div>

              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  <strong>Pro tip:</strong> Use the Marketing Testing Lab for systematic testing of campaigns, 
                  features, and messaging across all customer segments at once.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              Current mode: <span className="font-semibold">{currentMode === 'regular' ? 'AI Assistants' : 'Customer Research'}</span>
            </div>
            <div className="text-sm text-gray-500">
              Changes will take effect immediately
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 