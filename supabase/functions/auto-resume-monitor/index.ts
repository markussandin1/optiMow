import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutoResumeTracking {
  id: string
  mower_id: string
  enabled: boolean
  last_error_detected_at: string | null
  last_resume_attempted_at: string | null
  current_attempt_count: number
  last_error_state: string | null
  fatal_error_detected_at: string | null
  manual_intervention_required: boolean
}

interface MowerStatus {
  id: string
  attributes: {
    system: {
      name: string
    }
    battery: {
      batteryPercent: number
    }
    mower: {
      mode: string
      activity: string
      state: string
      errorCode: number
      errorCodeTimestamp: number
      isErrorConfirmable: boolean
    }
    planner: {
      nextStartTimestamp: number
      restrictedReason: string
    }
    calendar: {
      tasks: Array<{
        start: number
        duration: number
        monday: boolean
        tuesday: boolean
        wednesday: boolean
        thursday: boolean
        friday: boolean
        saturday: boolean
        sunday: boolean
      }>
    }
    settings: {
      cuttingHeight: number
      headlight: {
        mode: string
      }
    }
  }
}

// Use Husqvarna API's own assessment of error confirmability
function isErrorConfirmable(mowerStatus: MowerStatus): boolean {
  // Use the API's own assessment - much more reliable than hardcoded lists
  return mowerStatus.attributes.mower.isErrorConfirmable === true;
}

async function getMowerStatus(accessToken: string, mowerId: string): Promise<MowerStatus | null> {
  try {
    const response = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': Deno.env.get('HUSQVARNA_CLIENT_ID') || '',
        'Content-Type': 'application/vnd.api+json',
      },
    })

    if (!response.ok) {
      console.error(`Failed to get mower status for ${mowerId}:`, response.status, response.statusText)
      return null
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error(`Error getting mower status for ${mowerId}:`, error)
    return null
  }
}

