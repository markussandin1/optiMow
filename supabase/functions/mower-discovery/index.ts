import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HusqvarnaMower {
  id: string;
  attributes: {
    system: {
      name: string;
      model: string;
      serialNumber: number;
    };
    battery: {
      batteryPercent: number;
    };
    mower: {
      mode: string;
      activity: string;
      state: string;
      errorCode: number;
      errorCodeTimestamp: number;
      lastErrorCodeTimestamp?: number; // Local time timestamp for last error code
      workAreaId?: number; // Current work area id when mower is working on a specific area
    };
    calendar: {
      tasks: Array<{
        start: number;
        duration: number;
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
        sunday: boolean;
        workAreaId?: number;
      }>;
    };
    positions: Array<{
      latitude: number;
      longitude: number;
      timestamp: number;
    }>;
    settings: {
      cuttingHeight: number;
      headlight: {
        mode: string;
      };
    };
    statistics: {
      cuttingBladeUsageTime: number;
      numberOfChargingCycles: number;
      numberOfCollisions: number;
      totalChargingTime: number;
      totalCuttingTime: number;
      totalRunningTime: number;
      totalSearchingTime: number;
    };
    workAreas: Array<{
      workAreaId: number;
      name: string;
      cuttingHeight: number;
      enabled: boolean;
      progress?: number;
      lastTimeCompleted?: number | null; // Timestamp in seconds when area was last completed (EPOS only)
    }>;
    metadata?: {
      statusTimestamp?: number; // UTC timestamp for last status update from backend
    };
  };
}

