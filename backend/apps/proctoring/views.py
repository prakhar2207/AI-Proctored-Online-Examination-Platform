from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import ProctorEvent, SuspicionScore
from .serializers import ProctorEventSerializer, SuspicionScoreSerializer
from apps.users.permissions import IsExaminer
from apps.exams.models import ExamSession

class ProctorEventViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProctorEventSerializer
    permission_classes = [IsExaminer]

    def get_queryset(self):
        # Allow filtering events by session_id
        session_id = self.request.query_params.get('session_id')
        if session_id:
            return ProctorEvent.objects.filter(session_id=session_id).order_by('-timestamp')
        return ProctorEvent.objects.all().order_by('-timestamp')

    @action(detail=False, methods=['get'], url_path=r'summary/(?P<session_id>\d+)')
    def summary(self, request, session_id=None):
        session = get_object_or_404(ExamSession, pk=session_id)
        score_obj, created = SuspicionScore.objects.get_or_create(session=session)
        serializer = SuspicionScoreSerializer(score_obj)
        return Response(serializer.data)
