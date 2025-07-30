#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests the Supabase database connection and auth_sessions table functionality
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase database connection...\n');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('auth_sessions')
      .select('count(*)')
      .limit(1);

    if (connectionError) {
      console.error('❌ Connection failed:', connectionError.message);
      return false;
    }
    console.log('✅ Connection successful');

    // Test 2: Table structure
    console.log('\n2. Checking table structure...');
    const { data: structureTest, error: structureError } = await supabase
      .from('auth_sessions')
      .select('session_id, user_email, access_token, refresh_token, expires_at, created_at, updated_at')
      .limit(1);

    if (structureError) {
      console.error('❌ Table structure issue:', structureError.message);
      if (structureError.code === '42P01') {
        console.error('   Table does not exist. Run: supabase db reset');
      }
      return false;
    }
    console.log('✅ Table structure is correct');

    // Test 3: Insert capability
    console.log('\n3. Testing insert capability...');
    const testSession = {
      user_email: `test-${Date.now()}@example.com`,
      access_token: `test_access_${Math.random().toString(36).substring(7)}`,
      refresh_token: `test_refresh_${Math.random().toString(36).substring(7)}`,
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    };

    const { data: insertData, error: insertError } = await supabase
      .from('auth_sessions')
      .insert(testSession)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert failed:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
      return false;
    }
    console.log('✅ Insert successful:', insertData.session_id);

    // Test 4: Update capability
    console.log('\n4. Testing update capability...');
    const { data: updateData, error: updateError } = await supabase
      .from('auth_sessions')
      .update({ 
        access_token: `updated_access_${Math.random().toString(36).substring(7)}` 
      })
      .eq('session_id', insertData.session_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Update failed:', updateError.message);
      return false;
    }
    console.log('✅ Update successful');

    // Test 5: Cleanup test data
    console.log('\n5. Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('auth_sessions')
      .delete()
      .eq('session_id', insertData.session_id);

    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError.message);
      console.log('   Manual cleanup needed for session:', insertData.session_id);
    } else {
      console.log('✅ Cleanup successful');
    }

    // Test 6: Check existing sessions
    console.log('\n6. Checking existing sessions...');
    const { data: existingSessions, error: existingError } = await supabase
      .from('auth_sessions')
      .select('session_id, user_email, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (existingError) {
      console.error('❌ Failed to fetch existing sessions:', existingError.message);
    } else {
      console.log(`✅ Found ${existingSessions.length} existing sessions`);
      if (existingSessions.length > 0) {
        console.log('   Recent sessions:');
        existingSessions.forEach((session, index) => {
          console.log(`   ${index + 1}. ${session.user_email} (${session.created_at})`);
        });
      }
    }

    console.log('\n🎉 All database tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

// Run the test
testDatabaseConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test script failed:', error.message);
    process.exit(1);
  });