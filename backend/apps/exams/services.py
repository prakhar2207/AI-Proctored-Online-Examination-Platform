import random
from django.db import transaction
from django.utils import timezone
from apps.question_bank.models import Question
from .models import Exam, ExamSession, ExamQuestion, Answer, Result, ExamSection, ExamSectionQuestion

class ExamService:
    @staticmethod
    def generate_random_paper(session: ExamSession):
        """
        Generates a randomized or specific question paper for a student session.
        Respects multiple sections, random configuration rules, or specific chosen questions.
        """
        exam = session.exam
        student_id = session.student.id
        
        # Check if already generated
        if ExamQuestion.objects.filter(session=session).exists():
            return ExamQuestion.objects.filter(session=session).order_by('order')

        # Seeding Python random deterministically per student ID
        rng = random.Random(student_id)

        # Check if sections exist
        sections = exam.sections.all().order_by('order')
        max_duration = float(exam.duration_minutes or 45)
        
        with transaction.atomic():
            exam_questions = []
            order_counter = 1
            accumulated_time = 0.0  # 1 mark = 1 minute solving time
            
            if sections.exists():
                for sec in sections:
                    sec_questions = []
                    if sec.use_random:
                        # Random selection based on section rules
                        config = sec.config_rules or {}
                        easy_count = config.get('easy_count', 0)
                        medium_count = config.get('medium_count', 0)
                        hard_count = config.get('hard_count', 0)
                        q_type = config.get('question_type', None)
                        pdf_id = config.get('pdf_source_id', None)
                        sec_subject = config.get('subject', None)
                        
                        pool = Question.objects.all()
                        if sec_subject:
                            if isinstance(sec_subject, list):
                                pool = pool.filter(subject__in=sec_subject)
                            else:
                                pool = pool.filter(subject__iexact=sec_subject)
                        elif exam.subject:
                            pool = pool.filter(subject__iexact=exam.subject)

                        if q_type:
                            pool = pool.filter(question_type=q_type)
                        if pdf_id:
                            pool = pool.filter(pdf_source_id=pdf_id)
                            
                        for diff, count in [('easy', easy_count), ('medium', medium_count), ('hard', hard_count)]:
                            if count > 0:
                                diff_pool = list(pool.filter(difficulty=diff))
                                if len(diff_pool) >= count:
                                    sec_questions.extend(rng.sample(diff_pool, count))
                                else:
                                    sec_questions.extend(diff_pool)
                        
                        # Fallback if section rules yielded nothing, get some general questions
                        if not sec_questions:
                            fallback_pool = list(pool[:5])
                            rng.shuffle(fallback_pool)
                            sec_questions.extend(fallback_pool)
                    else:
                        # Select specifically chosen questions
                        esqs = ExamSectionQuestion.objects.filter(section=sec).order_by('order')
                        sec_questions = [esq.question for esq in esqs]

                    # Create ExamQuestion objects for this section while within time budget
                    for q in sec_questions:
                        q_time = float(exam.config_rules.get(f"{q.difficulty}_marks", q.marks or 1))
                        if accumulated_time + q_time > max_duration and len(exam_questions) > 0:
                            break  # Time budget reached for exam duration
                        eq = ExamQuestion.objects.create(
                            session=session,
                            question=q,
                            order=order_counter,
                            section=sec
                        )
                        exam_questions.append(eq)
                        order_counter += 1
                        accumulated_time += q_time
            else:
                # Legacy fallback without sections
                config = exam.config_rules or {}
                easy_count = config.get('easy_count', 0)
                medium_count = config.get('medium_count', 0)
                hard_count = config.get('hard_count', 0)
                
                pool = Question.objects.filter(subject__iexact=exam.subject)
                if not pool.exists():
                    pool = Question.objects.all()
                selected_questions = []
                
                for diff, count in [('easy', easy_count), ('medium', medium_count), ('hard', hard_count)]:
                    if count > 0:
                        diff_pool = list(pool.filter(difficulty=diff))
                        if len(diff_pool) >= count:
                            selected_questions.extend(rng.sample(diff_pool, count))
                        else:
                            selected_questions.extend(diff_pool)
                
                if not selected_questions:
                    all_questions = list(Question.objects.all()[:10])
                    rng.shuffle(all_questions)
                    selected_questions = all_questions

                for q in selected_questions:
                    q_time = float(exam.config_rules.get(f"{q.difficulty}_marks", q.marks or 1))
                    if accumulated_time + q_time > max_duration and len(exam_questions) > 0:
                        break  # Time budget reached for exam duration
                    eq = ExamQuestion.objects.create(
                        session=session,
                        question=q,
                        order=order_counter
                    )
                    exam_questions.append(eq)
                    order_counter += 1
                    accumulated_time += q_time

            return exam_questions

    @staticmethod
    def evaluate_objective_answer(answer: Answer):
        """
        Auto-grades MCQ, Multi-select, One Word, and Fill in the Blank answers.
        """
        from decimal import Decimal
        question = answer.question
        exam = answer.session.exam
        difficulty = question.difficulty

        # Fetch dynamic marks and negative marks from exam config rules
        marks = exam.config_rules.get(f"{difficulty}_marks", question.marks)
        neg_marks = exam.config_rules.get(f"{difficulty}_negative_marks", question.negative_marks)
        
        # Convert to Decimal for precise calculation
        marks_decimal = Decimal(str(marks))
        neg_marks_decimal = Decimal(str(neg_marks))

        # Check question type
        is_correct = False
        if question.question_type in [Question.QuestionType.MCQ, Question.QuestionType.MULTI_SELECT]:
            correct_options = set(question.options.filter(is_correct=True).values_list('id', flat=True))
            selected_options = set(answer.selected_options.values_list('id', flat=True))
            is_correct = (selected_options == correct_options)
        elif question.question_type in [Question.QuestionType.ONE_WORD, Question.QuestionType.FILL_BLANK]:
            student_ans = (answer.text_answer or "").strip().lower()
            model_ans = (question.model_answer or "").strip().lower()
            is_correct = (student_ans == model_ans and model_ans != "")
        else:
            return None  # Subjective/Image answers are graded by HF / Examiner
        
        if is_correct:
            answer.score = marks_decimal
        else:
            answer.score = -abs(neg_marks_decimal)
            
        answer.is_evaluated = True
        answer.save()
        return answer.score

    @staticmethod
    def calculate_exam_results(session: ExamSession):
        """
        Aggregates overall score for a session.
        Applies auto-evaluation to all objective questions.
        """
        answers = Answer.objects.filter(session=session)
        total_score = 0
        
        for ans in answers:
            if ans.question.question_type in [
                Question.QuestionType.MCQ, 
                Question.QuestionType.MULTI_SELECT,
                Question.QuestionType.ONE_WORD,
                Question.QuestionType.FILL_BLANK
            ]:
                score = ExamService.evaluate_objective_answer(ans)
                if score is not None:
                    total_score += score
            else:
                if ans.is_evaluated and ans.score is not None:
                    total_score += ans.score

        # Ensure total score is not negative
        if total_score < 0:
            total_score = 0

        result, created = Result.objects.update_or_create(
            session=session,
            defaults={'total_score': total_score}
        )
        return result
