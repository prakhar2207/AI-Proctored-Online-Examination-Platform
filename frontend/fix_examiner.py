import re

with open('src/app/examiner/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add <main> wrapper
content = content.replace(
    '</nav>\n\n      <div className="tab-container">',
    '</nav>\n\n      <main style={styles.main}>\n      <div className="tab-container">'
)

content = content.replace(
    '      {/* ── Modals ── */}',
    '      </main>\n\n      {/* ── Modals ── */}'
)

# 2. Add translation keys
content = content.replace('>Students Directory<', '>{t("examiner.students_dir_title")}<')
content = content.replace('>Email Exam Link<', '>{t("examiner.btn_email_link")}<')
content = content.replace('>Register Student Profile<', '>{t("examiner.btn_register_student")}<')
content = content.replace('>Lookup Candidate Database<', '>{t("examiner.lookup_candidate")}<')
content = content.replace('placeholder="Search name, email, or username..."', 'placeholder={t("examiner.search_placeholder")}')
content = content.replace('>Search<', '>{t("common.search")}<')
content = content.replace('>Search Results:<', '>{t("examiner.search_results")}<')
content = content.replace('>Associated<', '>{t("examiner.associated")}<')
content = content.replace('>Associate<', '>{t("examiner.btn_associate")}<')
content = content.replace('>Associated Candidates & Audits<', '>{t("examiner.associated_candidates")}<')
content = content.replace('>No students currently associated with your account.<', '>{t("examiner.no_associated")}<')
content = content.replace('>No exams assigned or started.<', '>{t("examiner.no_exams_started")}<')
content = content.replace('>Status: ', '>{t("examiner.status")}: ')
content = content.replace('>Published<', '>{t("examiner.published")}<')
content = content.replace(' Marks<', ' {t("examiner.marks")}<')
content = content.replace('>Awaiting Audit<', '>{t("examiner.awaiting_audit")}<')
content = content.replace('>Finalize Results<', '>{t("examiner.btn_finalize")}<')
content = content.replace('>In Progress<', '>{t("examiner.in_progress")}<')

with open('src/app/examiner/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done examiner layout and strings.")
