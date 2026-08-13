import json
import re

with open('translations.json', 'r', encoding='utf-8') as f:
    translations = json.load(f)

translations['en'] = {
    'landing.auth_success': 'Authentication Successful',
    'landing.welcome_back': 'Welcome back,',
    'landing.redirecting': 'Redirecting to',
    'landing.init_session': 'Initializing secure session...',
    'landing.footer_brand': 'AI-Exam Platform',
    'landing.footer_slogan': 'Secure · Intelligent · Reliable'
}

with open(r'c:\Users\prakh\OneDrive\Desktop\Infosys\frontend\src\lib\i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

for lang, keys in translations.items():
    lang_pattern = re.compile(r'(' + lang + r':\s*\{\s*translation:\s*\{)')
    match = lang_pattern.search(content)
    if match:
        insertion_str = ''
        for k, v in keys.items():
            v_escaped = v.replace("'", "\\'")
            insertion_str += f"\n      '{k}': '{v_escaped}',"
        content = content[:match.end()] + insertion_str + content[match.end():]

with open(r'c:\Users\prakh\OneDrive\Desktop\Infosys\frontend\src\lib\i18n.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('i18n updated successfully.')
