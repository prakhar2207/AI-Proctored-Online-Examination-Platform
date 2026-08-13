import re
import json

i18n_path = r'c:\Users\prakh\OneDrive\Desktop\Infosys\frontend\src\lib\i18n.ts'

with open(i18n_path, 'r', encoding='utf-8') as f:
    content = f.read()

translations = {
    'en': {
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
    },
    'mr': {
        'examiner.students_dir_title': 'विद्यार्थी डिरेक्टरी',
        'examiner.btn_email_link': 'परीक्षा लिंक ईमेल करा',
        'examiner.btn_register_student': 'विद्यार्थी प्रोफाईल नोंदणी करा',
        'examiner.lookup_candidate': 'उमेदवार डेटाबेस पहा',
        'examiner.search_placeholder': 'नाव, ईमेल किंवा वापरकर्तानाव शोधा...',
        'examiner.search_results': 'शोध परिणाम:',
        'examiner.associated': 'जोडलेले',
        'examiner.btn_associate': 'जोडा',
        'examiner.associated_candidates': 'संबंधित उमेदवार आणि ऑडीट्स',
        'examiner.no_associated': 'सध्या आपल्या खात्याशी कोणतेही विद्यार्थी जोडलेले नाहीत.',
        'examiner.no_exams_started': 'कोणतीही परीक्षा नियुक्त केलेली नाही किंवा सुरू केलेली नाही.',
        'examiner.status': 'स्थिती',
        'examiner.published': 'प्रकाशित',
        'examiner.marks': 'गुण',
        'examiner.awaiting_audit': 'ऑडिटच्या प्रतीक्षेत',
        'examiner.btn_finalize': 'निकाल निश्चित करा',
        'examiner.in_progress': 'प्रगतीपथावर'
    },
    'hi': {
        'examiner.students_dir_title': 'छात्र निर्देशिका',
        'examiner.btn_email_link': 'परीक्षा लिंक ईमेल करें',
        'examiner.btn_register_student': 'छात्र प्रोफ़ाइल पंजीकृत करें',
        'examiner.lookup_candidate': 'उम्मीदवार डेटाबेस खोजें',
        'examiner.search_placeholder': 'नाम, ईमेल या उपयोगकर्ता नाम खोजें...',
        'examiner.search_results': 'खोज परिणाम:',
        'examiner.associated': 'संबद्ध',
        'examiner.btn_associate': 'संबद्ध करें',
        'examiner.associated_candidates': 'संबद्ध उम्मीदवार और ऑडिट',
        'examiner.no_associated': 'वर्तमान में आपके खाते से कोई छात्र संबद्ध नहीं है।',
        'examiner.no_exams_started': 'कोई परीक्षा निर्दिष्ट या प्रारंभ नहीं की गई है।',
        'examiner.status': 'स्थिति',
        'examiner.published': 'प्रकाशित',
        'examiner.marks': 'अंक',
        'examiner.awaiting_audit': 'ऑडिट की प्रतीक्षा में',
        'examiner.btn_finalize': 'परिणाम अंतिम रूप दें',
        'examiner.in_progress': 'प्रगति पर है'
    }
}

languages = ['en', 'hi', 'te', 'ta', 'ml', 'mr', 'gu', 'bn']

for lang in languages:
    trans_dict = translations.get(lang, translations['en'])
    
    lines = []
    for k, v in trans_dict.items():
        val = v.replace("'", "\\'")
        lines.append(f"      '{k}': '{val}',")
    
    lines_str = '\n'.join(lines)
    
    search_pattern = rf"({lang}: {{\s*translation: {{[\s\S]*?'examiner\.tab_students': '[^']*',)"
    
    def repl(m):
        return m.group(1) + '\n' + lines_str
    
    content, count = re.subn(search_pattern, repl, content)
    if count == 0:
        print(f"Failed to find injection point for {lang}")

with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done updating i18n.ts")
