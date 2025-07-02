import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContextType, User } from '@/types';
import { supabase } from '@/lib/supabase';
import { AUTH_SETTINGS, ERROR_MESSAGES } from '@/config/constants';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          setError(ERROR_MESSAGES.AUTH_ERROR);
        } else {
          setSession(session);
          setUser(session?.user ? {
            id: session.user.id,
            email: session.user.email || '',
            created_at: session.user.created_at || '',
            updated_at: session.user.updated_at || ''
          } : null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError(ERROR_MESSAGES.AUTH_ERROR);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user ? {
          id: session.user.id,
          email: session.user.email || '',
          created_at: session.user.created_at || '',
          updated_at: session.user.updated_at || ''
        } : null);
        setError(null);

        if (event === 'SIGNED_IN') {
          // Redirect to main app after sign in
          if (AUTH_SETTINGS.SIGN_IN_REDIRECT_URL !== window.location.pathname) {
            window.location.href = AUTH_SETTINGS.SIGN_IN_REDIRECT_URL;
          }
        } else if (event === 'SIGNED_OUT') {
          // Redirect to login after sign out
          if (AUTH_SETTINGS.SIGN_OUT_REDIRECT_URL !== window.location.pathname) {
            window.location.href = AUTH_SETTINGS.SIGN_OUT_REDIRECT_URL;
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setError(error.message || ERROR_MESSAGES.AUTH_ERROR);
        throw error;
      }

      return data;
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || ERROR_MESSAGES.AUTH_ERROR);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${AUTH_SETTINGS.SIGN_IN_REDIRECT_URL}`
        }
      });

      if (error) {
        setError(error.message || ERROR_MESSAGES.AUTH_ERROR);
        throw error;
      }

      // If email confirmation is required, show message
      if (AUTH_SETTINGS.EMAIL_CONFIRMATION_REQUIRED && !session) {
        setError(null); // Clear any error as this is expected
      }

      return data;
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || ERROR_MESSAGES.AUTH_ERROR);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message || ERROR_MESSAGES.AUTH_ERROR);
        throw error;
      }
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || ERROR_MESSAGES.AUTH_ERROR);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        setError(error.message || ERROR_MESSAGES.AUTH_ERROR);
        throw error;
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || ERROR_MESSAGES.AUTH_ERROR);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 