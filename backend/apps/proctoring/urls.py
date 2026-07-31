from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProctorEventViewSet

router = DefaultRouter()
router.register(r'events', ProctorEventViewSet, basename='proctor-event')

urlpatterns = [
    path('', include(router.urls)),
]
