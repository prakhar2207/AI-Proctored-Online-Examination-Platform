import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.question_bank.models import Question, Option

User = get_user_model()

@pytest.fixture
def api_clients(db):
    from rest_framework.test import APIClient
    
    examiner = User.objects.create_user(
        username="examiner_qb",
        email="examiner_qb@example.com",
        password="password123",
        role=User.Role.EXAMINER
    )
    student = User.objects.create_user(
        username="student_qb",
        email="student_qb@example.com",
        password="password123",
        role=User.Role.STUDENT
    )
    
    ex_client = APIClient()
    ex_client.force_authenticate(user=examiner)
    
    st_client = APIClient()
    st_client.force_authenticate(user=student)
    
    anon_client = APIClient()
    
    return {
        "ex_client": ex_client,
        "st_client": st_client,
        "anon_client": anon_client,
        "examiner": examiner
    }

@pytest.mark.django_db
class TestRegistrationAndQuestionBank:
    def test_only_student_registration_allowed(self, api_clients):
        client = api_clients["anon_client"]
        
        # 1. Attempt to register as examiner -> Should fail
        payload_ex = {
            "username": "new_examiner",
            "email": "new_ex@example.com",
            "password": "password123",
            "role": "examiner"
        }
        res_ex = client.post('/api/auth/register/', payload_ex)
        assert res_ex.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only student self-registration is allowed." in str(res_ex.data)

        # 2. Attempt to register as admin -> Should fail
        payload_ad = {
            "username": "new_admin",
            "email": "new_ad@example.com",
            "password": "password123",
            "role": "admin"
        }
        res_ad = client.post('/api/auth/register/', payload_ad)
        assert res_ad.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only student self-registration is allowed." in str(res_ad.data)

        # 3. Register as student -> Should succeed
        payload_st = {
            "username": "new_student",
            "email": "new_st@example.com",
            "password": "password123",
            "role": "student"
        }
        res_st = client.post('/api/auth/register/', payload_st)
        assert res_st.status_code == status.HTTP_201_CREATED
        assert res_st.data["role"] == "student"

    @patch('apps.question_bank.pdf_parser.PDFQuestionParser.extract_text_from_pdf')
    def test_upload_pdf_questions(self, mock_extract, api_clients):
        client = api_clients["ex_client"]
        
        # Setup mock PDF content
        mock_extract.return_value = """
        Q1. What is Python?
        a) A programming language
        b) A snake
        c) An IDE
        d) An operating system

        Q2. Explain decorators in Python.
        
        Q3. Explain in detail the memory management structure of Python garbage collector.
        """
        
        mock_pdf = SimpleUploadedFile("test_paper.pdf", b"dummy pdf content", content_type="application/pdf")
        
        # Perform request
        payload = {
            "subject": "Python Basics",
            "difficulty": "medium",
            "file": mock_pdf
        }
        response = client.post('/api/question-bank/questions/upload-pdf/', payload, format='multipart')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["created_count"] == 3
        
        # Verify database objects
        questions = Question.objects.filter(subject="Python Basics").order_by('id')
        assert len(questions) == 3
        
        # Question 1: MCQ
        assert questions[0].question_type == Question.QuestionType.MCQ
        assert questions[0].text == "What is Python?"
        assert questions[0].options.count() == 4
        
        # Question 2: Short Answer
        assert questions[1].question_type == Question.QuestionType.SHORT_ANSWER
        assert "Explain decorators" in questions[1].text
        
        # Question 3: Long Answer (Guessed from "Explain in detail")
        assert questions[2].question_type == Question.QuestionType.LONG_ANSWER
        assert "memory management structure" in questions[2].text

    def test_upload_pdf_permission_denied_for_students(self, api_clients):
        client = api_clients["st_client"]
        mock_pdf = SimpleUploadedFile("test_paper.pdf", b"dummy pdf content", content_type="application/pdf")
        
        payload = {
            "subject": "Python Basics",
            "difficulty": "medium",
            "file": mock_pdf
        }
        response = client.post('/api/question-bank/questions/upload-pdf/', payload, format='multipart')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_edit_question_success(self, api_clients):
        ex_client = api_clients["ex_client"]
        examiner = api_clients["examiner"]

        question = Question.objects.create(
            question_type=Question.QuestionType.MCQ,
            text="Original question text?",
            subject="Python",
            difficulty="easy",
            marks=2.0,
            created_by=examiner
        )
        Option.objects.create(question=question, text="Opt 1", is_correct=True)
        Option.objects.create(question=question, text="Opt 2", is_correct=False)

        update_payload = {
            "question_type": "mcq",
            "text": "Updated question text?",
            "subject": "Python",
            "difficulty": "hard",
            "marks": 5.0,
            "negative_marks": 1.0,
            "model_answer": "",
            "options": [
                {"text": "New Opt 1", "is_correct": False},
                {"text": "New Opt 2", "is_correct": True}
            ]
        }

        response = ex_client.patch(f'/api/question-bank/questions/{question.id}/', update_payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        
        question.refresh_from_db()
        assert question.text == "Updated question text?"
        assert question.difficulty == "hard"
        assert float(question.marks) == 5.0
        assert question.options.count() == 2
        assert question.options.get(is_correct=True).text == "New Opt 2"

    def test_bulk_delete_questions_success(self, api_clients):
        ex_client = api_clients["ex_client"]
        examiner = api_clients["examiner"]

        q1 = Question.objects.create(question_type=Question.QuestionType.MCQ, text="Bulk Del Q1", subject="Python", difficulty="easy", created_by=examiner)
        q2 = Question.objects.create(question_type=Question.QuestionType.MCQ, text="Bulk Del Q2", subject="Python", difficulty="easy", created_by=examiner)
        q3 = Question.objects.create(question_type=Question.QuestionType.MCQ, text="Keep Q3", subject="Python", difficulty="easy", created_by=examiner)

        response = ex_client.post('/api/question-bank/questions/bulk-delete/', {"question_ids": [q1.id, q2.id]}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted_count"] == 2

        assert not Question.objects.filter(id=q1.id).exists()
        assert not Question.objects.filter(id=q2.id).exists()
        assert Question.objects.filter(id=q3.id).exists()

