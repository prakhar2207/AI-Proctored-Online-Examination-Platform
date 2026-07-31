import secrets
from django.conf import settings
from django.db import models
from django.core.mail import send_mail
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

from .serializers import CustomTokenObtainPairSerializer, UserRegistrationSerializer
from apps.users.permissions import IsAdmin, IsExaminer
from apps.exams.models import Exam, ExamSession, Result

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserRegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        new_password = request.data.get('new_password')
        if not new_password or len(new_password) < 6:
            return Response({"error": "Password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        user.set_password(new_password)
        user.must_change_password = False
        user.save()
        return Response({"status": "Password changed successfully."}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────
#  ADMIN — Full User Management
# ─────────────────────────────────────────────────────────────

class AdminUserListCreateView(APIView):
    """GET all users (filterable by role), POST create any user."""
    permission_classes = [IsAdmin]

    def get(self, request):
        role = request.query_params.get('role', None)
        qs = User.objects.all().order_by('role', 'username')
        if role:
            qs = qs.filter(role=role)
        data = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "name": f"{u.first_name} {u.last_name}".strip(),
                "role": u.role,
                "is_active": u.is_active,
                "must_change_password": u.must_change_password,
                "date_joined": u.date_joined.isoformat(),
            }
            for u in qs
        ]
        return Response(data)

    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        name = request.data.get('name', '').strip()
        role = request.data.get('role', 'student')
        send_email = request.data.get('send_email', True)

        if not username or not email:
            return Response({"error": "Username and email are required."}, status=status.HTTP_400_BAD_REQUEST)
        if role not in ['student', 'examiner']:
            return Response({"error": "Role must be student or examiner. Admin accounts cannot be created here."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)

        temp_pass = secrets.token_urlsafe(8)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=temp_pass,
            role=role,
            must_change_password=True,
        )
        if name:
            parts = name.split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''
            user.save()

        if send_email:
            try:
                subject = f"Your {role.capitalize()} Account – AI Exam Platform"
                message = f"""Hi {name or username},

Your {role} account has been created on the AI-Proctored Examination Platform by the administrator.

Login credentials:
  Username:          {username}
  Temporary Password: {temp_pass}
  Login URL:         http://localhost:3000/login

Please log in and change your password immediately.

Regards,
Platform Admin
"""
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])
            except Exception:
                pass  # Don't fail creation if mail fails

        return Response({
            "status": f"{role.capitalize()} account created.",
            "id": user.id,
            "username": username,
            "temp_password": temp_pass,
        }, status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    """GET, PATCH, DELETE a single user by id."""
    permission_classes = [IsAdmin]

    def _get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    def get(self, request, user_id):
        u = self._get_user(user_id)
        if not u:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "is_active": u.is_active,
            "must_change_password": u.must_change_password,
            "date_joined": u.date_joined.isoformat(),
        })

    def patch(self, request, user_id):
        u = self._get_user(user_id)
        if not u:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Prevent admin from removing their own admin status
        if u.id == request.user.id and request.data.get('role') and request.data['role'] != 'admin':
            return Response({"error": "You cannot change your own role."}, status=status.HTTP_400_BAD_REQUEST)

        # Capture previous values to detect what changed
        old_role  = u.role
        old_email = u.email
        changes   = []

        if 'username' in request.data:
            new_un = request.data['username'].strip()
            if new_un != u.username and User.objects.filter(username=new_un).exists():
                return Response({"error": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)
            if new_un != u.username:
                changes.append(f"Username changed to: {new_un}")
            u.username = new_un

        if 'email' in request.data:
            new_em = request.data['email'].strip()
            if new_em != u.email and User.objects.filter(email=new_em).exists():
                return Response({"error": "Email already registered."}, status=status.HTTP_400_BAD_REQUEST)
            if new_em != u.email:
                changes.append(f"Email changed to: {new_em}")
            u.email = new_em

        if 'first_name' in request.data:
            u.first_name = request.data['first_name']
        if 'last_name' in request.data:
            u.last_name = request.data['last_name']

        new_role = request.data.get('role')
        role_changed = False
        if new_role and new_role in ['student', 'examiner', 'admin']:
            if new_role == 'admin' and u.role != 'admin':
                return Response({"error": "Cannot promote a user to admin. There is only one admin account."}, status=status.HTTP_400_BAD_REQUEST)
            if new_role != old_role:
                role_changed = True
                changes.append(f"Role changed: {old_role} → {new_role}")
            u.role = new_role

        if 'is_active' in request.data:
            new_active = bool(request.data['is_active'])
            if new_active != u.is_active:
                changes.append("Account " + ("activated" if new_active else "deactivated"))
            u.is_active = new_active

        u.save()

        # ── Send notification email if requested ──────────────
        send_email_flag = request.data.get('send_email', False)
        notify_email = u.email  # use the (possibly updated) email
        if send_email_flag and changes:
            try:
                name = f"{u.first_name} {u.last_name}".strip() or u.username
                change_lines = "\n".join(f"  - {c}" for c in changes)

                role_section = ""
                if role_changed:
                    portal_map = {
                        'examiner': 'Examiner Portal — you can now create and manage examination papers.',
                        'admin':    'Admin Console — you now have full administrative access to the platform.',
                        'student':  'Student Portal — you can now take examinations assigned to you.',
                    }
                    role_section = (
                        f"\nYour role has been updated to: {u.role.upper()}\n"
                        f"  {portal_map.get(u.role, '')}\n"
                        f"  Login: http://localhost:3000/login\n"
                    )

                subject = "Your Account Has Been Updated – AI Exam Platform"
                message = (
                    f"Hi {name},\n\n"
                    "Your account on the AI-Proctored Examination Platform has been "
                    "updated by an administrator.\n\n"
                    f"Changes applied:\n{change_lines}\n"
                    f"{role_section}\n"
                    "If you did not expect these changes, please contact your "
                    "administrator immediately.\n\n"
                    "Regards,\nPlatform Admin Team\nhttp://localhost:3000"
                )
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [notify_email])
            except Exception:
                pass  # Don't fail the update if email fails

        return Response({
            "status": "User updated.",
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "email_sent": send_email_flag and bool(changes),
            "changes": changes,
        })


    def delete(self, request, user_id):
        u = self._get_user(user_id)
        if not u:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if u.id == request.user.id:
            return Response({"error": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        username = u.username
        u.delete()
        return Response({"status": f"User '{username}' deleted."}, status=status.HTTP_200_OK)


class AdminResetPasswordView(APIView):
    """Generate a new temp password and email it to the user."""
    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        try:
            u = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        temp_pass = secrets.token_urlsafe(8)
        u.set_password(temp_pass)
        u.must_change_password = True
        u.save()

        try:
            subject = "Password Reset – AI Exam Platform"
            message = f"""Hi {u.first_name or u.username},

Your password has been reset by an administrator.

New temporary password: {temp_pass}
Login URL: http://localhost:3000/login

Please log in and change your password immediately.

Regards,
Platform Admin
"""
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [u.email])
        except Exception:
            pass

        return Response({"status": "Password reset and email sent.", "temp_password": temp_pass})


class AdminPlatformStatsView(APIView):
    """Quick stats for the admin dashboard."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.exams.models import Exam, ExamSession
        return Response({
            "total_users": User.objects.count(),
            "students": User.objects.filter(role='student').count(),
            "examiners": User.objects.filter(role='examiner').count(),
            "admins": User.objects.filter(role='admin').count(),
            "total_exams": Exam.objects.count(),
            "total_sessions": ExamSession.objects.count(),
            "submitted_sessions": ExamSession.objects.filter(status__in=['submitted', 'auto_submitted']).count(),
            "flagged_sessions": ExamSession.objects.filter(status='flagged').count(),
        })


# ─────────────────────────────────────────────────────────────
#  ADMIN — Exam & Session oversight
# ─────────────────────────────────────────────────────────────

class AdminExamListView(APIView):
    """List all exams regardless of creator."""
    permission_classes = [IsAdmin]

    def get(self, request):
        exams = Exam.objects.select_related('created_by').all().order_by('-created_at')
        data = [
            {
                "id": e.id,
                "title": e.title,
                "subject": e.subject,
                "duration_minutes": e.duration_minutes,
                "start_window": e.start_window.isoformat(),
                "end_window": e.end_window.isoformat(),
                "created_by": e.created_by.username if e.created_by else "—",
                "sessions_count": e.sessions.count(),
                "enable_webcam": e.enable_webcam,
            }
            for e in exams
        ]
        return Response(data)

    def delete(self, request):
        exam_id = request.data.get('exam_id')
        try:
            exam = Exam.objects.get(id=exam_id)
            title = exam.title
            exam.delete()
            return Response({"status": f"Exam '{title}' deleted."})
        except Exam.DoesNotExist:
            return Response({"error": "Exam not found."}, status=status.HTTP_404_NOT_FOUND)


class AdminExamDeleteView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, exam_id):
        try:
            exam = Exam.objects.get(id=exam_id)
            title = exam.title
            exam.delete()
            return Response({"status": f"Exam '{title}' deleted."})
        except Exam.DoesNotExist:
            return Response({"error": "Exam not found."}, status=status.HTTP_404_NOT_FOUND)


class AdminSessionListView(APIView):
    """List all exam sessions."""
    permission_classes = [IsAdmin]

    def get(self, request):
        sessions = ExamSession.objects.select_related('student', 'exam').all().order_by('-start_time')[:200]
        data = [
            {
                "id": s.id,
                "student": s.student.username,
                "exam": s.exam.title,
                "subject": s.exam.subject,
                "status": s.status,
                "start_time": s.start_time.isoformat(),
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in sessions
        ]
        return Response(data)


# ─────────────────────────────────────────────────────────────
#  LEGACY — Examiner-facing views (unchanged)
# ─────────────────────────────────────────────────────────────

class AdminCreateExaminerView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        name = request.data.get('name', '')

        if not username or not email:
            return Response({"error": "Username and email are required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        temp_pass = secrets.token_urlsafe(8)
        user = User.objects.create_user(
            username=username, email=email, password=temp_pass,
            role=User.Role.EXAMINER, must_change_password=True
        )
        if name:
            user.first_name = name
            user.save()

        subject = "Your Examiner Account Details - AI Exam Platform"
        message = f"""Hi {name or username},\n\nUsername: {username}\nTemporary Password: {temp_pass}\nLogin: http://localhost:3000/login\n\nPlease change your password on first login.\n\nRegards,\nPlatform Admin"""
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])

        return Response({"status": "Examiner created.", "username": username, "temp_password": temp_pass}, status=status.HTTP_201_CREATED)