async function confirmErrorAndResume(accessToken: string, mowerId: string): Promise<boolean> {
  try {
    // First, confirm the error using the proper endpoint
    const confirmResponse = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/errors/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': Deno.env.get('HUSQVARNA_CLIENT_ID') || '',
        'Content-Type': 'application/vnd.api+json',
      }
    })

    if (!confirmResponse.ok) {
      console.error(`Failed to confirm error for ${mowerId}:`, confirmResponse.status, confirmResponse.statusText)
      return false
    }

    console.log(`Successfully confirmed error for mower ${mowerId}`)

    // Wait a moment for the error confirmation to process
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Then send resume schedule command
    const resumeResponse = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': Deno.env.get('HUSQVARNA_CLIENT_ID') || '',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'ResumeSchedule'
        }
      })
    })

    if (!resumeResponse.ok) {
      console.log(`Note: Error confirmed but resume schedule failed for ${mowerId}:`, resumeResponse.status, resumeResponse.statusText)
      // Still return true since error confirmation succeeded
      return true
    }

    console.log(`Successfully confirmed error and resumed schedule for mower ${mowerId}`)
    return true
  } catch (error) {
    console.error(`Error confirming error and resuming for ${mowerId}:`, error)
    return false
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('🔄 Starting auto-resume monitor check...')

    // Get all mowers with auto-resume enabled
    const { data: enabledMowers, error: enabledError } = await supabase
      .from('auto_resume_tracking')
      .select(`
        *,
        mower_profiles!inner(
          husqvarna_id,
          auth_sessions!inner(
            access_token,
            expires_at
          )
        )
      `)
      .eq('enabled', true)
      .eq('manual_intervention_required', false)

    if (enabledError) {
      console.error('Error fetching enabled auto-resume mowers:', enabledError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch auto-resume enabled mowers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!enabledMowers || enabledMowers.length === 0) {
      console.log('ℹ️ No mowers with auto-resume enabled')
      return new Response(
        JSON.stringify({ message: 'No mowers with auto-resume enabled', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${enabledMowers.length} mowers with auto-resume enabled`)

    const results = []
    const now = new Date()

    for (const mowerTracking of enabledMowers) {
      const mowerId = mowerTracking.mower_id
      console.log(`🔍 Checking mower ${mowerId}...`)

      // Get access token from the joined data
      const mowerProfile = (mowerTracking as any).mower_profiles
      const authSession = mowerProfile.auth_sessions

      if (!authSession || !authSession.access_token) {
        console.error(`No valid auth session for mower ${mowerId}`)
        continue
      }

      // Check if token is expired
      const expiresAt = new Date(authSession.expires_at)
      if (expiresAt <= now) {
        console.error(`Access token expired for mower ${mowerId}`)
        continue
      }

      // Get current mower status
      const mowerStatus = await getMowerStatus(authSession.access_token, mowerId)
      if (!mowerStatus) {
        console.error(`Failed to get status for mower ${mowerId}`)
        continue
      }

      const currentState = mowerStatus.attributes.mower.state
      console.log(`Mower ${mowerId} current state: ${currentState}`)

      // Check if mower recovered from error
      if (mowerTracking.last_error_state && 
          !['ERROR', 'FATAL_ERROR', 'ERROR_AT_POWER_UP'].includes(currentState)) {
        console.log(`✅ Mower ${mowerId} recovered from error, resetting attempt counter`)
        
        // Reset error tracking
        await supabase
          .from('auto_resume_tracking')
          .update({
            current_attempt_count: 0,
            last_error_detected_at: null,
            last_error_state: null,
            last_resume_attempted_at: null
          })
          .eq('mower_id', mowerId)

        // Log the recovery
        await supabase
          .from('auto_resume_attempts')
          .insert({
            mower_id: mowerId,
            error_state: currentState,
            action_taken: 'RESET_COUNTER',
            success: true,
            attempt_number: 0,
            response_data: { message: 'Mower recovered from error state' }
          })

        results.push({ mowerId, action: 'reset_counter', success: true })
        continue
      }

      // Handle fatal errors
      if (currentState === 'FATAL_ERROR' || currentState === 'ERROR_AT_POWER_UP') {
        console.log(`🚨 Fatal error detected for mower ${mowerId}: ${currentState}`)
        
        await supabase
          .from('auto_resume_tracking')
          .update({
            fatal_error_detected_at: now.toISOString(),
            manual_intervention_required: true,
            last_error_state: currentState
          })
          .eq('mower_id', mowerId)

        await supabase
          .from('auto_resume_attempts')
          .insert({
            mower_id: mowerId,
            error_state: currentState,
            action_taken: 'FATAL_ERROR_DETECTED',
            success: false,
            attempt_number: mowerTracking.current_attempt_count + 1,
            response_data: { error: 'Fatal error detected, manual intervention required' }
          })

        results.push({ mowerId, action: 'fatal_error_detected', success: false })
        continue
      }

      // Handle errors using Husqvarna API's own assessment
      if (currentState === 'ERROR') {
        const errorCode = mowerStatus.attributes.mower.errorCode;
        const canConfirm = isErrorConfirmable(mowerStatus);
        
        console.log(`🔴 Error detected for mower ${mowerId}: Code ${errorCode}, Confirmable: ${canConfirm}, State: ${currentState}`);
        
        // Use Husqvarna's own assessment - if not confirmable, require manual intervention
        if (!canConfirm) {
          console.log(`🚨 Error code ${errorCode} not confirmable by Husqvarna API for mower ${mowerId} - requires manual intervention`);
          
          await supabase
            .from('auto_resume_tracking')
            .update({
              fatal_error_detected_at: now.toISOString(),
              manual_intervention_required: true,
              last_error_state: currentState
            })
            .eq('mower_id', mowerId);
            
          // Log the non-confirmable error
          await supabase
            .from('auto_resume_attempts')
            .insert({
              mower_id: mowerId,
              error_state: currentState,
              action_taken: 'ERROR_NOT_CONFIRMABLE',
              success: false,
              attempt_number: mowerTracking.current_attempt_count + 1,
              response_data: { error: `Error code ${errorCode} not confirmable by Husqvarna API`, errorCode, isErrorConfirmable: canConfirm }
            });
            
          results.push({ mowerId, action: 'error_not_confirmable', success: false, errorCode });
          continue;
        }

        // Proceed with auto-resume logic for confirmable errors
        console.log(`✅ Error code ${errorCode} is confirmable by Husqvarna API - proceeding with auto-resume logic`);
        
        // Check if this is a new error or continuing previous error
        const isNewError = mowerTracking.last_error_state !== 'ERROR'
        
        if (isNewError) {
          console.log(`🔴 New recoverable error detected for mower ${mowerId}: Code ${errorCode}`)
          // Update tracking for new error
          await supabase
            .from('auto_resume_tracking')
            .update({
              last_error_detected_at: now.toISOString(),
              last_error_state: currentState,
              current_attempt_count: 0
            })
            .eq('mower_id', mowerId)
        }

        // Check if we should attempt resume
        const shouldAttempt = mowerTracking.current_attempt_count < 3
        
        // Check if enough time has passed since last attempt (5 minutes)
        let enoughTimePassed = true
        if (mowerTracking.last_resume_attempted_at) {
          const lastAttempt = new Date(mowerTracking.last_resume_attempted_at)
          const timeDiff = now.getTime() - lastAttempt.getTime()
          const fiveMinutesInMs = 5 * 60 * 1000
          enoughTimePassed = timeDiff >= fiveMinutesInMs
        }

        if (shouldAttempt && enoughTimePassed) {
          console.log(`🔄 Attempting auto-resume for mower ${mowerId} (attempt ${mowerTracking.current_attempt_count + 1}/3) - Error code: ${errorCode}`)
          
          const resumeSuccess = await confirmErrorAndResume(authSession.access_token, mowerId)
          const newAttemptCount = mowerTracking.current_attempt_count + 1

          // Update tracking
          await supabase
            .from('auto_resume_tracking')
            .update({
              last_resume_attempted_at: now.toISOString(),
              current_attempt_count: newAttemptCount
            })
            .eq('mower_id', mowerId)

          // Log attempt
          await supabase
            .from('auto_resume_attempts')
            .insert({
              mower_id: mowerId,
              error_state: currentState,
              action_taken: 'CONFIRM_ERROR_AND_RESUME',
              success: resumeSuccess,
              attempt_number: newAttemptCount,
              response_data: resumeSuccess ? 
                { message: 'Error confirmed and resume command sent successfully', errorCode, isErrorConfirmable: canConfirm } : 
                { error: 'Failed to confirm error and send resume command', errorCode, isErrorConfirmable: canConfirm }
            })

          results.push({ 
            mowerId, 
            action: 'resume_attempted', 
            success: resumeSuccess,
            attemptNumber: newAttemptCount,
            errorCode
          })
        } else if (!shouldAttempt) {
          console.log(`⚠️ Max attempts reached for mower ${mowerId} (error code: ${errorCode}), requiring manual intervention`)
          
          await supabase
            .from('auto_resume_tracking')
            .update({
              manual_intervention_required: true
            })
            .eq('mower_id', mowerId)

          results.push({ mowerId, action: 'max_attempts_reached', success: false, errorCode })
        } else {
          console.log(`⏳ Waiting for cooldown period for mower ${mowerId} (error code: ${errorCode})`)
          results.push({ mowerId, action: 'waiting_cooldown', success: true, errorCode })
        }
      } else {
        // Mower is in normal state
        results.push({ mowerId, action: 'normal_state', success: true })
      }
    }

    console.log(`✅ Auto-resume monitor completed. Processed ${results.length} mowers`)

    return new Response(
      JSON.stringify({ 
        message: 'Auto-resume monitor completed',
        processed: results.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Auto-resume monitor error:', error)
    return new Response(
      JSON.stringify({ error: 'Auto-resume monitor failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})