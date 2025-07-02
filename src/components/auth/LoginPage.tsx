import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Info } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, isLoading, error } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setFormError('Email is required');
      return false;
    }

    if (!formData.email.includes('@')) {
      setFormError('Please enter a valid email address');
      return false;
    }

    if (!formData.password) {
      setFormError('Password is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setFormError(null);
      await signIn(formData.email, formData.password);
    } catch (err: any) {
      setFormError(err.message || 'Invalid email or password. Please try again.');
    }
  };

  const handleQuickLogin = () => {
    setFormData({
      email: 'admin@bookbot-personas.com',
      password: 'admin123'
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Chat Personas
          </CardTitle>
          <CardDescription className="text-lg">
            Sign In
          </CardDescription>
          <p className="text-sm text-gray-600">
            Enter your credentials to access your AI chat personas
          </p>
        </CardHeader>
        
        <CardContent>
          {/* Admin Credentials Info */}
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Demo Access:</strong> Use the admin credentials to explore all AI personas.{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal text-blue-600"
                onClick={handleQuickLogin}
                disabled={isLoading}
              >
                Click here to auto-fill
              </Button>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="admin@bookbot-personas.com"
                required
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {(formError || error) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {formError || error}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              This is a shared demo account. Chat history is shared among all users.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 