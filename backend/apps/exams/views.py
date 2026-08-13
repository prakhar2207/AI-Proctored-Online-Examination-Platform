from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from datetime import timedelta

from .models import Exam, ExamSession, ExamQuestion, Answer, Result
from .serializers import ExamSerializer, ExamSessionSerializer, ExamQuestionSerializer, AnswerSubmitSerializer
from .services import ExamService
from .tasks import auto_submit_exam_task
from apps.users.permissions import IsExaminer, IsStudent
from apps.question_bank.models import Option

class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'enter', 'mock_subjects', 'start_mock']:
            return [permissions.IsAuthenticated()]
        return [IsExaminer()]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.is_student():
            from django.db.models import Q
            # Students can see assigned exams (sessions), targeted individual exams, mass cohort exams, and system mock exams
            return queryset.filter(
                Q(sessions__student=user) | 
                Q(target_student=user) | 
                Q(exam_type=Exam.ExamType.MASS) | 
                Q(is_mock=True)
            ).distinct()
        if user.is_examiner():
            # Examiners see exams created by them
            return queryset.filter(created_by=user)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def mock_subjects(self, request):
        """
        Returns list of subjects available for launching AI practice mock exams.
        """
        from apps.question_bank.models import Question
        distinct_subjects = list(Question.objects.values_list('subject', flat=True).distinct())
        default_subjects = ['Physics', 'Chemistry', 'Mathematics', 'Aptitude', 'Verbal Ability', 'Computer Science']
        all_subjects = sorted(list(set([s for s in (distinct_subjects + default_subjects) if s])))
        return Response({"subjects": all_subjects})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def start_mock(self, request):
        """
        Generates and starts an instant AI practice mock exam for the student.
        """
        raw_subject = request.data.get('subject', 'General Aptitude')
        duration = int(request.data.get('duration_minutes', 45))
        now = timezone.now()

        # Subject normalization map for translated frontend values
        subject_map = {
            'मौखिक क्षमता': 'Verbal Ability',
            'मात्रात्मक योग्यता': 'Quantitative Aptitude',
            'तार्किक तर्क': 'Logical Reasoning',
            'सामान्य ज्ञान': 'General Knowledge',
            'गणित': 'Mathematics',
            'भौतिक विज्ञान': 'Physics',
            'रसायन विज्ञान': 'Chemistry',
            'कंप्यूटर विज्ञान': 'Computer Science',
            'योग्यता (एप्टीट्यूड)': 'Aptitude'
        }
        subject = subject_map.get(raw_subject, raw_subject)

        # Create or retrieve systemic mock exam for this subject
        exam, created = Exam.objects.get_or_create(
            title=f"AI Practice Mock Exam - {subject}",
            subject=subject,
            is_mock=True,
            defaults={
                'duration_minutes': max(45, duration),
                'start_window': now - timezone.timedelta(hours=1),
                'end_window': now + timezone.timedelta(days=365),
                'grading_mode': Exam.GradingMode.FULL_AI,
                'exam_type': Exam.ExamType.INDIVIDUAL,
                'enable_webcam': False,
                'config_rules': {'easy_marks': 2, 'medium_marks': 4, 'hard_marks': 6}
            }
        )

        # Create or reset student session for mock exam
        session, s_created = ExamSession.objects.get_or_create(
            student=request.user,
            exam=exam,
            defaults={'status': ExamSession.Status.IN_PROGRESS}
        )

        if not s_created and session.status != ExamSession.Status.IN_PROGRESS:
            session.status = ExamSession.Status.IN_PROGRESS
            session.submitted_at = None
            session.save()
            ExamQuestion.objects.filter(session=session).delete()
            Answer.objects.filter(session=session).delete()
            Result.objects.filter(session=session).delete()

        # Generate paper with random questions for this subject
        ExamService.generate_random_paper(session)

        return Response({
            "session_id": session.id,
            "exam_id": exam.id,
            "title": exam.title,
            "subject": exam.subject
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Creates an Exam and its associated ExamSections with specific or random questions.
        """
        data = request.data.copy()
        sections_data = data.pop('sections', [])
        assign_student_ids = data.pop('assign_student_ids', [])

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        exam = serializer.save(created_by=request.user)

        from .models import ExamSection, ExamSectionQuestion
        from django.db import transaction

        for index, sec_data in enumerate(sections_data):
            sec = ExamSection.objects.create(
                exam=exam,
                name=sec_data.get('name', f"Section {index + 1}"),
                description=sec_data.get('description', ''),
                order=sec_data.get('order', index + 1),
                config_rules=sec_data.get('config_rules', {}),
                use_random=sec_data.get('use_random', False)
            )
            
            # If specifically chosen questions are passed
            question_ids = sec_data.get('question_ids', [])
            if not sec.use_random and question_ids:
                for q_order, q_id in enumerate(question_ids):
                    ExamSectionQuestion.objects.create(
                        section=sec,
                        question_id=q_id,
                        order=q_order + 1
                    )

        # Auto-assign if individual exam target student is set
        if exam.exam_type == exam.ExamType.INDIVIDUAL and exam.target_student:
            session, created = ExamSession.objects.get_or_create(
                student=exam.target_student,
                exam=exam,
                defaults={'status': ExamSession.Status.IN_PROGRESS}
            )
            if created:
                ExamService.generate_random_paper(session)

        # Optional: assign immediately to a list of student IDs
        if assign_student_ids:
            for s_id in assign_student_ids:
                session, created = ExamSession.objects.get_or_create(
                    student_id=s_id,
                    exam=exam,
                    defaults={'status': ExamSession.Status.IN_PROGRESS}
                )
                if created:
                    ExamService.generate_random_paper(session)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], permission_classes=[IsExaminer])
    def assign(self, request, pk=None):
        exam = self.get_object()
        student_ids = request.data.get('student_ids', [])
        created_sessions = 0
        
        for s_id in student_ids:
            session, created = ExamSession.objects.get_or_create(
                student_id=s_id,
                exam=exam,
                defaults={'status': ExamSession.Status.IN_PROGRESS}
            )
            if created:
                # Pre-generate exam questions deterministically
                ExamService.generate_random_paper(session)
                created_sessions += 1
                
        return Response({"status": f"Exam assigned successfully to {len(student_ids)} students. {created_sessions} new sessions started."})


    @action(detail=True, methods=['post'], permission_classes=[IsStudent])
    def enter(self, request, pk=None):
        """
        Secures entry into an exam. Creates or retrieves the student's session.
        Prevents multiple parallel sessions and checks window boundaries.
        Schedules Celery auto-submission.
        """
        student = request.user
        now = timezone.now()

        exam = get_object_or_404(Exam, pk=pk)

        # Check if exam has been assigned to this student or is a system mock exam
        if not exam.is_mock and not ExamSession.objects.filter(student=student, exam_id=pk).exists():
            return Response(
                {"error": "This examination paper has not been assigned to you."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check exam start/end windows
        if now < exam.start_window:
            return Response(
                {"error": f"Exam has not started yet. Starts at {exam.start_window}."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if now > exam.end_window:
            return Response(
                {"error": "Exam window has closed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce single active session per student/exam
        session, created = ExamSession.objects.get_or_create(
            student=student,
            exam=exam,
            defaults={'status': ExamSession.Status.IN_PROGRESS}
        )

        if not created and session.status != ExamSession.Status.IN_PROGRESS:
            return Response(
                {"error": "You have already completed or submitted this exam."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate the randomized/deterministic paper
        questions = ExamService.generate_random_paper(session)

        # Schedule background auto-submit task if newly created
        if created:
            try:
                eta_delay = exam.duration_minutes * 60
                auto_submit_exam_task.apply_async(
                    args=[session.id],
                    countdown=eta_delay
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not schedule background auto-submit task (Redis might be offline): {e}")


        serializer = ExamSessionSerializer(session)
        return Response({
            "session": serializer.data,
            "questions_count": len(questions)
        }, status=status.HTTP_200_OK)

class StudentExamSessionViewSet(viewsets.ViewSet):
    permission_classes = [IsStudent]

    def _get_active_session(self, request):
        token = request.headers.get('X-Exam-Session-Token')
        if not token:
            raise ValidationError("X-Exam-Session-Token header is required.")
        return get_object_or_404(ExamSession, session_token=token, student=request.user, status=ExamSession.Status.IN_PROGRESS)

    @action(detail=False, methods=['get'])
    def questions(self, request):
        """
        Delivers the student's specific question paper.
        """
        session = self._get_active_session(request)
        exam_questions = ExamQuestion.objects.filter(session=session).order_by('order')
        serializer = ExamQuestionSerializer(exam_questions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='submit-answer')
    def submit_answer(self, request):
        """
        Records the answer choice or text submission for a specific question.
        Includes server-side time checks.
        """
        session = self._get_active_session(request)
        
        # Enforce server-side time remaining calculation (do not trust client clock)
        elapsed = timezone.now() - session.start_time
        max_duration = session.exam.duration_minutes * 60
        if elapsed.total_seconds() > max_duration + 30:  # 30 seconds grace time for network latency
            session.status = ExamSession.Status.AUTO_SUBMITTED
            session.submitted_at = timezone.now()
            session.save()
            ExamService.calculate_exam_results(session)
            return Response(
                {"error": "Exam duration expired. Session has been auto-submitted."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        question_id = serializer.validated_data['question'].id
        # Verify the question belongs to this student's generated exam session
        if not ExamQuestion.objects.filter(session=session, question_id=question_id).exists():
            return Response({"error": "Question is not part of this exam."}, status=status.HTTP_400_BAD_REQUEST)

        # Create or update Answer
        answer, created = Answer.objects.get_or_create(
            session=session,
            question_id=question_id
        )
        
        selected_option_ids = serializer.validated_data.get('selected_options', [])
        if selected_option_ids:
            answer.selected_options.set(Option.objects.filter(id__in=selected_option_ids))
        
        answer.text_answer = serializer.validated_data.get('text_answer', answer.text_answer)
        
        # Handle handwritten image upload if present
        if 'image_answer' in request.FILES:
            answer.image_answer = request.FILES['image_answer']
            
        answer.word_count = serializer.validated_data.get('word_count', answer.word_count)
        answer.save()

        # Run MCQ auto-grading immediately on submit if objective
        if answer.question.question_type in [Question.QuestionType.MCQ, Question.QuestionType.MULTI_SELECT]:
            ExamService.evaluate_objective_answer(answer)

        return Response({"status": "Answer saved successfully"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def finish(self, request):
        """
        Manually completes the exam, locks submission, and triggers grading.
        """
        session = self._get_active_session(request)
        session.status = ExamSession.Status.SUBMITTED
        session.submitted_at = timezone.now()
        session.save()

        # Grade objective questions and initialize results
        result = ExamService.calculate_exam_results(session)

        # Trigger inline synchronous grading for mock or full AI exams
        if session.exam.is_mock or session.exam.grading_mode == Exam.GradingMode.FULL_AI:
            try:
                from apps.grading.tasks import evaluate_session_subjective_inline
                result = evaluate_session_subjective_inline(session)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to execute inline subjective evaluation: {e}")
        else:
            try:
                from apps.grading.tasks import grade_subjective_answers_for_session_task
                grade_subjective_answers_for_session_task.delay(session.id)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not trigger background subjective grading task (Redis might be offline): {e}")

        # Summary of question-by-question scores & feedback for instant UI scorecard
        answers_summary = []
        for ans in Answer.objects.filter(session=session).select_related('question'):
            answers_summary.append({
                "question_id": ans.question.id,
                "question_text": ans.question.text,
                "score": ans.score,
                "is_evaluated": ans.is_evaluated,
                "feedback": ans.ai_justification or ans.examiner_feedback or ""
            })

        return Response({
            "status": "Exam finished and submitted successfully.",
            "is_mock": session.exam.is_mock,
            "exam_id": session.exam.id,
            "session_id": session.id,
            "total_score": str(result.total_score),
            "percentile": result.percentile,
            "finalized": result.finalized,
            "answers": answers_summary
        }, status=status.HTTP_200_OK)
