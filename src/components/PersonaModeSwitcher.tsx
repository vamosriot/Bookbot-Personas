import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getAllPersonas } from '@/config/personas';
import { getAllMarketingPersonas } from '@/config/marketing-personas';
import { 
  Users, 
  Target, 
  BookOpen, 
  MessageSquare, 
  Lightbulb,
  Info
} from 'lucide-react';

export function PersonaModeSwitcher() {
  const personas = getAllPersonas();
  const marketingPersonas = getAllMarketingPersonas();

  const getPersonaIcon = (segment: string) => {
    switch (segment) {
      case 'Book Lover': return <BookOpen className="h-4 w-4" />;
      case 'Occasional Reader': return <MessageSquare className="h-4 w-4" />;
      case 'Non-Fiction Reader (Nerd)': return <Target className="h-4 w-4" />;
      case 'Student': return <Users className="h-4 w-4" />;
      case 'Parent': return <Users className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Customer Research Personas</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              These AI personas represent your customer segments for marketing testing and product consultation.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Available Customer Personas</h3>
              <p className="text-sm text-gray-600">
                Each persona represents a distinct customer segment with unique characteristics and behaviors
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
                {getPersonaIcon(persona.segment)}
              </div>
            ))}
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">How to Use These Personas</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• <strong>Chat Interface:</strong> Select any persona in the main chat to start a conversation</li>
              <li>• <strong>Testing Lab:</strong> Use the Testing Lab tab to systematically test campaigns and features</li>
              <li>• <strong>Team Training:</strong> Help team members understand different customer segments</li>
              <li>• <strong>Product Validation:</strong> Get feedback on features from different user types</li>
              <li>• <strong>Marketing Research:</strong> Test messaging and campaigns before launch</li>
            </ul>
          </div>

          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              <strong>Pro tip:</strong> Each persona responds based on detailed research including demographics, 
              psychographics, behavior patterns, triggers, and barriers specific to their customer segment.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
} 