import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { useMowerActions } from '@/stores/mowerStore';

export function CallbackPage() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  
  const authService = useMemo(() => new AuthService(), []);
  const { setLoading } = useAuthStore();
  const { reset: resetMowerStore } = useMowerActions();

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate processing (React development mode runs effects twice)
      if (hasProcessed.current) {
        return;
      }
      hasProcessed.current = true;

      try {
        setIsProcessing(true);
        setLoading(true);

        // Get OAuth parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
          throw new Error(`OAuth error: ${searchParams.get('error_description') || error}`);
        }

        // Validate required parameters
        if (!code) {
          throw new Error('Missing authorization code');
        }

        // Validate state parameter (for CSRF protection)
        if (!state) {
          throw new Error('Missing state parameter');
        }

        try {
          // Validate state parameter format (timestamp should be present)
          const stateData = JSON.parse(decodeURIComponent(state));
          if (!stateData.timestamp) {
            throw new Error('Invalid state format');
          }
        } catch {
          throw new Error('Invalid state parameter');
        }

        // Process OAuth callback - email will be fetched from Husqvarna user info API in Edge Function
        const session = await authService.handleOAuthCallback(code);

        // Update auth store with the email from the session (retrieved from Husqvarna API)
        useAuthStore.setState({
          user: { email: session.user_email, sessionId: session.session_id },
          session,
          error: null,
        });

        // Reset mower store to ensure fresh state for new session
        resetMowerStore();

        // Redirect to main app
        navigate('/dashboard', { replace: true });

      } catch (error) {
        console.error('OAuth callback error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        setError(errorMessage);
        
        // Clear any partial auth state
        useAuthStore.setState({
          user: null,
          session: null,
          error: errorMessage,
        });

      } finally {
        setIsProcessing(false);
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setLoading, authService, resetMowerStore]);

  const handleRetry = () => {
    // Reset the processing flag so user can retry
    hasProcessed.current = false;
    setError(null);
    setIsProcessing(true);
    navigate('/login', { replace: true });
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Connecting to Husqvarna...
              </h2>
              <p className="text-sm text-gray-600">
                Please wait while we complete your authentication.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {error}
              </p>
              <button
                onClick={handleRetry}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Should not reach here, but just in case
  return null;
}