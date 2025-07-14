import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MarketingPersona, 
  getAllMarketingPersonas, 
  getMarketingPersonaById, 
  testScenarios 
} from '@/config/marketing-personas';
import { 
  Target, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Lightbulb, 
  BarChart3,
  PlusCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  BookOpen,
  Eye
} from 'lucide-react';

interface TestMessage {
  id: string;
  persona: MarketingPersona;
  scenario: string;
  response: string;
  timestamp: Date;
}

export function MarketingTestingLab() {
  const [selectedPersona, setSelectedPersona] = useState<MarketingPersona | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [activeTab, setActiveTab] = useState<string>('personas');

  const personas = getAllMarketingPersonas();

  const handlePersonaSelect = (personaId: string) => {
    const persona = getMarketingPersonaById(personaId);
    if (persona) {
      setSelectedPersona(persona);
    }
  };

  const handleScenarioTest = (scenarioType: string, prompt: string) => {
    if (!selectedPersona) return;

    // Simulate AI response based on persona characteristics
    const response = generatePersonaResponse(selectedPersona, prompt);
    
    const testMessage: TestMessage = {
      id: Date.now().toString(),
      persona: selectedPersona,
      scenario: `${scenarioType}: ${prompt}`,
      response,
      timestamp: new Date()
    };

    setTestMessages(prev => [testMessage, ...prev]);
  };

  const handleCustomTest = () => {
    if (!selectedPersona || !customMessage.trim()) return;

    const response = generatePersonaResponse(selectedPersona, customMessage);
    
    const testMessage: TestMessage = {
      id: Date.now().toString(),
      persona: selectedPersona,
      scenario: `Custom: ${customMessage}`,
      response,
      timestamp: new Date()
    };

    setTestMessages(prev => [testMessage, ...prev]);
    setCustomMessage('');
  };

  const generatePersonaResponse = (persona: MarketingPersona, prompt: string): string => {
    // This is a simplified response generator
    // In a real implementation, this would call your AI service
    const baseResponse = `${persona.greeting}\n\nRegarding "${prompt}":\n\n`;
    
    if (prompt.toLowerCase().includes('price') || prompt.toLowerCase().includes('discount')) {
      if (persona.behavior.priceSensitivity === 'high') {
        return baseResponse + "Oh wow, that sounds really interesting! I'm always looking for ways to save money on books. Can you tell me more about the exact prices and how much I'd save?";
      } else if (persona.behavior.priceSensitivity === 'medium') {
        return baseResponse + "That's a nice offer! I do consider price when buying books, but I'm also interested in the quality and selection. What kind of books would be included?";
      } else {
        return baseResponse + "Price is less important to me than getting the right books. I'm more interested in whether you have the specific editions or rare titles I need.";
      }
    }
    
    if (prompt.toLowerCase().includes('feature') || prompt.toLowerCase().includes('new')) {
      return baseResponse + "Interesting! Let me think about how this would work for someone like me... " + 
        `Given that I usually ${persona.behavior.decisionFactors.join(', ')}, this could be helpful if it addresses those needs.`;
    }
    
    return baseResponse + "Let me think about this from my perspective... " + 
      `As someone who ${persona.psychographics.motivations.join(', ')}, I'd want to know more about how this fits with my needs.`;
  };

  const getPriceSensitivityColor = (sensitivity: string) => {
    switch (sensitivity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPersonaIcon = (segment: string) => {
    switch (segment) {
      case 'Book Lover': return <BookOpen className="h-4 w-4" />;
      case 'Occasional Reader': return <Eye className="h-4 w-4" />;
      case 'Non-Fiction Reader (Nerd)': return <Target className="h-4 w-4" />;
      case 'Student': return <Users className="h-4 w-4" />;
      case 'Parent': return <Users className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing Testing Lab</h1>
          <p className="text-gray-600 mt-1">
            Test campaigns, features, and messaging with AI customer personas
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {personas.length} Customer Segments
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {testMessages.length} Test Results
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personas">Customer Personas</TabsTrigger>
          <TabsTrigger value="testing">Test Scenarios</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
        </TabsList>

        <TabsContent value="personas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {personas.map((persona) => (
              <Card 
                key={persona.id} 
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedPersona?.id === persona.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handlePersonaSelect(persona.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback style={{ backgroundColor: persona.color }} className="text-white text-lg">
                          {persona.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{persona.displayName}</CardTitle>
                        <CardDescription className="text-sm">{persona.segment}</CardDescription>
                      </div>
                    </div>
                    {getPersonaIcon(persona.segment)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
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

                  <div className="pt-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Key Platforms</p>
                    <div className="flex flex-wrap gap-1">
                      {persona.behavior.platforms.slice(0, 3).map((platform) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Main Triggers</p>
                    <div className="space-y-1">
                      {persona.triggers.slice(0, 2).map((trigger) => (
                        <div key={trigger} className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-600">{trigger}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Key Barriers</p>
                    <div className="space-y-1">
                      {persona.barriers.slice(0, 2).map((barrier) => (
                        <div key={barrier} className="flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                          <span className="text-xs text-gray-600">{barrier}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedPersona && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ backgroundColor: selectedPersona.color }} className="text-white">
                      {selectedPersona.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span>{selectedPersona.displayName} - Detailed Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Demographics</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Age:</span> {selectedPersona.demographics.ageRange}</div>
                      <div><span className="font-medium">Gender:</span> {selectedPersona.demographics.gender}</div>
                      <div><span className="font-medium">Education:</span> {selectedPersona.demographics.education}</div>
                      <div><span className="font-medium">Income:</span> {selectedPersona.demographics.income}</div>
                      <div><span className="font-medium">Location:</span> {selectedPersona.demographics.location}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Behavior</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Reading:</span> {selectedPersona.behavior.readingFrequency}</div>
                      <div><span className="font-medium">Purchase:</span> {selectedPersona.behavior.purchaseFrequency}</div>
                      <div><span className="font-medium">Price Sensitivity:</span> {selectedPersona.behavior.priceSensitivity}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Values & Motivations</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Values:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPersona.psychographics.values.map((value) => (
                            <Badge key={value} variant="outline" className="text-xs">{value}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Motivations:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPersona.psychographics.motivations.map((motivation) => (
                            <Badge key={motivation} variant="outline" className="text-xs">{motivation}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Pain Points</h4>
                    <div className="space-y-1">
                      {selectedPersona.psychographics.painPoints.map((pain) => (
                        <div key={pain} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">{pain}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          {!selectedPersona ? (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                Please select a customer persona from the "Customer Personas" tab first.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ backgroundColor: selectedPersona.color }} className="text-white">
                        {selectedPersona.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <span>Testing with {selectedPersona.displayName}</span>
                  </CardTitle>
                  <CardDescription>
                    Select a test scenario or create a custom message to see how this customer segment would respond.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Quick Test Scenarios</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(testScenarios).map(([key, scenario]) => (
                          <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center space-x-2">
                                {key === 'campaign' && <TrendingUp className="h-4 w-4" />}
                                {key === 'feature' && <PlusCircle className="h-4 w-4" />}
                                {key === 'pricing' && <DollarSign className="h-4 w-4" />}
                                {key === 'ux' && <Eye className="h-4 w-4" />}
                                {key === 'communication' && <MessageSquare className="h-4 w-4" />}
                                <span>{scenario.title}</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
                              <div className="space-y-2">
                                {scenario.prompts.map((prompt, index) => (
                                  <Button
                                    key={index}
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-left justify-start text-xs"
                                    onClick={() => handleScenarioTest(scenario.title, prompt)}
                                  >
                                    {prompt}
                                  </Button>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-2">Custom Test Message</h4>
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Enter your custom message, campaign, or question to test..."
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <Button 
                          onClick={handleCustomTest}
                          disabled={!customMessage.trim()}
                          className="w-full"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Test with {selectedPersona.displayName}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Test Results</span>
              </CardTitle>
              <CardDescription>
                Review how different customer segments responded to your tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No test results yet. Go to the Testing tab to start testing!</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {testMessages.map((message) => (
                      <Card key={message.id} className="border-l-4" style={{ borderLeftColor: message.persona.color }}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback style={{ backgroundColor: message.persona.color }} className="text-white">
                                  {message.persona.avatar}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-base">{message.persona.displayName}</CardTitle>
                                <CardDescription className="text-sm">{message.persona.segment}</CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <Clock className="h-4 w-4" />
                              <span>{message.timestamp.toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Test Scenario:</p>
                              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{message.scenario}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Customer Response:</p>
                              <p className="text-sm text-gray-800 bg-blue-50 p-3 rounded">{message.response}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 