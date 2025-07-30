-- Add current_work_area_id column to epos_data_snapshots table
-- This field stores the ID of the work area currently being worked on by the mower
-- Corresponds to the workAreaId field from Husqvarna Connect API

ALTER TABLE epos_data_snapshots 
ADD COLUMN current_work_area_id INTEGER NULL;

-- Add comment to explain the field
COMMENT ON COLUMN epos_data_snapshots.current_work_area_id IS 
'ID of the work area currently being worked on by the mower (from Husqvarna API workAreaId field). NULL when no specific area is being worked on.';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'epos_data_snapshots' 
AND column_name = 'current_work_area_id';