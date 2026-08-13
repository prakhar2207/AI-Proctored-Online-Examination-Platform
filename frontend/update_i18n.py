import re

with open('src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

en_keys = """
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
      'examiner.in_progress': 'In Progress',
"""

content = content.replace(
    "'examiner.tab_students': 'Students',",
    "'examiner.tab_students': 'Students',\n" + en_keys
)

with open('src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done i18n update.")
