from django.db import models
from apps.exams.models import ExamSession

class ProctorEvent(models.Model):
    class EventType(models.TextChoices):
        FACE_ABSENT = 'face_absent', 'Face Absent'
        MULTIPLE_FACES = 'multiple_faces', 'Multiple Faces Detected'
        GAZE_AWAY = 'gaze_away', 'Looking Away'
        TAB_SWITCH = 'tab_switch', 'Tab Switch'
        WINDOW_BLUR = 'window_blur', 'Window Focus Lost'
        FULLSCREEN_EXIT = 'fullscreen_exit', 'Fullscreen Exited'
        HEARTBEAT = 'heartbeat', 'Normal Heartbeat'

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='proctor_events'
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.HEARTBEAT
    )
    suspicion_increment = models.PositiveIntegerField(default=0)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.session.student.username} - {self.get_event_type_display()} (+{self.suspicion_increment})"

class SuspicionScore(models.Model):
    session = models.OneToOneField(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='suspicion_summary'
    )
    score = models.PositiveIntegerField(default=0)
    warnings_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def add_violation(self, event_type, increment=10):
        # Enforce cap at 100
        self.score = min(100, self.score + increment)
        
        # Track warning count for critical client actions (tab switch, exit fullscreen, etc.)
        if event_type in [
            ProctorEvent.EventType.TAB_SWITCH,
            ProctorEvent.EventType.WINDOW_BLUR,
            ProctorEvent.EventType.FULLSCREEN_EXIT
        ]:
            self.warnings_count += 1
            
        self.save()

    def __str__(self):
        return f"Suspicion Summary for {self.session.student.username}: Score={self.score}, Warnings={self.warnings_count}"
