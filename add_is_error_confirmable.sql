-- Add is_error_confirmable column to epos_data_snapshots table
-- This field stores whether the current error can be automatically confirmed
-- Maps directly to isErrorConfirmable from Husqvarna Connect API

ALTER TABLE epos_data_snapshots 
ADD COLUMN is_error_confirmable BOOLEAN NULL;

-- Add comment to explain the field
COMMENT ON COLUMN epos_data_snapshots.is_error_confirmable IS 
'Whether the current error can be automatically confirmed via Husqvarna API (from isErrorConfirmable field). NULL when no error present.';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'epos_data_snapshots' 
AND column_name = 'is_error_confirmable';