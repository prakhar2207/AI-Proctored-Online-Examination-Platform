from rest_framework import serializers
from .models import ProctorEvent, SuspicionScore

class ProctorEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = ProctorEvent
        fields = ('id', 'event_type', 'event_type_display', 'suspicion_increment', 'timestamp', 'details')

class SuspicionScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuspicionScore
        fields = ('id', 'score', 'warnings_count', 'updated_at')
