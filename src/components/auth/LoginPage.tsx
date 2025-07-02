import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { AUTH_SETTINGS } from '@/config/constants';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, resetPassword, isLoading, error } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [formMode, setFormMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    if (formMode !== 'reset') {
      if (!formData.password) {
        setFormError('Password is required');
        return false;
      }

      if (formData.password.length < AUTH_SETTINGS.PASSWORD_MIN_LENGTH) {
        setFormError(`Password must be at least ${AUTH_SETTINGS.PASSWORD_MIN_LENGTH} characters long`);
        return false;
      }

      if (formMode === 'signup' && formData.password !== formData.confirmPassword) {
        setFormError('Passwords do not match');
        return false;
      }
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
      setSuccessMessage(null);

      if (formMode === 'login') {
        await signIn(formData.email, formData.password);
      } else if (formMode === 'signup') {
        await signUp(formData.email, formData.password);
        
        if (AUTH_SETTINGS.EMAIL_CONFIRMATION_REQUIRED) {
          setSuccessMessage('Please check your email for a confirmation link before signing in.');
          setFormMode('login');
        }
      } else if (formMode === 'reset') {
        await resetPassword(formData.email);
        setSuccessMessage('Password reset email sent. Please check your inbox.');
        setFormMode('login');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', confirmPassword: '' });
    setFormError(null);
    setSuccessMessage(null);
  };

  const switchMode = (mode: 'login' | 'signup' | 'reset') => {
    setFormMode(mode);
    resetForm();
  };

  const getTitle = () => {
    switch (formMode) {
      case 'login':
        return 'Sign In';
      case 'signup':
        return 'Create Account';
      case 'reset':
        return 'Reset Password';
      default:
        return 'Sign In';
    }
  };

  const getDescription = () => {
    switch (formMode) {
      case 'login':
        return 'Enter your credentials to access your AI chat personas';
      case 'signup':
        return 'Create a new account to start chatting with AI personas';
      case 'reset':
        return 'Enter your email to receive a password reset link';
      default:
        return 'Enter your credentials to access your AI chat personas';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Chat Personas
          </CardTitle>
          <CardDescription className="text-lg">
            {getTitle()}
          </CardDescription>
          <p className="text-sm text-gray-600">
            {getDescription()}
          </p>
        </CardHeader>
        
        <CardContent>
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
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            {formMode !== 'reset' && (
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
            )}

            {/* Confirm Password Field */}
            {formMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Error Display */}
            {(formError || error) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {formError || error}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {successMessage && (
              <Alert>
                <AlertDescription>
                  {successMessage}
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
                  Please wait...
                </>
              ) : (
                getTitle()
              )}
            </Button>
          </form>

          {/* Mode Switching */}
          <div className="mt-6 text-center space-y-2">
            {formMode === 'login' && (
              <>
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => switchMode('signup')}
                    disabled={isLoading}
                  >
                    Sign up
                  </Button>
                </p>
                <p className="text-sm text-gray-600">
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => switchMode('reset')}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </Button>
                </p>
              </>
            )}

            {formMode === 'signup' && (
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => switchMode('login')}
                  disabled={isLoading}
                >
                  Sign in
                </Button>
              </p>
            )}

            {formMode === 'reset' && (
              <p className="text-sm text-gray-600">
                Remember your password?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => switchMode('login')}
                  disabled={isLoading}
                >
                  Sign in
                </Button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 