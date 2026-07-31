import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from apps.question_bank.models import Subject

User = get_user_model()

@pytest.fixture
def api_clients(db):
    from rest_framework.test import APIClient
    
    examiner = User.objects.create_user(
        username="ex_sub",
        email="ex_sub@example.com",
        password="password123",
        role=User.Role.EXAMINER
    )
    student = User.objects.create_user(
        username="st_sub",
        email="st_sub@example.com",
        password="password123",
        role=User.Role.STUDENT
    )
    
    ex_client = APIClient()
    ex_client.force_authenticate(user=examiner)
    
    st_client = APIClient()
    st_client.force_authenticate(user=student)
    
    return {
        "ex_client": ex_client,
        "st_client": st_client,
        "examiner": examiner,
        "student": student
    }

@pytest.mark.django_db
class TestSubjectEndpoints:
    def test_auto_seed_on_first_list(self, api_clients):
        # Database should be empty initially
        assert Subject.objects.count() == 0
        
        # Call list subjects as student (who is authenticated)
        client = api_clients["st_client"]
        res = client.get('/api/question-bank/subjects/')
        assert res.status_code == status.HTTP_200_OK
        
        # Verify 4 default subjects seeded
        subjects = res.json()
        assert len(subjects) == 4
        names = [s["name"] for s in subjects]
        assert "Python" in names
        assert "Chemistry" in names
        assert "Physics" in names
        assert "Mathematics" in names

    def test_examiner_can_add_subject(self, api_clients):
        client = api_clients["ex_client"]
        
        # Add a new subject
        payload = {"name": "Biology"}
        res = client.post('/api/question-bank/subjects/', payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert Subject.objects.filter(name="Biology").exists()

    def test_student_cannot_add_subject(self, api_clients):
        client = api_clients["st_client"]
        
        # Attempt to add a subject as student -> Should be forbidden
        payload = {"name": "History"}
        res = client.post('/api/question-bank/subjects/', payload)
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert not Subject.objects.filter(name="History").exists()

    def test_examiner_can_delete_subject(self, api_clients):
        # Create a subject to delete
        sub = Subject.objects.create(name="Philosophy")
        
        client = api_clients["ex_client"]
        res = client.delete(f'/api/question-bank/subjects/{sub.id}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not Subject.objects.filter(name="Philosophy").exists()