class ExaminerCreateStudentView(APIView):
    permission_classes = [IsExaminer]

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        name = request.data.get('name', '')
        exam_id = request.data.get('exam_id')

        if not username or not email or not name:
            return Response({"error": "Username, email, and name are required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        password = secrets.token_urlsafe(8)
        student = User.objects.create_user(username=username, email=email, password=password, role=User.Role.STUDENT)
        student.first_name = name
        student.examiner = request.user
        student.save()

        exam_info_str = "No exam currently assigned."
        if exam_id:
            try:
                exam = Exam.objects.get(id=exam_id)
                session = ExamSession.objects.create(student=student, exam=exam, status=ExamSession.Status.IN_PROGRESS)
                from apps.exams.services import ExamService
                ExamService.generate_random_paper(session)
                exam_info_str = f"Assigned Exam: {exam.title}\nExam Link: http://localhost:3000/student/exam/{exam.id}\nDuration: {exam.duration_minutes} min"
            except Exam.DoesNotExist:
                pass

        subject = "Your Student Account & Exam Details - AI Exam Platform"
        message = f"Hi {name},\n\nUsername: {username}\nPassword: {password}\nLogin: http://localhost:3000/login\n\n---\n{exam_info_str}\n---\n\nRegards,\nExaminer {request.user.username}"
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email])

        return Response({"status": "Student created.", "username": username, "password": password}, status=status.HTTP_201_CREATED)


