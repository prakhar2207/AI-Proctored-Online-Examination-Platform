from rest_framework import serializers
from .models import Question, Option, UploadedPDF, Subject

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'

class UploadedPDFSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedPDF
        fields = '__all__'
        read_only_fields = ('id', 'uploaded_by', 'uploaded_at')

class OptionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Option
        fields = ('id', 'text', 'is_correct')

class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False, default=[])
    pdf_source_name = serializers.CharField(source='pdf_source.name', read_only=True, allow_null=True)

    class Meta:
        model = Question
        fields = (
            'id', 'question_type', 'text', 'subject', 'difficulty',
            'marks', 'negative_marks', 'model_answer', 'options',
            'pdf_source', 'pdf_source_name', 'created_by', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')


    def validate(self, data):
        q_type = data.get('question_type', getattr(self.instance, 'question_type', None))
        options_data = self.initial_data.get('options', [])
        marks = data.get('marks', getattr(self.instance, 'marks', 0))

        # Validation: image_upload questions must have max marks defined
        if q_type == Question.QuestionType.IMAGE_UPLOAD:
            if not marks or marks <= 0:
                raise serializers.ValidationError(
                    {"marks": "Image upload questions must have positive max marks defined."}
                )

        if q_type in [Question.QuestionType.MCQ, Question.QuestionType.MULTI_SELECT]:
            if not options_data or len(options_data) < 2:
                raise serializers.ValidationError(
                    {"options": "Objective questions (MCQ/Multi-select) must have at least 2 options."}
                )
            
            correct_count = sum(1 for opt in options_data if opt.get('is_correct') is True)
            
            # Validation: MCQ must have exactly one correct option
            if q_type == Question.QuestionType.MCQ and correct_count != 1:
                raise serializers.ValidationError(
                    {"options": "Multiple Choice Questions (MCQ) must have exactly one correct option."}
                )
            
            # Validation: Multi-select must have at least one correct option
            if q_type == Question.QuestionType.MULTI_SELECT and correct_count < 1:
                raise serializers.ValidationError(
                    {"options": "Multi-select questions must have at least one correct option."}
                )

        return data

    def create(self, validated_data):
        options_data = self.initial_data.get('options', [])
        # Remove options from validated_data so Question creation doesn't complain
        if 'options' in validated_data:
            validated_data.pop('options')
            
        question = Question.objects.create(**validated_data)
        
        for option_data in options_data:
            Option.objects.create(question=question, text=option_data['text'], is_correct=option_data.get('is_correct', False))
            
        return question

    def update(self, instance, validated_data):
        options_data = self.initial_data.get('options', None)
        
        # Remove options from validated_data so Question update doesn't complain about reverse relation assignment
        if 'options' in validated_data:
            validated_data.pop('options')

        # Update question details
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # If options are provided, recreate them to avoid state mismatch
        if options_data is not None:
            instance.options.all().delete()
            for option_data in options_data:
                Option.objects.create(
                    question=instance,
                    text=option_data['text'],
                    is_correct=option_data.get('is_correct', False)
                )

        return instance
