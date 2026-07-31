from rest_framework import serializers
from apps.exams.models import Answer, Result, ExamSession
from apps.question_bank.serializers import QuestionSerializer

class AnswerGradingSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    student_username = serializers.CharField(source='session.student.username', read_only=True)
    exam_title = serializers.CharField(source='session.exam.title', read_only=True)

    class Meta:
        model = Answer
        fields = (
            'id', 'session', 'student_username', 'exam_title', 'question',
            'text_answer', 'image_answer', 'word_count', 'score',
            'is_evaluated', 'ai_justification', 'examiner_feedback'
        )
        read_only_fields = ('id', 'session', 'student_username', 'exam_title', 'question', 'text_answer', 'image_answer', 'word_count', 'ai_justification')

class ScoreOverrideSerializer(serializers.Serializer):
    score = serializers.DecimalField(max_digits=5, decimal_places=2)
    examiner_feedback = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_score(self, value):
        # We will validate the score is positive. We check the upper bound in the view
        # since we need access to the Answer model's question max marks.
        if value < 0:
            raise serializers.ValidationError("Score cannot be negative.")
        return value
