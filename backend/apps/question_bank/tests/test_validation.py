import pytest
from rest_framework.exceptions import ValidationError
from apps.question_bank.serializers import QuestionSerializer
from apps.question_bank.models import Question

@pytest.mark.django_db
class TestQuestionBankValidation:
    def test_mcq_exactly_one_correct_option(self):
        # 1. Zero correct options -> Should fail validation
        data_zero = {
            "question_type": "mcq",
            "text": "What is Python?",
            "subject": "CS",
            "difficulty": "medium",
            "marks": 2,
            "options": [
                {"text": "A programming language", "is_correct": False},
                {"text": "A snake", "is_correct": False}
            ]
        }
        serializer = QuestionSerializer(data=data_zero)
        # Pass the options to initial_data since DRF validates it from initial_data in our custom validate method
        serializer.initial_data = data_zero
        with pytest.raises(ValidationError) as excinfo:
            serializer.is_valid(raise_exception=True)
        assert "Multiple Choice Questions (MCQ) must have exactly one correct option." in str(excinfo.value)

        # 2. Multiple correct options -> Should fail validation
        data_multiple = {
            "question_type": "mcq",
            "text": "What is Python?",
            "subject": "CS",
            "difficulty": "medium",
            "marks": 2,
            "options": [
                {"text": "A programming language", "is_correct": True},
                {"text": "A snake", "is_correct": True}
            ]
        }
        serializer = QuestionSerializer(data=data_multiple)
        serializer.initial_data = data_multiple
        with pytest.raises(ValidationError) as excinfo:
            serializer.is_valid(raise_exception=True)
        assert "Multiple Choice Questions (MCQ) must have exactly one correct option." in str(excinfo.value)

        # 3. Exactly one correct option -> Should succeed validation
        data_valid = {
            "question_type": "mcq",
            "text": "What is Python?",
            "subject": "CS",
            "difficulty": "medium",
            "marks": 2,
            "options": [
                {"text": "A programming language", "is_correct": True},
                {"text": "A snake", "is_correct": False}
            ]
        }
        serializer = QuestionSerializer(data=data_valid)
        serializer.initial_data = data_valid
        assert serializer.is_valid(raise_exception=True) is True

    def test_image_upload_max_marks_defined(self):
        # 1. Image upload with 0 marks -> Should fail validation
        data_zero_marks = {
            "question_type": "image_upload",
            "text": "Upload handwritten code.",
            "subject": "CS",
            "difficulty": "hard",
            "marks": 0
        }
        serializer = QuestionSerializer(data=data_zero_marks)
        serializer.initial_data = data_zero_marks
        with pytest.raises(ValidationError) as excinfo:
            serializer.is_valid(raise_exception=True)
        assert "Image upload questions must have positive max marks defined." in str(excinfo.value)

        # 2. Image upload with positive marks -> Should succeed validation
        data_valid_marks = {
            "question_type": "image_upload",
            "text": "Upload handwritten code.",
            "subject": "CS",
            "difficulty": "hard",
            "marks": 5
        }
        serializer = QuestionSerializer(data=data_valid_marks)
        serializer.initial_data = data_valid_marks
        assert serializer.is_valid(raise_exception=True) is True
