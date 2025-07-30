import { AuthSessionsService } from '@/lib/database.service';
import { supabase } from '@/lib/supabase';
import type { AuthSession } from '@/lib/database.types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface HusqvarnaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export class AuthService {
  // Configuration from environment variables
  private readonly CLIENT_ID = import.meta.env.VITE_HUSQVARNA_CLIENT_ID;
  private readonly REDIRECT_URI = import.meta.env.VITE_HUSQVARNA_REDIRECT_URI;
  private readonly OAUTH_AUTHORIZE_URL = 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize';
  
  // Edge Function URLs
  private readonly OAUTH_EXCHANGE_FUNCTION = 'husqvarna-oauth-exchange';
  private readonly TOKEN_REFRESH_FUNCTION = 'husqvarna-token-refresh';

  /**
   * Initialize Husqvarna OAuth flow
   * Returns the authorization URL for redirect
   */
  async initiateHusqvarnaOAuth(): Promise<string> {
    try {
      // Create state parameter for OAuth flow (email will come from Husqvarna user info)
      const state = encodeURIComponent(JSON.stringify({ timestamp: Date.now() }));
      
      // Build OAuth authorization URL
      const params = new URLSearchParams({
        client_id: this.CLIENT_ID,
        response_type: 'code',
        scope: 'iam:read amc:api',
        redirect_uri: this.REDIRECT_URI,
        state: state
      });

      return `${this.OAUTH_AUTHORIZE_URL}?${params.toString()}`;
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      throw new Error('Failed to initialize Husqvarna authentication');
    }
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleOAuthCallback(code: string): Promise<AuthSession> {
    try {
      // Call Edge Function to exchange code for tokens and store session
      const { data, error } = await supabase.functions.invoke(this.OAUTH_EXCHANGE_FUNCTION, {
        body: { code }
      });

      if (error) {
        console.error('OAuth exchange failed:', error.message);
        
        // Try to extract the detailed error message from the response
        let detailedErrorMessage = 'Failed to exchange authorization code for tokens';
        
        if (error.context && typeof error.context.json === 'function') {
          try {
            const errorBody = await error.context.json();
            detailedErrorMessage = errorBody.message || errorBody.error || detailedErrorMessage;
          } catch {
            try {
              const errorText = await error.context.text();
              const errorData = JSON.parse(errorText);
              detailedErrorMessage = errorData.message || errorData.error || detailedErrorMessage;
            } catch {
              // Unable to parse error details
            }
          }
        }
        
        throw new Error(detailedErrorMessage);
      }

      if (!data || !data.success) {
        console.error('OAuth exchange unsuccessful:', data?.message || data?.error);
        const errorMessage = data?.message || data?.error || 'OAuth exchange failed';
        throw new Error(errorMessage);
      }

      // Get the full session from database using the returned session_id
      const session = await AuthSessionsService.getSession(data.session.session_id);
      if (!session) {
        throw new Error('Failed to retrieve created session');
      }

      return session;
    } catch (error) {
      console.error('OAuth callback failed:', error);
      throw new Error('Failed to complete authentication');
    }
  }

  /**
   * Get current session by email
   */
  async getCurrentSession(email: string): Promise<AuthSession | null> {
    try {
      return await AuthSessionsService.getSessionByEmail(email);
    } catch (error) {
      console.error('Failed to get current session:', error);
      return null;
    }
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(sessionId: string): Promise<AuthSession> {
    try {
      // Call Edge Function to refresh tokens
      const { data, error } = await supabase.functions.invoke(this.TOKEN_REFRESH_FUNCTION, {
        body: { sessionId }
      });

      if (error) {
        console.error('Token refresh Edge Function error:', error);
        throw new Error('Failed to refresh tokens');
      }

      if (!data.success) {
        throw new Error(data.error || 'Token refresh failed');
      }

      // Get the updated session from database
      const updatedSession = await AuthSessionsService.getSession(sessionId);
      if (!updatedSession) {
        throw new Error('Failed to retrieve updated session');
      }

      return updatedSession;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('Failed to refresh authentication tokens');
    }
  }

  /**
   * Check if session is valid and not expired
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      const session = await AuthSessionsService.getSession(sessionId);
      if (!session) {
        return false;
      }

      const expiresAt = new Date(session.expires_at);
      const now = new Date();
      
      // Consider session invalid if it expires in less than 5 minutes
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      return expiresAt.getTime() > now.getTime() + bufferTime;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Logout and clean up session
   */
  async logout(sessionId: string): Promise<void> {
    try {
      await AuthSessionsService.deleteSession(sessionId);
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error('Failed to logout');
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(sessionId: string): Promise<string> {
    try {
      const isValid = await this.isSessionValid(sessionId);
      
      if (!isValid) {
        // Try to refresh tokens
        const refreshed = await this.refreshTokens(sessionId);
        return refreshed.access_token;
      }

      const session = await AuthSessionsService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      return session.access_token;
    } catch (error) {
      console.error('Failed to get valid access token:', error);
      throw new Error('Authentication required');
    }
  }

}