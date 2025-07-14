import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PersonaModeSwitcher } from "@/components/PersonaModeSwitcher";
import { MarketingTestingLab } from "@/components/MarketingTestingLab";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Settings, 
  Target, 
  MessageSquare, 
  Lightbulb,
  Users
} from "lucide-react";

const MarketingLab = () => {
  const [activeTab, setActiveTab] = useState<string>('switcher');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/')}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Chat</span>
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Marketing Lab</h1>
                  <p className="text-sm text-gray-600">
                    Customer research and campaign testing with AI personas
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>5 Customer Segments</span>
                </Badge>
                <Badge variant="outline" className="flex items-center space-x-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>Testing Lab</span>
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="switcher" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Mode</span>
              </TabsTrigger>
              <TabsTrigger value="testing" className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>Testing Lab</span>
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center space-x-2">
                <Lightbulb className="h-4 w-4" />
                <span>Insights</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="switcher" className="space-y-6">
              <PersonaModeSwitcher 
                onModeChange={(mode) => {
                  console.log('Mode changed to:', mode);
                }}
              />
            </TabsContent>

            <TabsContent value="testing" className="space-y-6">
              <MarketingTestingLab />
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5" />
                    <span>Marketing Insights & Analytics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">📚 Book Lover Insights</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Price sensitive but values quality</li>
                        <li>• Responds to sustainability messaging</li>
                        <li>• Interested in rare/out-of-print books</li>
                        <li>• Active on Goodreads and book communities</li>
                      </ul>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 mb-2">📱 Occasional Reader Insights</h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• Highly price sensitive</li>
                        <li>• Influenced by trends and adaptations</li>
                        <li>• Prefers simple, quick purchase process</li>
                        <li>• Active on TikTok and Instagram</li>
                      </ul>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-purple-900 mb-2">🧠 Knowledge Seeker Insights</h4>
                      <ul className="text-sm text-purple-800 space-y-1">
                        <li>• Low price sensitivity for quality content</li>
                        <li>• Needs current, authoritative information</li>
                        <li>• Values expert recommendations</li>
                        <li>• Active on LinkedIn and Reddit</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-yellow-900 mb-2">🎓 Student Insights</h4>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        <li>• Extremely price sensitive</li>
                        <li>• Needs exact textbook editions</li>
                        <li>• Influenced by peer recommendations</li>
                        <li>• Uses WhatsApp and student groups</li>
                      </ul>
                    </div>

                    <div className="bg-pink-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-pink-900 mb-2">👩‍👧‍👦 Parent Insights</h4>
                      <ul className="text-sm text-pink-800 space-y-1">
                        <li>• Values educational content</li>
                        <li>• Concerned about age appropriateness</li>
                        <li>• Interested in series and bundles</li>
                        <li>• Active in parenting Facebook groups</li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">🎯 Key Recommendations</h4>
                      <ul className="text-sm text-gray-800 space-y-1">
                        <li>• Use different pricing strategies per segment</li>
                        <li>• Tailor messaging to platform preferences</li>
                        <li>• Highlight different value propositions</li>
                        <li>• Test campaigns before full rollout</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-2">🚀 Next Steps</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-orange-800 mb-1">Immediate Actions:</h5>
                        <ul className="text-sm text-orange-700 space-y-1">
                          <li>• Test current campaigns with all personas</li>
                          <li>• Identify messaging gaps per segment</li>
                          <li>• Optimize pricing strategy</li>
                          <li>• Plan platform-specific campaigns</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-orange-800 mb-1">Long-term Strategy:</h5>
                        <ul className="text-sm text-orange-700 space-y-1">
                          <li>• Develop segment-specific landing pages</li>
                          <li>• Create targeted email campaigns</li>
                          <li>• Build loyalty programs per segment</li>
                          <li>• Track real customer behavior vs personas</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MarketingLab; 