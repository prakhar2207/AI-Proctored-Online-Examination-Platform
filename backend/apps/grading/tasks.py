from celery import shared_task
import logging
from apps.exams.models import ExamSession, Answer
from apps.question_bank.models import Question
from apps.exams.services import ExamService
from .services import HFGradingService, OCRService

logger = logging.getLogger(__name__)

def evaluate_session_subjective_inline(session: ExamSession):
    """
    Evaluates all subjective and handwritten answers for a session inline.
    """
    answers = Answer.objects.filter(session=session).select_related('question')

    for answer in answers:
        q_type = answer.question.question_type
        
        # Skip auto-evaluated objective questions
        if q_type in [Question.QuestionType.MCQ, Question.QuestionType.MULTI_SELECT, Question.QuestionType.ONE_WORD, Question.QuestionType.FILL_BLANK]:
            continue
        
        # Skip if already evaluated
        if answer.is_evaluated:
            continue

        student_text = answer.text_answer or ""
        
        # If handwritten image upload question, run OCR text extraction first
        if q_type == Question.QuestionType.IMAGE_UPLOAD and answer.image_answer:
            try:
                ocr_text = OCRService.extract_text_from_image(answer.image_answer.path)
                if ocr_text:
                    student_text = (student_text + "\n" + ocr_text).strip()
            except Exception as e:
                logger.error(f"OCR execution failed on Answer {answer.id}: {e}")

        # Call Hugging Face grading model / AI Service
        try:
            exam = session.exam
            difficulty = answer.question.difficulty
            marks = exam.config_rules.get(f"{difficulty}_marks", answer.question.marks)

            eval_result = HFGradingService.evaluate_subjective_answer(
                question_text=answer.question.text,
                model_answer=answer.question.model_answer or "No model answer provided.",
                student_answer=student_text,
                max_marks=marks
            )
            
            answer.score = eval_result.get('score', 0.0)
            answer.ai_justification = eval_result.get('justification', '')
            answer.is_evaluated = True
            answer.save()
        except Exception as e:
            logger.error(f"Subjective evaluation failed on Answer {answer.id}: {e}")

    # Recalculate results to update total_score
    result = ExamService.calculate_exam_results(session)

    # Check cutoff status if cutoff_score is configured
    if session.exam.cutoff_score is not None:
        result.is_passed = (result.total_score >= session.exam.cutoff_score)
    
    if session.exam.grading_mode == 'full_ai' or session.exam.is_mock:
        result.finalized = True
        
        # For mass exams, calculate cohort percentile
        if session.exam.exam_type == 'mass' and not session.exam.is_mock:
            from apps.exams.models import Result
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
            # Individual/Mock exam: direct absolute scoring
            result.percentile = None
            
        result.save()
    return result

@shared_task
def grade_subjective_answers_for_session_task(session_id):
    """
    Asynchronously grades all subjective and handwritten answers for an exam session.
    """
    try:
        session = ExamSession.objects.get(id=session_id)
        evaluate_session_subjective_inline(session)
        return f"Completed subjective evaluation for session {session_id}."
    except ExamSession.DoesNotExist:
        return f"Session {session_id} not found."
