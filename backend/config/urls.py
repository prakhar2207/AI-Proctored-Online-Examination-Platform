from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/auth/', include('apps.users.urls')),
    path('api/question-bank/', include('apps.question_bank.urls')),
    path('api/exam-engine/', include('apps.exams.urls')),
    path('api/proctor/', include('apps.proctoring.urls')),
    path('api/grading-portal/', include('apps.grading.urls')),
    path('api/results-portal/', include('apps.results.urls')),
]

# Serve media and static files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
