import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

  const getPriceSensitivityColor = (sensitivity: string) => {
    switch (sensitivity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card>
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
                These AI personas represent your customer segments based on detailed market research for the European book market.
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {marketingPersonas.map((persona) => (
                <Card key={persona.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                          style={{ backgroundColor: persona.color }}
                        >
                          {persona.avatar}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{persona.displayName}</CardTitle>
                          <p className="text-sm text-gray-600">{persona.segment}</p>
                        </div>
                      </div>
                      {getPersonaIcon(persona.segment)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">{persona.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Price Sensitivity</span>
                        <Badge className={getPriceSensitivityColor(persona.behavior.priceSensitivity)}>
                          {persona.behavior.priceSensitivity}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Reading Frequency</span>
                        <span className="text-xs text-gray-600">{persona.behavior.readingFrequency}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Age Range</span>
                        <span className="text-xs text-gray-600">{persona.demographics.ageRange}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Key Platforms</p>
                      <div className="flex flex-wrap gap-1">
                        {persona.behavior.platforms.slice(0, 3).map((platform) => (
                          <Badge key={platform} variant="secondary" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Main Motivations</p>
                      <div className="space-y-1">
                        {persona.psychographics.motivations.slice(0, 2).map((motivation) => (
                          <div key={motivation} className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-xs text-gray-600">{motivation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Pain Points</p>
                      <div className="space-y-1">
                        {persona.psychographics.painPoints.slice(0, 2).map((pain) => (
                          <div key={pain} className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-xs text-gray-600">{pain}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">How to Use These Personas</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Chat Interface:</strong> Select any persona in the main chat to start a conversation</li>
                <li>• <strong>Team Training:</strong> Help team members understand different customer segments</li>
                <li>• <strong>Product Validation:</strong> Get feedback on features from different user types</li>
                <li>• <strong>Marketing Research:</strong> Test messaging and campaigns through conversations</li>
                <li>• <strong>Customer Understanding:</strong> Learn about motivations, pain points, and behaviors</li>
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
    </div>
  );
} 