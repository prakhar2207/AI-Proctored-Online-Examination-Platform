import pytest
from django.utils import timezone
from datetime import timedelta
from rest_framework.exceptions import ValidationError
from apps.exams.serializers import ExamSerializer

@pytest.mark.django_db
class TestExamConfigurationConstraints:
    def test_end_window_after_start_window(self):
        now = timezone.now()
        data = {
            "title": "Math Final",
            "subject": "Math",
            "duration_minutes": 60,
            "start_window": now + timedelta(hours=2),
            "end_window": now + timedelta(hours=1),  # Invalid: end before start
            "randomize_questions": True,
            "enable_webcam": True,
            "gaze_sensitivity": 0.5,
            "max_tab_switches": 3
        }
        serializer = ExamSerializer(data=data)
        with pytest.raises(ValidationError) as excinfo:
            serializer.is_valid(raise_exception=True)
        assert "End window must be after the start window." in str(excinfo.value)

    def test_duration_minutes_positive(self):
        now = timezone.now()
        data = {
            "title": "Math Final",
            "subject": "Math",
            "duration_minutes": 0,  # Invalid duration
            "start_window": now,
            "end_window": now + timedelta(hours=1),
            "randomize_questions": True,
            "enable_webcam": True,
            "gaze_sensitivity": 0.5,
            "max_tab_switches": 3
        }
        serializer = ExamSerializer(data=data)
        with pytest.raises(ValidationError) as excinfo:
            serializer.is_valid(raise_exception=True)
        assert "Minimum assessment duration must be at least 45 minutes." in str(excinfo.value)

    def test_gaze_sensitivity_range(self):
        now = timezone.now()
        
        # 1. Gaze sensitivity > 1.0 -> Invalid
        data_high = {
            "title": "Math Final",
            "subject": "Math",
            "duration_minutes": 60,
            "start_window": now,
            "end_window": now + timedelta(hours=1),
            "randomize_questions": True,
            "enable_webcam": True,
            "gaze_sensitivity": 1.2,
            "max_tab_switches": 3
        }
        serializer_high = ExamSerializer(data=data_high)
        with pytest.raises(ValidationError) as excinfo:
            serializer_high.is_valid(raise_exception=True)
        assert "Gaze sensitivity must be between 0.0 and 1.0." in str(excinfo.value)

        # 2. Gaze sensitivity < 0.0 -> Invalid
        data_low = {
            "title": "Math Final",
            "subject": "Math",
            "duration_minutes": 60,
            "start_window": now,
            "end_window": now + timedelta(hours=1),
            "randomize_questions": True,
            "enable_webcam": True,
            "gaze_sensitivity": -0.1,
            "max_tab_switches": 3
        }
        serializer_low = ExamSerializer(data=data_low)
        with pytest.raises(ValidationError) as excinfo:
            serializer_low.is_valid(raise_exception=True)
        assert "Gaze sensitivity must be between 0.0 and 1.0." in str(excinfo.value)

    def test_max_tab_switches_non_negative(self):
        now = timezone.now()
        data = {
            "title": "Math Final",
            "subject": "Math",
            "duration_minutes": 60,
            "start_window": now,
            "end_window": now + timedelta(hours=1),
            "randomize_questions": True,
            "enable_webcam": True,
            "gaze_sensitivity": 0.5,
            "max_tab_switches": -1  # Invalid negative limit
        }
        serializer = ExamSerializer(data=data)
        with pytest.raises(ValidationError) as excinfo:
            serializer.is_valid(raise_exception=True)
        assert "max_tab_switches" in excinfo.value.detail
