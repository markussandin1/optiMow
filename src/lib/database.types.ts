// OptiMow v3 Database Types
// Generated from Supabase schema for type safety

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      auth_sessions: {
        Row: {
          session_id: string
          user_email: string
          access_token: string
          refresh_token: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          session_id?: string
          user_email: string
          access_token: string
          refresh_token: string
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          session_id?: string
          user_email?: string
          access_token?: string
          refresh_token?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      mower_profiles: {
        Row: {
          id: string
          session_id: string
          husqvarna_id: string
          name: string
          model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          husqvarna_id: string
          name: string
          model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          husqvarna_id?: string
          name?: string
          model?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mower_profiles_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "auth_sessions"
            referencedColumns: ["session_id"]
          }
        ]
      }
      epos_data_snapshots: {
        Row: {
          id: string
          mower_id: string
          activity: string
          mode: string
          state: string
          battery_level: number
          error_code: number
          work_areas: Json
          total_cutting_time: number
          total_running_time: number
          total_charging_time: number
          latitude: number | null
          longitude: number | null
          collected_at: string
          api_response_time_ms: number | null
          collection_method: string
          created_at: string
          status_timestamp: number | null
          last_error_timestamp: number | null
          current_work_area_id: number | null
          is_error_confirmable: boolean | null
        }
        Insert: {
          id?: string
          mower_id: string
          activity: string
          mode: string
          state: string
          battery_level: number
          error_code?: number
          work_areas?: Json
          total_cutting_time?: number
          total_running_time?: number
          total_charging_time?: number
          latitude?: number | null
          longitude?: number | null
          collected_at: string
          api_response_time_ms?: number | null
          collection_method?: string
          created_at?: string
          status_timestamp?: number | null
          last_error_timestamp?: number | null
          current_work_area_id?: number | null
        }
        Update: {
          id?: string
          mower_id?: string
          activity?: string
          mode?: string
          state?: string
          battery_level?: number
          error_code?: number
          work_areas?: Json
          total_cutting_time?: number
          total_running_time?: number
          total_charging_time?: number
          latitude?: number | null
          longitude?: number | null
          collected_at?: string
          api_response_time_ms?: number | null
          collection_method?: string
          created_at?: string
          status_timestamp?: number | null
          last_error_timestamp?: number | null
          current_work_area_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epos_data_snapshots_mower_id_fkey"
            columns: ["mower_id"]
            isOneToOne: false
            referencedRelation: "mower_profiles"
            referencedColumns: ["husqvarna_id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types for easier usage
export type AuthSession = Database['public']['Tables']['auth_sessions']['Row']
export type AuthSessionInsert = Database['public']['Tables']['auth_sessions']['Insert']
export type AuthSessionUpdate = Database['public']['Tables']['auth_sessions']['Update']

export type MowerProfile = Database['public']['Tables']['mower_profiles']['Row']
export type MowerProfileInsert = Database['public']['Tables']['mower_profiles']['Insert']
export type MowerProfileUpdate = Database['public']['Tables']['mower_profiles']['Update']

export type EposDataSnapshot = Database['public']['Tables']['epos_data_snapshots']['Row']
export type EposDataSnapshotInsert = Database['public']['Tables']['epos_data_snapshots']['Insert']
export type EposDataSnapshotUpdate = Database['public']['Tables']['epos_data_snapshots']['Update']

// Work area structure for EPOS data
export interface WorkArea {
  id: number
  name: string
  progress: number
  enabled: boolean
  cutting_height?: number
  lastTimeCompleted?: number | null // Timestamp in seconds when area was last completed (EPOS only)
}

// Additional utility types
export type MowerProfileWithSession = MowerProfile & {
  auth_sessions: AuthSession
}

export type SessionWithMowers = AuthSession & {
  mower_profiles: MowerProfile[]
}

export type EposDataSnapshotWithWorkAreas = Omit<EposDataSnapshot, 'work_areas'> & {
  work_areas: WorkArea[]
}