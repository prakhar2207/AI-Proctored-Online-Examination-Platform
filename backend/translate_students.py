import re
import json
from deep_translator import GoogleTranslator

# Target file
i18n_path = r'c:\Users\prakh\OneDrive\Desktop\Infosys\frontend\src\lib\i18n.ts'

with open(i18n_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_keys_en = {
    'examiner.students_dir_title': 'Students Directory',
    'examiner.btn_email_link': 'Email Exam Link',
    'examiner.btn_register_student': 'Register Student Profile',
    'examiner.lookup_candidate': 'Lookup Candidate Database',
    'examiner.search_placeholder': 'Search name, email, or username...',
    'examiner.search_results': 'Search Results:',
    'examiner.associated': 'Associated',
    'examiner.btn_associate': 'Associate',
    'examiner.associated_candidates': 'Associated Candidates & Audits',
    'examiner.no_associated': 'No students currently associated with your account.',
    'examiner.no_exams_started': 'No exams assigned or started.',
    'examiner.status': 'Status',
    'examiner.published': 'Published',
    'examiner.marks': 'Marks',
    'examiner.awaiting_audit': 'Awaiting Audit',
    'examiner.btn_finalize': 'Finalize Results',
    'examiner.in_progress': 'In Progress'
}

languages = ['en', 'hi', 'te', 'ta', 'ml', 'mr', 'gu', 'bn']

# Insert for each language
for lang in languages:
    print(f"Translating for {lang}...")
    
    if lang == 'en':
        translated = new_keys_en
    else:
        translated = {}
        translator = GoogleTranslator(source='en', target=lang)
        for k, v in new_keys_en.items():
            translated[k] = translator.translate(v)

    # Format dictionary items as lines
    lines = []
    for k, v in translated.items():
        # Escape quotes properly
        val = v.replace("'", "\\'")
        lines.append(f"      '{k}': '{val}',")
    
    lines_str = '\n'.join(lines)
    
    # We will inject this right after 'examiner.tab_students' for each language
    # First, find the block for the language
    # It looks like:
    #   hi: {
    #     translation: {
    #       ...
    #       'examiner.tab_students': '...',
    
    # We need to use regex to find the right place
    search_pattern = rf"({lang}: {{\s*translation: {{[\s\S]*?'examiner\.tab_students': '[^']*',)"
    
    def repl(m):
        return m.group(1) + '\n' + lines_str
    
    content, count = re.subn(search_pattern, repl, content)
    if count == 0:
        print(f"Failed to find injection point for {lang}")

with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done translating and updating i18n.ts")
