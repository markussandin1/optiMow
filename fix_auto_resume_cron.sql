-- Fix Auto-Resume Cron Job with Correct Service Role Key
-- This file fixes the authentication issue preventing auto-resume from working

-- First, remove the old broken cron job
SELECT cron.unschedule('auto-resume-monitor');

-- Create new cron job with correct service role key
SELECT cron.schedule(
  'auto-resume-monitor-fixed',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://jodjyhhxvirpzhmubyxq.supabase.co/functions/v1/auto-resume-monitor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZGp5aGh4dmlycHpobXVieXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQzNTMxNiwiZXhwIjoyMDY5MDExMzE2fQ.ob_Rqz2cOEJHOSGASi_oJH6aEp1MXxvRoYnQRG3PRP0"}'::jsonb
  ) as request_id;
  $$
);

-- Verify the new cron job was created
SELECT 
  jobname,
  schedule,
  active,
  LEFT(command, 100) || '...' as command_preview
FROM cron.job 
WHERE jobname LIKE '%auto-resume%'
ORDER BY jobname;

-- Test that the cron job will work by making a manual call
SELECT net.http_post(
  url:='https://jodjyhhxvirpzhmubyxq.supabase.co/functions/v1/auto-resume-monitor',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZGp5aGh4dmlycHpobXVieXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQzNTMxNiwiZXhwIjoyMDY5MDExMzE2fQ.ob_Rqz2cOEJHOSGASi_oJH6aEp1MXxvRoYnQRG3PRP0"}'::jsonb
) as test_call_result;