import json
import os

locales_dir = '/home/ari/Documents/gitfolder/laravel-reactNative-SocialMedia/frontend/constants/locales'
gold_standard = os.path.join(locales_dir, 'ckb.json')
en_file = os.path.join(locales_dir, 'en.json')

with open(gold_standard, 'r') as f:
    gold_keys = json.load(f).keys()

with open(en_file, 'r') as f:
    en_data = json.load(f)

files = [f for f in os.listdir(locales_dir) if f.endswith('.json') and f != 'ckb.json' and f != 'en.json']

audit_results = {}

for filename in files:
    filepath = os.path.join(locales_dir, filename)
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    missing = [k for k in gold_keys if k not in data]
    english_placeholders = [k for k, v in data.items() if k in en_data and v == en_data[k] and k != 'match']
    
    audit_results[filename] = {
        'missing_count': len(missing),
        'english_placeholder_count': len(english_placeholders),
        'missing_keys': missing[:10], # Show first 10
        'english_keys': english_placeholders[:10]
    }

print(json.dumps(audit_results, indent=2))
