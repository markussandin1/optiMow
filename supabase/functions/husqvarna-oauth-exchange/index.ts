import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OAuthExchangeRequest {
  code: string;
}

interface HusqvarnaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  user_id: string;
  provider: string;
}


serve(async (req) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: {
          hasClientId: !!Deno.env.get('HUSQVARNA_CLIENT_ID'),
          hasClientSecret: !!Deno.env.get('HUSQVARNA_CLIENT_SECRET'),
          hasRedirectUri: !!Deno.env.get('HUSQVARNA_REDIRECT_URI'),
          hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
          hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Get environment variables
    const HUSQVARNA_CLIENT_ID = Deno.env.get('HUSQVARNA_CLIENT_ID')
    const HUSQVARNA_CLIENT_SECRET = Deno.env.get('HUSQVARNA_CLIENT_SECRET')
    const HUSQVARNA_REDIRECT_URI = Deno.env.get('HUSQVARNA_REDIRECT_URI')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!HUSQVARNA_CLIENT_ID || !HUSQVARNA_CLIENT_SECRET || !HUSQVARNA_REDIRECT_URI) {
      throw new Error('Missing required Husqvarna environment variables')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables')
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse request body
    const requestBody = await req.json()
    console.log('OAuth exchange request body:', JSON.stringify(requestBody, null, 2))
    
    const { code }: OAuthExchangeRequest = requestBody

    if (!code) {
      console.error('Missing authorization code parameter')
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameter: code',
          received: { hasCode: !!code }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Exchange authorization code for tokens with Husqvarna API
    const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUSQVARNA_CLIENT_ID,
        client_secret: HUSQVARNA_CLIENT_SECRET,
        code: code,
        redirect_uri: HUSQVARNA_REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Husqvarna token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        requestParams: {
          grant_type: 'authorization_code',
          client_id: HUSQVARNA_CLIENT_ID,
          redirect_uri: HUSQVARNA_REDIRECT_URI,
          code: code.substring(0, 10) + '...' // Only log first 10 chars for security
        }
      })

      // Parse error details for better user feedback
      const errorMessage = 'Failed to exchange authorization code for tokens'
      let userFriendlyMessage = ''
      
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error_description) {
          userFriendlyMessage = errorData.error_description
        } else if (errorData.error) {
          userFriendlyMessage = errorData.error
        }
      } catch {
        // Not JSON, use raw text
        userFriendlyMessage = errorText || tokenResponse.statusText
      }

      // Common OAuth error interpretations
      if (tokenResponse.status === 400) {
        if (userFriendlyMessage.toLowerCase().includes('invalid_grant') || 
            userFriendlyMessage.toLowerCase().includes('authorization code')) {
          userFriendlyMessage = 'Authorization code has expired or was already used. Please try logging in again.'
        } else if (userFriendlyMessage.toLowerCase().includes('redirect_uri')) {
          userFriendlyMessage = 'OAuth configuration error. Please contact support.'
        }
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: `Husqvarna API returned ${tokenResponse.status}: ${tokenResponse.statusText}`,
          message: userFriendlyMessage || `Authentication failed (${tokenResponse.status})`
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const tokenData: HusqvarnaTokenResponse = await tokenResponse.json()
    console.log('Successfully exchanged authorization code for tokens:', {
      user_id: tokenData.user_id,
      provider: tokenData.provider,
      expires_in: tokenData.expires_in
    })

    // Extract user information from JWT token
    let userEmail: string | null = null
    try {
      // Parse JWT token to extract user info (JWT tokens contain base64 encoded JSON)
      const tokenParts = tokenData.access_token.split('.')
      if (tokenParts.length === 3) {
        // Decode the payload (second part of JWT)
        const payload = JSON.parse(atob(tokenParts[1]))
        console.log('JWT payload:', payload)
        
        // Common JWT claims for email: email, sub, username
        userEmail = payload.email || payload.sub || payload.username || tokenData.user_id
      }
    } catch (jwtError) {
      console.warn('Failed to parse JWT token:', jwtError)
    }

    // Fallback to user_id from token response if no email found in JWT
    if (!userEmail && tokenData.user_id) {
      userEmail = tokenData.user_id
      console.log('Using user_id as email fallback:', userEmail)
    }

    if (!userEmail) {
      console.error('No user identifier found in token response:', {
        hasUserId: !!tokenData.user_id,
        tokenStructure: Object.keys(tokenData)
      })
      return new Response(
        JSON.stringify({ 
          error: 'User identifier not found in authentication response',
          details: 'Unable to extract user email or ID from Husqvarna authentication token'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()

    // Store session in database with detailed error logging
    console.log('Attempting to insert session with data:', {
      user_email: userEmail,
      expires_at: expiresAt,
      access_token_length: tokenData.access_token.length,
      refresh_token_length: tokenData.refresh_token.length,
      expires_at_type: typeof expiresAt
    })

    // First, check if a session already exists for this user
    const { data: existingSession, error: checkError } = await supabase
      .from('auth_sessions')
      .select('session_id, user_email, created_at')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)

    if (checkError) {
      console.error('Database check error:', {
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint,
        code: checkError.code
      })
    } else if (existingSession && existingSession.length > 0) {
      console.log('Found existing session for user:', existingSession[0])
      
      // Update existing session instead of creating new one
      const { data: updatedSession, error: updateError } = await supabase
        .from('auth_sessions')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        })
        .eq('session_id', existingSession[0].session_id)
        .select()
        .single()

      if (updateError) {
        console.error('Database update error:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
          session_id: existingSession[0].session_id
        })
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update existing session in database',
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

      console.log('Successfully updated existing session:', updatedSession.session_id)
      
      // Return updated session info
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
    }

    // Create new session
    const { data: session, error: dbError } = await supabase
      .from('auth_sessions')
      .insert({
        user_email: userEmail,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insertion error details:', {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code,
        attempted_data: {
          user_email: userEmail,
          expires_at: expiresAt,
          access_token_type: typeof tokenData.access_token,
          refresh_token_type: typeof tokenData.refresh_token,
          access_token_length: tokenData.access_token ? tokenData.access_token.length : 0,
          refresh_token_length: tokenData.refresh_token ? tokenData.refresh_token.length : 0
        }
      })

      // Provide more specific error messages based on error codes
      let userMessage = 'Failed to create session in database'
      let httpStatus = 500

      if (dbError.code === '23505') { // Unique constraint violation
        userMessage = 'Session already exists for this user'
        httpStatus = 409
      } else if (dbError.code === '23502') { // Not null constraint violation
        userMessage = 'Missing required session data'
        httpStatus = 400
      } else if (dbError.code === '42501') { // Insufficient privilege
        userMessage = 'Database permission denied'
        httpStatus = 403
      } else if (dbError.code === '42P01') { // Undefined table
        userMessage = 'Database table not found - schema may not be applied'
        httpStatus = 500
      }

      return new Response(
        JSON.stringify({ 
          error: userMessage,
          details: dbError.message,
          code: dbError.code,
          hint: dbError.hint
        }),
        { 
          status: httpStatus,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Successfully created new session:', session.session_id)

    // Return session info (without sensitive tokens)
    const responseData = {
      success: true,
      session: {
        session_id: session.session_id,
        user_email: session.user_email,
        expires_at: session.expires_at,
        created_at: session.created_at,
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
    console.error('OAuth exchange error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during OAuth exchange',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})