class SendExamLinkEmailView(APIView):
    permission_classes = [IsExaminer]

    def post(self, request):
        student_email = request.data.get('email')
        exam_id = request.data.get('exam_id')
        username = request.data.get('username')

        if not student_email or not exam_id or not username:
            return Response({"error": "Student email, username, and exam_id are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = User.objects.get(username=username, email=student_email)
            exam = Exam.objects.get(id=exam_id)
        except (User.DoesNotExist, Exam.DoesNotExist):
            return Response({"error": "Student or exam not found."}, status=status.HTTP_404_NOT_FOUND)

        exam_link = f"http://localhost:3000/student/exam/{exam.id}"
        subject = f"Exam Link: {exam.title} - AI Exam Platform"
        message = f"Hi {student.first_name or student.username},\n\nExam: {exam.title}\nDuration: {exam.duration_minutes} min\nLink: {exam_link}\n\nRegards,\nExaminer {request.user.username}"
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [student_email])

        return Response({"status": f"Email sent to {student_email}."}, status=status.HTTP_200_OK)


class ExaminerStudentListView(APIView):
    permission_classes = [IsExaminer]

    def get(self, request):
        # A student is associated if the examiner created their account OR has ever assigned an exam to them
        created_students_ids = User.objects.filter(
            role=User.Role.STUDENT,
            examiner=request.user
        ).values_list('id', flat=True)

        assigned_students_ids = ExamSession.objects.filter(
            exam__created_by=request.user
        ).values_list('student_id', flat=True)

        associated_ids = set(list(created_students_ids) + list(assigned_students_ids))

        students = User.objects.filter(id__in=associated_ids).order_by('username')
        data = [
            {
                "id": s.id,
                "username": s.username,
                "email": s.email,
                "name": f"{s.first_name} {s.last_name}".strip(),
            }
            for s in students
        ]
        return Response(data)


class ExaminerSearchStudentView(APIView):
    permission_classes = [IsExaminer]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([])

        students = User.objects.filter(role=User.Role.STUDENT).filter(
            models.Q(username__icontains=query) | models.Q(email__icontains=query) | models.Q(first_name__icontains=query)
        )[:15]

        # Calculate association status
        created_students_ids = User.objects.filter(
            role=User.Role.STUDENT,
            examiner=request.user
        ).values_list('id', flat=True)

        assigned_students_ids = ExamSession.objects.filter(
            exam__created_by=request.user
        ).values_list('student_id', flat=True)

        associated_ids = set(list(created_students_ids) + list(assigned_students_ids))

        data = [
            {
                "id": s.id,
                "username": s.username,
                "email": s.email,
                "name": f"{s.first_name} {s.last_name}".strip(),
                "associated": s.id in associated_ids
            }
            for s in students
        ]
        return Response(data)


class ExaminerStudentsResultsView(APIView):
    permission_classes = [IsExaminer]

    def get(self, request):
        # A student is associated if the examiner created their account OR has ever assigned an exam to them
        created_students_ids = User.objects.filter(
            role=User.Role.STUDENT,
            examiner=request.user
        ).values_list('id', flat=True)

        assigned_students_ids = ExamSession.objects.filter(
            exam__created_by=request.user
        ).values_list('student_id', flat=True)

        associated_ids = set(list(created_students_ids) + list(assigned_students_ids))

        # Only retrieve sessions for associated students and exams created by this examiner
        sessions = ExamSession.objects.filter(
            student_id__in=associated_ids,
            exam__created_by=request.user
        ).select_related('exam', 'student', 'result')

        data = []
        for s in sessions:
            score = None
            percentile = None
            finalized = False
            if hasattr(s, 'result'):
                score = s.result.total_score
                percentile = s.result.percentile
                finalized = s.result.finalized

            data.append({
                "session_id": s.id,
                "student_id": s.student.id,
                "student_username": s.student.username,
                "student_name": f"{s.student.first_name} {s.student.last_name}".strip(),
                "exam_id": s.exam.id,
                "exam_title": s.exam.title,
                "subject": s.exam.subject,
                "status": s.status,
                "score": score,
                "percentile": percentile,
                "finalized": finalized,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None
            })
        return Response(data)


