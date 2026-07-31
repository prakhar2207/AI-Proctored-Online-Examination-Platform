from celery import shared_task
from django.utils import timezone
from .models import ExamSession
from .services import ExamService

@shared_task
def auto_submit_exam_task(session_id):
    """
    Background job triggered on session expiry.
    If the session is still in_progress, mark it auto_submitted
    and trigger MCQ auto-grading + schedule LLM grading.
    """
    try:
        session = ExamSession.objects.get(id=session_id)
        if session.status == ExamSession.Status.IN_PROGRESS:
            session.status = ExamSession.Status.AUTO_SUBMITTED
            session.submitted_at = timezone.now()
            session.save()

            # Trigger grading
            ExamService.calculate_exam_results(session)

            # Schedule LLM grading queue for subjective answers
            from apps.grading.tasks import grade_subjective_answers_for_session_task
            grade_subjective_answers_for_session_task.delay(session.id)
            
            return f"Session {session_id} auto-submitted successfully."
        return f"Session {session_id} was already {session.status}."
    except ExamSession.DoesNotExist:
        return f"Session {session_id} not found."
