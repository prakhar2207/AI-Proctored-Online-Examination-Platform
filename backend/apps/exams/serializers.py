from rest_framework import serializers
from django.utils import timezone
from .models import Exam, ExamSession, ExamQuestion, Answer, Result, ExamSection, ExamSectionQuestion
from apps.question_bank.serializers import QuestionSerializer

class ExamSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSection
        fields = ('id', 'name', 'description', 'order', 'use_random', 'config_rules')

class ExamSerializer(serializers.ModelSerializer):
    sections = ExamSectionSerializer(many=True, read_only=True)
    student_session_status = serializers.SerializerMethodField()
    target_student_username = serializers.CharField(source='target_student.username', read_only=True)
    target_student_email = serializers.CharField(source='target_student.email', read_only=True)

    class Meta:
        model = Exam
        fields = '__all__'
        read_only_fields = ('id', 'created_by', 'created_at')

    def get_student_session_status(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and request.user.is_student():
            session = obj.sessions.filter(student=request.user).first()
            if session:
                return session.status
        return None

    def validate(self, data):
        duration_minutes = data.get('duration_minutes', getattr(self.instance, 'duration_minutes', None))
        if duration_minutes is not None and duration_minutes < 45:
            raise serializers.ValidationError({"duration_minutes": "Minimum assessment duration must be at least 45 minutes."})

        start_window = data.get('start_window')
        end_window = data.get('end_window')
        if start_window and end_window:
            if end_window <= start_window:
                raise serializers.ValidationError({"end_window": "End window must be after the start window."})

        gaze_sensitivity = data.get('gaze_sensitivity')
        if gaze_sensitivity is not None:
            try:
                gaze_val = float(gaze_sensitivity)
                if gaze_val < 0.0 or gaze_val > 1.0:
                    raise ValueError()
            except ValueError:
                raise serializers.ValidationError({"gaze_sensitivity": "Gaze sensitivity must be between 0.0 and 1.0."})

        max_tab_switches = data.get('max_tab_switches')
        if max_tab_switches is not None and max_tab_switches < 0:
            raise serializers.ValidationError({"max_tab_switches": "Maximum tab switches warning count cannot be negative."})

        return data


class ExamQuestionSerializer(serializers.ModelSerializer):
    question = QuestionSerializer()
    section_id = serializers.IntegerField(source='section.id', read_only=True, allow_null=True)
    section_name = serializers.CharField(source='section.name', read_only=True, allow_null=True)
    section_order = serializers.IntegerField(source='section.order', read_only=True, allow_null=True)

    class Meta:
        model = ExamQuestion
        fields = ('id', 'question', 'order', 'section_id', 'section_name', 'section_order')

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        exam = instance.session.exam
        difficulty = instance.question.difficulty
        rep['question']['marks'] = exam.config_rules.get(f"{difficulty}_marks", instance.question.marks)
        rep['question']['negative_marks'] = exam.config_rules.get(f"{difficulty}_negative_marks", instance.question.negative_marks)
        return rep


class ExamSessionSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    duration_minutes = serializers.IntegerField(source='exam.duration_minutes', read_only=True)
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = ('id', 'exam', 'exam_title', 'session_token', 'start_time', 'duration_minutes', 'time_remaining_seconds', 'status')
        read_only_fields = ('id', 'session_token', 'start_time', 'status')

    def get_time_remaining_seconds(self, obj):
        elapsed = timezone.now() - obj.start_time
        total_seconds = obj.exam.duration_minutes * 60
        remaining = total_seconds - elapsed.total_seconds()
        return max(0, int(remaining))

class AnswerSubmitSerializer(serializers.ModelSerializer):
    selected_options = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, default=[]
    )

    class Meta:
        model = Answer
        fields = ('id', 'question', 'selected_options', 'text_answer', 'image_answer', 'image_thumbnail', 'word_count')
        read_only_fields = ('id', 'image_thumbnail', 'word_count')

    def validate(self, data):
        question = data.get('question')
        text_answer = data.get('text_answer', '')
        
        # Word count calculation & validation
        if text_answer:
            words = len(text_answer.split())
            data['word_count'] = words
            
            if question:
                if question.question_type == 'short_answer':
                    if words > 250:
                        raise serializers.ValidationError({"text_answer": "Short answer response cannot exceed 250 words."})
                elif question.question_type == 'long_answer':
                    if words < 10:
                        raise serializers.ValidationError({"text_answer": "Long answer response must be at least 10 words."})
                    if words > 1000:
                        raise serializers.ValidationError({"text_answer": "Long answer response cannot exceed 1000 words."})
        return data
