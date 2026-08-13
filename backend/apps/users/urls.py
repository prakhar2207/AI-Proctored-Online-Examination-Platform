from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, UserRegisterView, ChangePasswordView, UserProfileView,
    AdminCreateExaminerView, ExaminerCreateStudentView, SendExamLinkEmailView,
    # New admin management views
    AdminUserListCreateView, AdminUserDetailView, AdminResetPasswordView,
    AdminPlatformStatsView, AdminExamListView, AdminExamDeleteView, AdminSessionListView,
    # New examiner student management views
    ExaminerStudentListView, ExaminerSearchStudentView, ExaminerStudentsResultsView,
)

urlpatterns = [
    # ── Auth ──
    path('register/', UserRegisterView.as_view(), name='auth_register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),

    # ── Legacy / Examiner actions ──
    path('create-examiner/', AdminCreateExaminerView.as_view(), name='create_examiner'),
    path('create-student/', ExaminerCreateStudentView.as_view(), name='create_student'),
    path('send-exam-link/', SendExamLinkEmailView.as_view(), name='send_exam_link'),

    # ── Admin – User Management ──
    path('admin/users/', AdminUserListCreateView.as_view(), name='admin_user_list_create'),
    path('admin/users/<int:user_id>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/users/<int:user_id>/reset-password/', AdminResetPasswordView.as_view(), name='admin_reset_password'),

    # ── Admin – Platform Stats ──
    path('admin/stats/', AdminPlatformStatsView.as_view(), name='admin_stats'),

    # ── Admin – Exam & Session Oversight ──
    path('admin/exams/', AdminExamListView.as_view(), name='admin_exam_list'),
    path('admin/exams/<int:exam_id>/', AdminExamDeleteView.as_view(), name='admin_exam_delete'),
    path('admin/sessions/', AdminSessionListView.as_view(), name='admin_session_list'),

    # ── Examiner – Student Management ──
    path('examiner/students/', ExaminerStudentListView.as_view(), name='examiner_student_list'),
    path('examiner/students/search/', ExaminerSearchStudentView.as_view(), name='examiner_student_search'),
    path('examiner/students/results/', ExaminerStudentsResultsView.as_view(), name='examiner_students_results'),
]
