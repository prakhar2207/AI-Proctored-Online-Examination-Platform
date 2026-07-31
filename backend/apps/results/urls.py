from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentResultsViewSet

router = DefaultRouter()
router.register(r'student', StudentResultsViewSet, basename='student-results')

urlpatterns = [
    path('', include(router.urls)),
]
