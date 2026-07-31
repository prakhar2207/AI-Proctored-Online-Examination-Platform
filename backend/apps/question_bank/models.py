from django.db import models
from django.conf import settings

class Subject(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class UploadedPDF(models.Model):
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='uploaded_question_pdfs/')
    subject = models.CharField(max_length=100)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_pdfs'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.subject})"

class Question(models.Model):
    class QuestionType(models.TextChoices):
        MCQ = 'mcq', 'Multiple Choice'
        MULTI_SELECT = 'multi_select', 'Multi Select Checkbox'
        ONE_WORD = 'one_word', 'Answer in One Word'
        FILL_BLANK = 'fill_blank', 'Fill in the Blank'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        LONG_ANSWER = 'long_answer', 'Long Answer'
        IMAGE_UPLOAD = 'image_upload', 'Handwritten Image Upload'

    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Easy'
        MEDIUM = 'medium', 'Medium'
        HARD = 'hard', 'Hard'

    question_type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.MCQ
    )
    text = models.TextField()
    subject = models.CharField(max_length=100, db_index=True)
    difficulty = models.CharField(
        max_length=10,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM
    )
    marks = models.PositiveIntegerField(default=1)
    negative_marks = models.DecimalField(max_digits=4, decimal_places=2, default=0.0)
    model_answer = models.TextField(blank=True, null=True, help_text="Used for LLM grading validation")
    
    pdf_source = models.ForeignKey(
        UploadedPDF,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='questions'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_questions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.subject}] {self.text[:50]}... ({self.get_question_type_display()})"


class Option(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='options'
    )
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"Option for Q{self.question_id}: {self.text[:30]} ({'Correct' if self.is_correct else 'Incorrect'})"
