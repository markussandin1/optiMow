// Scheduled Data Collection Edge Function
// Called by cron job every 5 minutes for automatic EPOS data collection

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] Scheduled collection triggered - Method: ${req.method}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!SUPABASE_URL) {
      console.error('❌ SUPABASE_URL environment variable not configured')
      throw new Error('SUPABASE_URL not configured in Edge Function environment')
    }
    
    if (!serviceRoleKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not configured')
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured in Edge Function environment')
    }

    console.log(`✅ Environment validated - Calling mower-discovery function`)
    
    // Call the mower-discovery function which handles the actual data collection
    const discoveryUrl = `${SUPABASE_URL}/functions/v1/mower-discovery`
    
    const response = await fetch(discoveryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey, // Include apikey header for Supabase authentication
      },
      body: JSON.stringify({
        sessionId: 'NO_USER', // Will find valid session automatically
        collectionMethod: 'scheduled'
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error(`❌ Mower-discovery function failed:`, {
        status: response.status,
        statusText: response.statusText,
        result
      })
      return new Response(
        JSON.stringify({ 
          error: 'Scheduled collection failed - mower-discovery function error',
          status: response.status,
          statusText: response.statusText,
          details: result,
          timestamp
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`✅ Scheduled collection completed successfully:`, {
      mowerCount: result.count || 0,
      timestamp
    })
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Scheduled collection completed',
        timestamp,
        result,
        mowerCount: result.count || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error(`🔥 Scheduled collection critical error:`, {
      message: error.message,
      stack: error.stack,
      timestamp
    })
    return new Response(
      JSON.stringify({ 
        error: 'Scheduled collection failed - critical error',
        message: error.message,
        timestamp,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})