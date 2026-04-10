-- Fix Schema: Point foreign keys to 'profiles' instead of 'app_users'

-- 1. Alter user_lesson_progress
ALTER TABLE user_lesson_progress 
DROP CONSTRAINT IF EXISTS user_lesson_progress_user_id_fkey;

ALTER TABLE user_lesson_progress
ADD CONSTRAINT user_lesson_progress_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. Alter user_activity
ALTER TABLE user_activity
DROP CONSTRAINT IF EXISTS user_activity_user_id_fkey;

ALTER TABLE user_activity
ADD CONSTRAINT user_activity_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Verify and sync profiles if needed (though profiles already exist)
-- Analysis showed auth.py inserts into 'profiles', so constraints must match.
