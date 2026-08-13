import uuid
from django.db import models
from django.conf import settings
from apps.question_bank.models import Question, Option

class Exam(models.Model):
    title = models.CharField(max_length=200)
    subject = models.CharField(max_length=100, db_index=True)
    duration_minutes = models.PositiveIntegerField()
    start_window = models.DateTimeField()
    end_window = models.DateTimeField()
    randomize_questions = models.BooleanField(default=True)
    is_mock = models.BooleanField(default=False, help_text="Mock practice exam open to all students")
    
    # Selection rules configuration, e.g. {"easy_count": 5, "medium_count": 5, "hard_count": 2, "mcq_count": 6}
    config_rules = models.JSONField(default=dict)

    class GradingMode(models.TextChoices):
        FULL_AI = 'full_ai', 'Full AI Evaluation'
        SEMI_AI = 'semi_ai', 'Semi AI (Examiner Reviews)'
        MANUAL = 'manual', 'Manual Grading'

    grading_mode = models.CharField(
        max_length=20,
        choices=GradingMode.choices,
        default=GradingMode.SEMI_AI
    )

    class ExamType(models.TextChoices):
        MASS = 'mass', 'Mass Assessment (Cutoff & Percentile)'
        INDIVIDUAL = 'individual', 'Individual Assessment (Single Student)'

    exam_type = models.CharField(
        max_length=20,
        choices=ExamType.choices,
        default=ExamType.MASS,
        help_text="Mass cohort exam with cutoffs/percentiles or singular exam for a specific student"
    )
    cutoff_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Passing cutoff marks or score required for mass cohort assessment"
    )
    target_student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='targeted_individual_exams',
        help_text="Specific single student if exam_type is individual"
    )

    # Proctoring settings
    enable_webcam = models.BooleanField(default=True)
    gaze_sensitivity = models.DecimalField(max_digits=3, decimal_places=2, default=0.50)
    max_tab_switches = models.PositiveIntegerField(default=3)
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_exams'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.subject}) [{self.exam_type}]"

class ExamSession(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        SUBMITTED = 'submitted', 'Submitted'
        AUTO_SUBMITTED = 'auto_submitted', 'Auto Submitted'
        FLAGGED = 'flagged', 'Flagged'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='exam_sessions'
    )
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    session_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    start_time = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS
    )

    class Meta:
        unique_together = ('student', 'exam')

    def __str__(self):
        return f"{self.student.username} - {self.exam.title} ({self.get_status_display()})"

class ExamSection(models.Model):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='sections'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=1)
    
    # Config rules for section-based random selection, e.g. {"easy_count": 2, "mcq_count": 2, "pdf_source_id": 1}
    config_rules = models.JSONField(default=dict, blank=True)
    use_random = models.BooleanField(default=False)
    
    questions = models.ManyToManyField(
        Question,
        through='ExamSectionQuestion',
        blank=True
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.exam.title} - {self.name}"

class ExamSectionQuestion(models.Model):
    section = models.ForeignKey(ExamSection, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']
        unique_together = ('section', 'question')

class ExamQuestion(models.Model):
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='questions'
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE
    )
    order = models.PositiveIntegerField()
    section = models.ForeignKey(
        ExamSection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exam_questions'
    )

    class Meta:
        ordering = ['order']
        unique_together = ('session', 'question')


class Answer(models.Model):
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE
    )
    selected_options = models.ManyToManyField(Option, blank=True)
    text_answer = models.TextField(blank=True, null=True)
    image_answer = models.ImageField(upload_to='handwritten_answers/', blank=True, null=True)
    image_thumbnail = models.ImageField(upload_to='handwritten_answers/thumbnails/', blank=True, null=True)
    word_count = models.PositiveIntegerField(default=0)
    
    # Grading results
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_evaluated = models.BooleanField(default=False)
    ai_justification = models.TextField(blank=True, null=True)
    examiner_feedback = models.TextField(blank=True, null=True)

    def save(self, *args, **kwargs):
        # Update word count
        if self.text_answer:
            self.word_count = len(self.text_answer.split())
        else:
            self.word_count = 0

        # Generate thumbnail if image_answer is set
        if self.image_answer:
            from PIL import Image
            from io import BytesIO
            from django.core.files.base import ContentFile
            import os

            # Check if we already generated a thumbnail for this file to avoid infinite loops
            try:
                this = Answer.objects.get(id=self.id)
                image_changed = this.image_answer != self.image_answer
            except (Answer.DoesNotExist, ValueError):
                image_changed = True

            if image_changed:
                try:
                    img = Image.open(self.image_answer)
                    img.thumbnail((200, 200))
                    
                    thumb_io = BytesIO()
                    img.save(thumb_io, format=img.format or 'JPEG')
                    
                    base_name = os.path.basename(self.image_answer.name)
                    thumb_name = f"thumb_{base_name}"
                    
                    self.image_thumbnail.save(
                        thumb_name,
                        ContentFile(thumb_io.getvalue()),
                        save=False
                    )
                except Exception:
                    pass

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Answer by {self.session.student.username} for Q{self.question_id}"

class Result(models.Model):
    session = models.OneToOneField(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='result'
    )
    total_score = models.DecimalField(max_digits=6, decimal_places=2)
    percentile = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_passed = models.BooleanField(null=True, blank=True, help_text="True if cleared cutoff or passed criteria")
    graded_by_ai = models.BooleanField(default=False)
    finalized = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Result: {self.session.student.username} - {self.total_score} marks"
