from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExamViewSet, StudentExamSessionViewSet

router = DefaultRouter()
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'session', StudentExamSessionViewSet, basename='exam-session')

urlpatterns = [
    path('', include(router.urls)),
]
