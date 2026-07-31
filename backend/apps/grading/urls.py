from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GradingQueueViewSet

router = DefaultRouter()
router.register(r'portal', GradingQueueViewSet, basename='grading-portal')

urlpatterns = [
    path('', include(router.urls)),
]
