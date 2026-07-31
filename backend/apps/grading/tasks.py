from celery import shared_task
import logging
from apps.exams.models import ExamSession, Answer
from apps.question_bank.models import Question
from apps.exams.services import ExamService
from .services import HFGradingService, OCRService

logger = logging.getLogger(__name__)

@shared_task
def grade_subjective_answers_for_session_task(session_id):
    """
    Asynchronously grades all subjective and handwritten answers for an exam session.
    Extracts text from images via OCR, grades via Hugging Face model, and saves marks.
    """
    try:
        session = ExamSession.objects.get(id=session_id)
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
                        # Append OCR result to assist evaluator
                        student_text = (student_text + "\n" + ocr_text).strip()
                except Exception as e:
                    logger.error(f"OCR execution failed on Answer {answer.id}: {e}")

            # Call Hugging Face grading model
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
                logger.error(f"Hugging Face evaluation task failed on Answer {answer.id}: {e}")

        # Recalculate results to update total_score
        ExamService.calculate_exam_results(session)
        return f"Completed subjective evaluation for session {session_id}."
        
    except ExamSession.DoesNotExist:
        return f"Session {session_id} not found."
