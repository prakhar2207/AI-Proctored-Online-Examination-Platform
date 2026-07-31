import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

User = get_user_model()

@pytest.mark.django_db
class TestAuthenticationAPI:
    def test_user_registration(self, client):
        data = {
            "username": "student1",
            "email": "student1@example.com",
            "password": "securepassword123",
            "role": "student"
        }
        response = client.post('/api/auth/register/', data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['username'] == 'student1'
        assert response.data['role'] == 'student'

        # Check in DB
        user = User.objects.get(username="student1")
        assert user.role == User.Role.STUDENT
        assert user.check_password("securepassword123")

    def test_jwt_login(self, client):
        # Create user
        user = User.objects.create_user(
            username="examiner1",
            email="examiner1@example.com",
            password="examinerpassword",
            role=User.Role.EXAMINER
        )

        # Login
        data = {
            "username": "examiner1",
            "password": "examinerpassword"
        }
        response = client.post('/api/auth/login/', data)
        assert response.status_code == status.HTTP_200_OK
        
        # Verify tokens returned
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert response.data['role'] == 'examiner'
        assert response.data['username'] == 'examiner1'

    def test_jwt_login_invalid_password(self, client):
        # Create user
        user = User.objects.create_user(
            username="student2",
            email="student2@example.com",
            password="correctpassword",
            role=User.Role.STUDENT
        )

        # Login with bad password
        data = {
            "username": "student2",
            "password": "wrongpassword"
        }
        response = client.post('/api/auth/login/', data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh(self, client):
        # Create user
        user = User.objects.create_user(
            username="admin1",
            email="admin1@example.com",
            password="adminpassword",
            role=User.Role.ADMIN
        )

        # Get initial token
        response = client.post('/api/auth/login/', {
            "username": "admin1",
            "password": "adminpassword"
        })
        refresh_token = response.data['refresh']

        # Refresh it
        response_refresh = client.post('/api/auth/token/refresh/', {
            "refresh": refresh_token
        })
        assert response_refresh.status_code == status.HTTP_200_OK
        assert 'access' in response_refresh.data
