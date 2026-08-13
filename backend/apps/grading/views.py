from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db.models import Q, F
from django.utils import timezone

from apps.exams.models import Answer, ExamSession, Result
from apps.question_bank.models import Question
from apps.exams.services import ExamService
from .serializers import AnswerGradingSerializer, ScoreOverrideSerializer
from apps.users.permissions import IsExaminer

from apps.proctoring.models import ProctorEvent, SuspicionScore

class GradingQueueViewSet(viewsets.ViewSet):
    permission_classes = [IsExaminer]

    @action(detail=False, methods=['get'])
    def queue(self, request):
        """
        Lists all student assessment sessions containing attempted questions first and unanswered questions below them,
        along with proctoring suspicion metrics and event logs.
        """
        sessions = ExamSession.objects.filter(
            status__in=[
                ExamSession.Status.SUBMITTED,
                ExamSession.Status.AUTO_SUBMITTED,
                ExamSession.Status.FLAGGED,
                ExamSession.Status.IN_PROGRESS
            ]
        ).exclude(result__finalized=True).select_related('student', 'exam', 'suspicion_summary').prefetch_related(
            'questions__question',
            'answers__question',
            'proctor_events'
        ).order_by('-start_time')

        exam_id = request.query_params.get('exam_id')
        if exam_id:
            sessions = sessions.filter(exam_id=exam_id)

        session_list = []
        for session in sessions:
            eq_qs = session.questions.all().select_related('question').order_by('order')
            all_questions = [eq.question for eq in eq_qs if eq.question]

            answers = Answer.objects.filter(session=session).select_related('question')
            answers_dict = {ans.question_id: ans for ans in answers}

            attempted_list = []
            unanswered_list = []

            for q in all_questions:
                ans = answers_dict.get(q.id)
                difficulty = q.difficulty
                max_marks = session.exam.config_rules.get(f"{difficulty}_marks", q.marks)

                if ans and (ans.text_answer or ans.image_answer or (ans.selected_options and len(ans.selected_options) > 0) or ans.score is not None):
                    attempted_list.append({
                        'id': ans.id,
                        'question_id': q.id,
                        'question_type': q.question_type,
                        'question_text': q.text,
                        'marks': max_marks,
                        'text_answer': ans.text_answer,
                        'image_answer_url': ans.image_answer.url if ans.image_answer else None,
                        'word_count': ans.word_count,
                        'score': ans.score,
                        'is_evaluated': ans.is_evaluated,
                        'ai_justification': ans.ai_justification,
                        'examiner_feedback': ans.examiner_feedback
                    })
                else:
                    unanswered_list.append({
                        'question_id': q.id,
                        'question_type': q.question_type,
                        'question_text': q.text,
                        'marks': max_marks,
                        'status': 'Unanswered (0 Marks)'
                    })

            # Proctoring audit data
            score_obj = getattr(session, 'suspicion_summary', None)
            suspicion_score = score_obj.score if score_obj else 0
            warnings_count = score_obj.warnings_count if score_obj else 0

            events_qs = session.proctor_events.exclude(event_type=ProctorEvent.EventType.HEARTBEAT).order_by('-timestamp')
            proctor_events = []
            for ev in events_qs:
                proctor_events.append({
                    'id': ev.id,
                    'event_type': ev.event_type,
                    'event_type_display': ev.get_event_type_display(),
                    'suspicion_increment': ev.suspicion_increment,
                    'timestamp': ev.timestamp,
                    'details': ev.details
                })

            if attempted_list or unanswered_list or session.status in [ExamSession.Status.FLAGGED, ExamSession.Status.SUBMITTED, ExamSession.Status.AUTO_SUBMITTED]:
                session_list.append({
                    'session_id': session.id,
                    'student_username': session.student.username,
                    'student_email': session.student.email,
                    'exam_id': session.exam.id,
                    'exam_title': session.exam.title,
                    'status': session.status,
                    'start_time': session.start_time,
                    'submitted_at': session.submitted_at,
                    'total_questions': len(all_questions),
                    'attempted_count': len(attempted_list),
                    'unanswered_count': len(unanswered_list),
                    'is_fully_evaluated': all(a['is_evaluated'] for a in attempted_list) if attempted_list else True,
                    'suspicion_score': suspicion_score,
                    'warnings_count': warnings_count,
                    'max_allowed_warnings': session.exam.max_tab_switches,
                    'proctor_events': proctor_events,
                    'attempted_questions': attempted_list,
                    'unanswered_questions': unanswered_list
                })

        return Response(session_list)

    @action(detail=True, methods=['post'], url_path='override')
    def override(self, request, pk=None):
        """
        Allows examiners to review AI suggestions and override scores and feedback.
        """
        answer = get_object_or_404(Answer, pk=pk)
        
        serializer = ScoreOverrideSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        override_score = serializer.validated_data['score']
        feedback = serializer.validated_data.get('examiner_feedback', '')

        # Validation: check score against question max marks
        exam = answer.session.exam
        difficulty = answer.question.difficulty
        max_marks = exam.config_rules.get(f"{difficulty}_marks", answer.question.marks)
        from decimal import Decimal
        max_marks_decimal = Decimal(str(max_marks))

        if override_score > max_marks_decimal:
            return Response(
                {"error": f"Score {override_score} cannot exceed maximum question marks ({max_marks_decimal})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save overrides
        answer.score = override_score
        answer.examiner_feedback = feedback
        answer.is_evaluated = True
        answer.save()

        # Recompute total score for the student session
        ExamService.calculate_exam_results(answer.session)

        return Response({"status": "Score successfully updated."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        """
        Finalizes an exam session and calculates comparative cohort percentile scores.
        """
        session = get_object_or_404(ExamSession, pk=pk)
        
        # Verify all subjective answers for this session are graded
        has_pending = Answer.objects.filter(
            session=session,
            question__question_type__in=[
                Question.QuestionType.SHORT_ANSWER,
                Question.QuestionType.LONG_ANSWER,
                Question.QuestionType.IMAGE_UPLOAD
            ],
            is_evaluated=False
        ).exists()

        if has_pending:
            return Response(
                {"error": "Cannot publish results. There are subjective answers pending review."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Force recalculate to be certain of values
        result = ExamService.calculate_exam_results(session)

        # Check cutoff status if cutoff_score is configured
        if session.exam.cutoff_score is not None:
            result.is_passed = (result.total_score >= session.exam.cutoff_score)

        # For mass exams, calculate cohort percentile
        if session.exam.exam_type == 'mass':
            exam_sessions = ExamSession.objects.filter(exam=session.exam, status__in=[
                ExamSession.Status.SUBMITTED,
                ExamSession.Status.AUTO_SUBMITTED,
                ExamSession.Status.FLAGGED
            ])
            results = Result.objects.filter(session__in=exam_sessions)
            total_students = results.count()
            
            if total_students > 0:
                worse_or_equal = results.filter(total_score__lte=result.total_score).count()
                result.percentile = round((worse_or_equal / total_students) * 100, 2)
            else:
                result.percentile = 100.00
        else:
            # Individual exam: direct absolute scoring, no comparative cohort percentile
            result.percentile = None
            
        result.finalized = True
        result.save()

        return Response({"status": f"Results for student {session.student.username} finalized and published."}, status=status.HTTP_200_OK)