interface HusqvarnaMowersResponse {
  data: HusqvarnaMower[];
}

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables')
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse request body
    const requestBody = await req.json()
    let { sessionId, collectionMethod = 'manual' } = requestBody

    if (!sessionId || sessionId === 'NO_USER') {
      // For automated collection, use the most recent valid session
      console.log('No sessionId provided or NO_USER detected, looking for valid session...')
      
      const { data: recentSession } = await supabase
        .from('auth_sessions')
        .select('session_id')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!recentSession) {
        return new Response(
          JSON.stringify({ 
            error: 'No valid session available for automated collection. Please login to create a session.' 
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      sessionId = recentSession.session_id
      console.log(`Using session ${sessionId} for automated collection`)
    }

    // Get session and access token from database
    const { data: session, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('session_id, user_email, access_token, expires_at')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      return new Response(
        JSON.stringify({ 
          error: 'Session not found or expired' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if token is still valid
    const expiresAt = new Date(session.expires_at)
    const now = new Date()
    if (expiresAt <= now) {
      return new Response(
        JSON.stringify({ 
          error: 'Access token expired. Please refresh your session.' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Fetching mowers for user: ${session.user_email}`)

    // Track API response time for monitoring
    const apiStartTime = Date.now()

    // Fetch mowers from Husqvarna Connect API
    const mowersResponse = await fetch('https://api.amc.husqvarna.dev/v1/mowers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': Deno.env.get('HUSQVARNA_CLIENT_ID') || '',
        'Content-Type': 'application/vnd.api+json',
      },
    })

    const apiResponseTime = Date.now() - apiStartTime

    if (!mowersResponse.ok) {
      const errorText = await mowersResponse.text()
      console.error('Husqvarna mowers API failed:', {
        status: mowersResponse.status,
        statusText: mowersResponse.statusText,
        error: errorText
      })

      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch mowers from Husqvarna API',
          details: `API returned ${mowersResponse.status}: ${mowersResponse.statusText}`,
          message: mowersResponse.status === 401 ? 'Authorization expired. Please login again.' : 'Unable to fetch mower data'
        }),
        { 
          status: mowersResponse.status === 401 ? 401 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const mowersData: HusqvarnaMowersResponse = await mowersResponse.json()
    console.log(`Found ${mowersData.data.length} mowers for user ${session.user_email}`)

    // Store EPOS data snapshots for historical tracking
    const collectedAt = now.toISOString()
    
    for (const mower of mowersData.data) {
      try {
        // Map Husqvarna data to our EPOS schema
        const latestPosition = mower.attributes.positions && mower.attributes.positions.length > 0 
          ? mower.attributes.positions[0] 
          : null

        // Transform work areas to our format
        const workAreas = (mower.attributes.workAreas || []).map(area => ({
          id: area.workAreaId,
          name: area.name,
          progress: area.progress || 0,
          enabled: area.enabled,
          cutting_height: area.cuttingHeight,
          lastTimeCompleted: area.lastTimeCompleted || null
        }))

        const snapshotData = {
          mower_id: mower.id,
          activity: mower.attributes.mower.activity,
          mode: mower.attributes.mower.mode,
          state: mower.attributes.mower.state,
          battery_level: mower.attributes.battery.batteryPercent,
          error_code: mower.attributes.mower.errorCode || 0,
          work_areas: workAreas,
          total_cutting_time: mower.attributes.statistics?.totalCuttingTime || 0,
          total_running_time: mower.attributes.statistics?.totalRunningTime || 0,
          total_charging_time: mower.attributes.statistics?.totalChargingTime || 0,
          latitude: latestPosition?.latitude || null,
          longitude: latestPosition?.longitude || null,
          status_timestamp: mower.attributes.metadata?.statusTimestamp || null,
          last_error_timestamp: mower.attributes.mower?.lastErrorCodeTimestamp || null,
          current_work_area_id: mower.attributes.mower?.workAreaId || null,
          is_error_confirmable: mower.attributes.mower?.isErrorConfirmable || null,
          collected_at: collectedAt,
          api_response_time_ms: apiResponseTime,
          collection_method: collectionMethod // 'manual' from frontend, 'scheduled' from cron
        }

        // Store snapshot data with duplicate handling (don't let storage errors break the main function)
        console.log(`Attempting to store EPOS snapshot for mower ${mower.id}:`, {
          mower_name: mower.attributes.system.name,
          activity: snapshotData.activity,
          work_areas_count: snapshotData.work_areas.length,
          collection_method: snapshotData.collection_method
        })

        const { error: snapshotError } = await supabase
          .from('epos_data_snapshots')
          .upsert(snapshotData, {
            onConflict: 'mower_id, date_trunc(\'minute\', collected_at)',
            ignoreDuplicates: true
          })

        if (snapshotError) {
          // Check if it's a constraint violation (duplicate) - this is expected behavior
          if (snapshotError.code === '23505' || snapshotError.message?.includes('unique_mower_minute')) {
            console.log(`⏭️ Skipped duplicate snapshot for mower ${mower.id} (already collected this minute)`)
          } else {
            console.error(`Failed to store snapshot for mower ${mower.id}:`, snapshotError)
            console.error('Snapshot data that failed:', snapshotData)
          }
          // Continue processing - don't let storage errors break discovery
        } else {
          console.log(`✅ Successfully stored EPOS snapshot for mower: ${mower.attributes.system.name}`)
        }

      } catch (error) {
        console.error(`Error processing snapshot for mower ${mower.id}:`, error)
        // Continue with other mowers
      }
    }

    // Process and store mower profiles
    const storedMowers = []
    
    for (const mower of mowersData.data) {
      const mowerProfile = {
        session_id: session.session_id,
        husqvarna_id: mower.id,
        name: mower.attributes.system.name,
        model: mower.attributes.system.model,
      }

      // Check if mower already exists
      const { data: existingMower, error: checkError } = await supabase
        .from('mower_profiles')
        .select('id, husqvarna_id, name, model')
        .eq('husqvarna_id', mower.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking existing mower:', checkError)
        continue // Skip this mower but continue with others
      }

      if (existingMower) {
        // Update existing mower profile
        const { data: updatedMower, error: updateError } = await supabase
          .from('mower_profiles')
          .update({
            name: mowerProfile.name,
            model: mowerProfile.model,
          })
          .eq('id', existingMower.id)
          .select()
          .single()

        if (updateError) {
          console.error('Error updating mower profile:', updateError)
          continue
        }

        console.log(`Updated existing mower: ${updatedMower.name} (${updatedMower.husqvarna_id})`)
        storedMowers.push(updatedMower)
      } else {
        // Create new mower profile
        const { data: newMower, error: createError } = await supabase
          .from('mower_profiles')
          .insert(mowerProfile)
          .select()
          .single()

        if (createError) {
          console.error('Error creating mower profile:', createError)
          continue
        }

        console.log(`Created new mower: ${newMower.name} (${newMower.husqvarna_id})`)
        storedMowers.push(newMower)
      }
    }

    // Return the stored mower profiles along with current status from Husqvarna API
    const dataCollectedAt = now.toISOString()
    const mowersWithStatus = storedMowers.map(mower => {
      const husqvarnaMower = mowersData.data.find(m => m.id === mower.husqvarna_id)
      
      return {
        ...mower,
        current_status: husqvarnaMower ? {
          activity: husqvarnaMower.attributes.mower.activity,
          mode: husqvarnaMower.attributes.mower.mode,
          state: husqvarnaMower.attributes.mower.state,
          battery_percent: husqvarnaMower.attributes.battery.batteryPercent,
          error_code: husqvarnaMower.attributes.mower.errorCode,
          last_position: husqvarnaMower.attributes.positions && husqvarnaMower.attributes.positions.length > 0 
            ? {
                latitude: husqvarnaMower.attributes.positions[0].latitude,
                longitude: husqvarnaMower.attributes.positions[0].longitude,
                timestamp: husqvarnaMower.attributes.positions[0].timestamp || 0
              }
            : null,
          work_areas: husqvarnaMower.attributes.workAreas || [],
          data_collected_at: dataCollectedAt
        } : null
      }
    })

    const responseData = {
      success: true,
      mowers: mowersWithStatus,
      count: storedMowers.length
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Mower discovery error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during mower discovery',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})