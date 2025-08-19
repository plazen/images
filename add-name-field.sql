-- Add name field to UserSettings table
-- Run this in Supabase SQL Editor

-- Add name column to UserSettings table
ALTER TABLE "UserSettings" 
ADD COLUMN IF NOT EXISTS name TEXT;

-- You can also add some sample data for testing
-- INSERT INTO "UserSettings" (user_id, name, timetable_start, timetable_end) 
-- VALUES ('828ed580-32b8-49ab-a2d3-ce060edf0504', 'John Doe', 8, 18)
-- ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name;
