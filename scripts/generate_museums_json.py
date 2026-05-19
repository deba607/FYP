import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(__file__))
CSV_PATH = os.path.join(ROOT, 'chatbot-engine', 'chatbot', 'indian museum dataset.csv')
OUT_PATH = os.path.join(ROOT, 'client', 'public', 'museums.json')

museums = []
seen_ids = {}

def make_id(name, idx):
    if not name:
        return f"museum_{idx}"
    slug = ''.join(c.lower() if c.isalnum() else '_' for c in name).strip('_')
    return slug or f"museum_{idx}"


def unique_id(base_id):
    count = seen_ids.get(base_id, 0)
    seen_ids[base_id] = count + 1
    if count == 0:
                return base_id
    return f"{base_id}_{count + 1}"

with open(CSV_PATH, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader, start=1):
        name = (row.get('Museum Name') or '').strip()
        location = (row.get('City/Location') or '').strip()
        state = (row.get('State/UT') or '').strip()
        category = (row.get('Category/Type') or '').strip()
        museum = {
            'museum_id': unique_id(make_id(name, i)),
            'name': name,
            'location': location,
            'state': state,
            'category': category,
            'price': 200
        }
        museums.append(museum)

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as out:
    json.dump(museums, out, ensure_ascii=False, indent=2)

print(f"Wrote {len(museums)} museums to {OUT_PATH}")
