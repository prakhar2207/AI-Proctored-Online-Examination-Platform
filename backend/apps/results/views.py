from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from apps.exams.models import ExamSession, Result, Answer
from apps.users.permissions import IsStudent

class StudentResultsViewSet(viewsets.ViewSet):
    permission_classes = [IsStudent]

    def list(self, request):
        """
        Lists all published exam results for the authenticated student.
        """
        results = Result.objects.filter(
            session__student=request.user,
            finalized=True
        ).select_related('session__exam')

        data = []
        for r in results:
            data.append({
                "exam_id": r.session.exam.id,
                "exam_title": r.session.exam.title,
                "subject": r.session.exam.subject,
                "total_score": r.total_score,
                "percentile": r.percentile,
                "submitted_at": r.session.submitted_at
            })
        return Response(data)

    @action(detail=True, methods=['get'])
    def breakdown(self, request, pk=None):
        """
        Retrieves a detailed question-by-question breakdown of an exam.
        Does NOT return proctoring suspicion scores or audit logs to students.
        """
        session = get_object_or_404(ExamSession, exam_id=pk, student=request.user)
        result = get_object_or_404(Result, session=session, finalized=True)

        answers = Answer.objects.filter(session=session).select_related('question')
        
        breakdown_data = []
        for ans in answers:
            # Map options selected
            selected = list(ans.selected_options.values('id', 'text', 'is_correct'))
            
            breakdown_data.append({
                "question_id": ans.question.id,
                "question_text": ans.question.text,
                "question_type": ans.question.question_type,
                "max_marks": session.exam.config_rules.get(f"{ans.question.difficulty}_marks", ans.question.marks),
                "marks_awarded": ans.score,
                "student_answer_text": ans.text_answer,
                "student_answer_image": ans.image_answer.url if ans.image_answer else None,
                "selected_options": selected,
                "examiner_feedback": ans.examiner_feedback
            })

        return Response({
            "exam_title": session.exam.title,
            "subject": session.exam.subject,
            "overall_score": result.total_score,
            "percentile": result.percentile,
            "questions": breakdown_data
        })
