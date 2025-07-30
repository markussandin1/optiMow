import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenRefreshRequest {
  sessionId: string;
}

interface HusqvarnaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const HUSQVARNA_CLIENT_ID = Deno.env.get('HUSQVARNA_CLIENT_ID')
    const HUSQVARNA_CLIENT_SECRET = Deno.env.get('HUSQVARNA_CLIENT_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!HUSQVARNA_CLIENT_ID || !HUSQVARNA_CLIENT_SECRET) {
      throw new Error('Missing required Husqvarna environment variables')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables')
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse request body
    const { sessionId }: TokenRefreshRequest = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: sessionId' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get current session from database
    const { data: session, error: fetchError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (fetchError || !session) {
      console.error('Session fetch error:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Refresh tokens with Husqvarna API
    const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: HUSQVARNA_CLIENT_ID,
        client_secret: HUSQVARNA_CLIENT_SECRET,
        refresh_token: session.refresh_token,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Husqvarna token refresh failed:', tokenResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to refresh tokens' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const tokenData: HusqvarnaTokenResponse = await tokenResponse.json()

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()

    // Update session in database with new tokens
    const { data: updatedSession, error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || session.refresh_token, // Use new or keep existing
        expires_at: expiresAt,
      })
      .eq('session_id', sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
        session_id: sessionId
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update session in database',
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return updated session info (without sensitive tokens)
    const responseData = {
      success: true,
      session: {
        session_id: updatedSession.session_id,
        user_email: updatedSession.user_email,
        expires_at: updatedSession.expires_at,
        created_at: updatedSession.created_at,
      }
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Token refresh error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error during token refresh' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})