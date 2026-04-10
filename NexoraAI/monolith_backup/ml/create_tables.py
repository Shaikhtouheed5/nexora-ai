"""Create Phase 12 tables in Supabase using the REST API."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from services.supabase_client import get_supabase_client

def create_tables():
    sb = get_supabase_client()
    
    # Test by inserting a lesson row — if table doesn't exist, we'll get an error
    # The tables should be created via Supabase SQL editor
    print("Testing connection to Supabase...")
    
    try:
        result = sb.table("lessons").select("id").limit(1).execute()
        print(f"✅ 'lessons' table exists. Rows: {len(result.data)}")
    except Exception as e:
        print(f"❌ 'lessons' table not found: {e}")
        print("\n⚠️  Please run this SQL in Supabase SQL Editor:\n")
        print("""
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    day_number INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    icon_name TEXT DEFAULT 'BookOpen',
    color TEXT DEFAULT '#6366F1',
    slides JSONB NOT NULL,
    quiz JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    lessons_completed INTEGER DEFAULT 0,
    quizzes_taken INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    UNIQUE(user_id, activity_date)
);
        """)
        return False
    
    try:
        sb.table("user_lesson_progress").select("id").limit(1).execute()
        print("✅ 'user_lesson_progress' table exists.")
    except Exception:
        print("❌ 'user_lesson_progress' table not found.")

    try:
        sb.table("user_activity").select("id").limit(1).execute()
        print("✅ 'user_activity' table exists.")
    except Exception:
        print("❌ 'user_activity' table not found.")

    try:
        sb.table("daily_quizzes").select("id").limit(1).execute()
        print("✅ 'daily_quizzes' table exists.")
    except Exception:
        print("❌ 'daily_quizzes' table not found.")

    try:
        sb.table("phishiq_questions").select("id").limit(1).execute()
        print("✅ 'phishiq_questions' table exists.")
    except Exception:
        print("❌ 'phishiq_questions' table not found.")
        print("\n⚠️  Please run this SQL in Supabase SQL Editor:\n")
        print("""
CREATE TABLE IF NOT EXISTS phishiq_questions (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT,
    category TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_quizzes (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    language TEXT NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, language)
);
        """)

    print("\n✅ Verification complete.")
    return True

if __name__ == "__main__":
    create_tables()
