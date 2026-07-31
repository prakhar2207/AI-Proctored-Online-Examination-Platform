from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import QuestionViewSet, UploadedPDFViewSet, SubjectViewSet

router = DefaultRouter()
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'uploaded-pdfs', UploadedPDFViewSet, basename='uploaded-pdf')
router.register(r'subjects', SubjectViewSet, basename='subject')

urlpatterns = [
    path('', include(router.urls)),
]
