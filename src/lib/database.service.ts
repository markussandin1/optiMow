import { supabase } from './supabase';
import type {
  AuthSession,
  AuthSessionInsert,
  AuthSessionUpdate,
  MowerProfile,
  MowerProfileInsert,
  MowerProfileUpdate,
  MowerProfileWithSession,
  SessionWithMowers
} from './database.types';

// Auth Sessions Service
export class AuthSessionsService {
  /**
   * Create a new authentication session
   */
  static async createSession(session: AuthSessionInsert): Promise<AuthSession | null> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      console.error('Error creating auth session:', error);
      throw new Error(`Failed to create auth session: ${error.message}`);
    }

    return data;
  }

  /**
   * Get session by session ID
   */
  static async getSession(sessionId: string): Promise<AuthSession | null> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching auth session:', error);
      throw new Error(`Failed to fetch auth session: ${error.message}`);
    }

    return data;
  }

  /**
   * Get session by user email (most recent)
   */
  static async getSessionByEmail(email: string): Promise<AuthSession | null> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching auth session by email:', error);
      throw new Error(`Failed to fetch auth session: ${error.message}`);
    }

    return data;
  }

  /**
   * Update session tokens
   */
  static async updateSession(
    sessionId: string, 
    updates: AuthSessionUpdate
  ): Promise<AuthSession | null> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .update(updates)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating auth session:', error);
      throw new Error(`Failed to update auth session: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('auth_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error deleting auth session:', error);
      throw new Error(`Failed to delete auth session: ${error.message}`);
    }

    return true;
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('session_id');

    if (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }

    return data?.length || 0;
  }
}

// Mower Profiles Service
export class MowerProfilesService {
  /**
   * Create a new mower profile
   */
  static async createMowerProfile(profile: MowerProfileInsert): Promise<MowerProfile | null> {
    const { data, error } = await supabase
      .from('mower_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error creating mower profile:', error);
      throw new Error(`Failed to create mower profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Get mower profiles for a session
   */
  static async getMowersBySession(sessionId: string): Promise<MowerProfile[]> {
    const { data, error } = await supabase
      .from('mower_profiles')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching mower profiles:', error);
      throw new Error(`Failed to fetch mower profiles: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get mower profile by Husqvarna ID
   */
  static async getMowerByHusqvarnaId(husqvarnaId: string): Promise<MowerProfileWithSession | null> {
    const { data, error } = await supabase
      .from('mower_profiles')
      .select(`
        *,
        auth_sessions (*)
      `)
      .eq('husqvarna_id', husqvarnaId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching mower profile:', error);
      throw new Error(`Failed to fetch mower profile: ${error.message}`);
    }

    return data as MowerProfileWithSession | null;
  }

  /**
   * Update mower profile
   */
  static async updateMowerProfile(
    mowerId: string, 
    updates: MowerProfileUpdate
  ): Promise<MowerProfile | null> {
    const { data, error } = await supabase
      .from('mower_profiles')
      .update(updates)
      .eq('id', mowerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating mower profile:', error);
      throw new Error(`Failed to update mower profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete mower profile
   */
  static async deleteMowerProfile(mowerId: string): Promise<boolean> {
    const { error } = await supabase
      .from('mower_profiles')
      .delete()
      .eq('id', mowerId);

    if (error) {
      console.error('Error deleting mower profile:', error);
      throw new Error(`Failed to delete mower profile: ${error.message}`);
    }

    return true;
  }

  /**
   * Get session with all associated mowers
   */
  static async getSessionWithMowers(sessionId: string): Promise<SessionWithMowers | null> {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select(`
        *,
        mower_profiles (*)
      `)
      .eq('session_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching session with mowers:', error);
      throw new Error(`Failed to fetch session with mowers: ${error.message}`);
    }

    return data as SessionWithMowers | null;
  }
}

// Auto-Resume Service
export class AutoResumeService {
  /**
   * Get auto-resume settings for a mower
   */
  static async getAutoResumeSettings(mowerId: string): Promise<any | null> {
    try {
      const { data, error } = await (supabase as any)
        .from('auto_resume_tracking')
        .select('*')
        .eq('mower_id', mowerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching auto-resume settings:', error);
        throw new Error(`Failed to fetch auto-resume settings: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error('Exception in getAutoResumeSettings:', err);
      throw err;
    }
  }

  /**
   * Enable or disable auto-resume for a mower
   */
  static async setAutoResumeEnabled(mowerId: string, enabled: boolean): Promise<any> {
    try {
      
      // First try to update existing record
      const { data: updateData, error: updateError } = await (supabase as any)
        .from('auto_resume_tracking')
        .update({
          enabled: enabled,
          // Reset intervention flag when enabling
          manual_intervention_required: enabled ? false : undefined
        })
        .eq('mower_id', mowerId)
        .select()
        .single();

      if (updateError && updateError.code === 'PGRST116') {
        // No existing record, create new one
        const { data: insertData, error: insertError } = await (supabase as any)
          .from('auto_resume_tracking')
          .insert({
            mower_id: mowerId,
            enabled: enabled,
            manual_intervention_required: false
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting auto-resume settings:', insertError);
          throw new Error(`Failed to create auto-resume settings: ${insertError.message}`);
        }

        return insertData;
      } else if (updateError) {
        console.error('Error updating auto-resume settings:', updateError);
        throw new Error(`Failed to update auto-resume settings: ${updateError.message}`);
      }

      return updateData;
    } catch (err) {
      console.error('Exception in setAutoResumeEnabled:', err);
      throw err;
    }
  }

  /**
   * Reset manual intervention flag (when user manually fixes mower)
   */
  static async resetManualIntervention(mowerId: string): Promise<any> {
    const { data, error } = (await supabase as any)
      .from('auto_resume_tracking')
      .update({
        manual_intervention_required: false,
        current_attempt_count: 0,
        last_error_detected_at: null,
        last_error_state: null,
        last_resume_attempted_at: null,
        fatal_error_detected_at: null
      })
      .eq('mower_id', mowerId)
      .select()
      .single();

    if (error) {
      console.error('Error resetting manual intervention:', error);
      throw new Error(`Failed to reset manual intervention: ${error.message}`);
    }

    return data;
  }

  /**
   * Get recent auto-resume attempts for a mower
   */
  static async getRecentAttempts(mowerId: string, limit: number = 10): Promise<any[]> {
    const { data, error } = (await supabase as any)
      .from('auto_resume_attempts')
      .select('*')
      .eq('mower_id', mowerId)
      .order('attempted_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching auto-resume attempts:', error);
      throw new Error(`Failed to fetch auto-resume attempts: ${error.message}`);
    }

    return data || [];
  }
}