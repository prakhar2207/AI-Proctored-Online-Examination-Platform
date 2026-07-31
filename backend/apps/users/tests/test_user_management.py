import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from apps.exams.models import Exam
from django.core import mail
from django.utils import timezone
from datetime import timedelta
from django.conf import settings

User = get_user_model()

@pytest.mark.django_db
class TestUserManagementAPI:
    def test_admin_create_examiner_flow(self, client):
        # Create admin
        admin = User.objects.create_user(
            username="admin_test",
            email="admin_test@example.com",
            password="adminpassword",
            role=User.Role.ADMIN
        )
        
        # Authenticate admin
        login_res = client.post('/api/auth/login/', {
            "username": "admin_test",
            "password": "adminpassword"
        })
        token = login_res.data['access']
        
        # Try to create examiner
        data = {
            "username": "new_examiner",
            "email": "new_examiner@example.com",
            "name": "Prof. New Examiner"
        }
        res = client.post('/api/auth/create-examiner/', data, HTTP_AUTHORIZATION=f'Bearer {token}')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['username'] == 'new_examiner'
        assert 'temp_password' in res.data
        
        # Verify examiner in DB
        examiner = User.objects.get(username="new_examiner")
        assert examiner.role == User.Role.EXAMINER
        assert examiner.must_change_password is True
        assert examiner.first_name == "Prof. New Examiner"
        
        # Verify email sent
        assert len(mail.outbox) == 1
        assert "Your Examiner Account Details" in mail.outbox[0].subject
        assert "new_examiner" in mail.outbox[0].body
        assert res.data['temp_password'] in mail.outbox[0].body

        # Login as new examiner and check first-time change password flag
        ex_login_res = client.post('/api/auth/login/', {
            "username": "new_examiner",
            "password": res.data['temp_password']
        })
        assert ex_login_res.status_code == status.HTTP_200_OK
        assert ex_login_res.data['must_change_password'] is True
        ex_token = ex_login_res.data['access']

        # Change password
        ch_res = client.post('/api/auth/change-password/', {
            "new_password": "newsecurepassword123"
        }, HTTP_AUTHORIZATION=f'Bearer {ex_token}')
        assert ch_res.status_code == status.HTTP_200_OK

        # Verify password changed and must_change_password is False
        examiner.refresh_from_db()
        assert examiner.must_change_password is False
        assert examiner.check_password("newsecurepassword123") is True

    def test_examiner_create_student_flow(self, client):
        # Create examiner
        examiner = User.objects.create_user(
            username="examiner_test",
            email="examiner_test@example.com",
            password="examinerpassword",
            role=User.Role.EXAMINER
        )
        
        # Authenticate examiner
        login_res = client.post('/api/auth/login/', {
            "username": "examiner_test",
            "password": "examinerpassword"
        })
        token = login_res.data['access']

        # Create dummy Exam config to test assignment
        exam = Exam.objects.create(
            title="Data Structures Exam",
            subject="Computer Science",
            duration_minutes=60,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            enable_webcam=True,
            randomize_questions=False,
            config_rules={"easy_count": 0, "medium_count": 0, "hard_count": 0},
            created_by=examiner
        )
        
        # Create Student
        data = {
            "username": "new_student",
            "email": "student@example.com",
            "name": "John Doe",
            "exam_id": exam.id
        }
        res = client.post('/api/auth/create-student/', data, HTTP_AUTHORIZATION=f'Bearer {token}')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['username'] == 'new_student'
        assert 'password' in res.data
        
        # Verify student in DB
        student = User.objects.get(username="new_student")
        assert student.role == User.Role.STUDENT
        assert student.must_change_password is False # students don't need first login reset unless explicitly wanted

        # Verify email sent from Examiner's mail ID (uses DEFAULT_FROM_EMAIL)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].from_email == settings.DEFAULT_FROM_EMAIL
        assert "student@example.com" in mail.outbox[0].to
        assert "Data Structures Exam" in mail.outbox[0].body

    def test_send_exam_link_flow(self, client):
        # Create examiner and student
        examiner = User.objects.create_user(
            username="examiner_test2",
            email="examiner_test2@example.com",
            password="examinerpassword",
            role=User.Role.EXAMINER
        )
        student = User.objects.create_user(
            username="student_test2",
            email="student_test2@example.com",
            password="studentpassword",
            role=User.Role.STUDENT
        )
        exam = Exam.objects.create(
            title="Algorithm Design Exam",
            subject="Computer Science",
            duration_minutes=90,
            start_window=timezone.now() - timedelta(hours=1),
            end_window=timezone.now() + timedelta(hours=1),
            enable_webcam=True,
            randomize_questions=False,
            config_rules={"easy_count": 0, "medium_count": 0, "hard_count": 0},
            created_by=examiner
        )

        # Authenticate examiner
        login_res = client.post('/api/auth/login/', {
            "username": "examiner_test2",
            "password": "examinerpassword"
        })
        token = login_res.data['access']

        # Send exam link email
        data = {
            "username": "student_test2",
            "email": "student_test2@example.com",
            "exam_id": exam.id
        }
        res = client.post('/api/auth/send-exam-link/', data, HTTP_AUTHORIZATION=f'Bearer {token}')
        assert res.status_code == status.HTTP_200_OK

        # Verify email was sent with correct attributes
        assert len(mail.outbox) == 1
        assert mail.outbox[0].from_email == settings.DEFAULT_FROM_EMAIL
        assert "student_test2@example.com" in mail.outbox[0].to
        assert "Algorithm Design Exam" in mail.outbox[0].body
        assert f"/student/exam/{exam.id}" in mail.outbox[0].body
