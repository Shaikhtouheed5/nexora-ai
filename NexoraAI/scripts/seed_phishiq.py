import csv
import json
import os
import sys

# Add the parent directory to sys.path to import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.supabase_client import get_supabase_client

def seed_phishiq_questions():
    csv_path = os.path.join(os.path.dirname(__file__), '../../phishiq_questions_rows.csv')
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found")
        return

    supabase = get_supabase_client()
    
    questions = []
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse options JSON string into a list
            try:
                options = json.loads(row['options'])
            except json.JSONDecodeError:
                print(f"Error decoding options for ID {row['id']}: {row['options']}")
                continue

            question_data = {
                "id": int(row['id']),
                "question": row['question'],
                "options": options,
                "correct_index": int(row['correct_index']),
                "explanation": row['explanation'],
                "category": row['category'],
                "language": row['language'],
                "created_at": row['created_at']
            }
            questions.append(question_data)

    print(f"Found {len(questions)} questions. Starting upsert...")

    # Upsert in batches to avoid payload limits
    batch_size = 50
    for i in range(0, len(questions), batch_size):
        batch = questions[i:i + batch_size]
        try:
            res = supabase.table("phishiq_questions").upsert(batch).execute()
            print(f"Successfully upserted batch {i//batch_size + 1}")
        except Exception as e:
            print(f"Error upserting batch {i//batch_size + 1}: {e}")

    print("Seeding complete!")

if __name__ == "__main__":
    seed_phishiq_questions()
