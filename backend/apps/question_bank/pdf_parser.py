import os
import re
import json
import logging
import requests
from pypdf import PdfReader
from django.conf import settings

logger = logging.getLogger(__name__)

class PDFQuestionParser:
    @staticmethod
    def extract_text_from_pdf(pdf_file_path):
        """
        Reads a PDF file and extracts all its raw text.
        """
        try:
            reader = PdfReader(pdf_file_path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error reading PDF file: {e}")
            raise ValueError(f"Failed to read PDF file: {str(e)}")

    @staticmethod
    def parse_questions_from_text(text, subject):
        """
        Converts raw text into structured question JSON objects.
        Uses Hugging Face Qwen 2.5 API if token is configured,
        otherwise falls back to a deterministic rule-based parser.
        """
        if not text or not text.strip():
            return []

        # Attempt to use Hugging Face LLM parsing
        token = getattr(settings, 'HF_API_TOKEN', '')
        if token and token != 'your_hugging_face_hub_token_here':
            try:
                parsed_json = PDFQuestionParser._parse_using_llm(text, subject, token)
                if parsed_json:
                    return parsed_json
            except Exception as e:
                logger.error(f"LLM PDF parsing failed, falling back to rule-based parser: {e}")

        # Fallback to rule-based regex parsing
        return PDFQuestionParser._parse_using_rules(text, subject)

    @staticmethod
    def _parse_using_llm(text, subject, token):
        """
        Invokes Qwen 2.5 to convert unstructured text into structured questions.
        """
        prompt = f"""
You are an expert academic assistant. Your task is to extract exam questions from the raw text provided.
Analyze the text and extract all questions. Identify if they belong to different sections (MCQs, short answer, long answer).
Categorize all questions into one of these types:
- "mcq" (Multiple Choice Question with options and exactly one correct option)
- "multi_select" (Multiple Choice Question with options and one or more correct options)
- "one_word" (Answer in one word / objective short response)
- "fill_blank" (Fill in the blank)
- "short_answer" (Subjective question requiring a short explanation)
- "long_answer" (Subjective question requiring a detailed essay or code response)

Also look closely for any answers or answer keys that might be written:
1. Along with the question (e.g., "Ans: A", "Answer: B", "Correct Option is (c)").
2. Or separately at the end of the text or in a dedicated section (e.g., "Answer Key: 1-A, 2-C, 3. (d)").
Match these answers to the corresponding questions. For "mcq" and "multi_select" questions, make sure the matching options have "is_correct": true.
For "one_word" or "fill_blank" questions, set the correct answer in the "model_answer" field.

Format the output strictly as a valid JSON array of objects. Do not add markdown formatting, comments, or introductory text. Return ONLY the JSON array.
Each question object must look like this:
{{
  "question_type": "mcq",
  "text": "Question text here?",
  "marks": 2.0,
  "negative_marks": 0.5,
  "options": [
    {{"text": "Option A text", "is_correct": true}},
    {{"text": "Option B text", "is_correct": false}},
    {{"text": "Option C text", "is_correct": false}},
    {{"text": "Option D text", "is_correct": false}}
  ],
  "model_answer": ""
}}

For "short_answer", "long_answer", "one_word", and "fill_blank", omit the "options" field and fill "model_answer" with a brief guideline or the correct answer.
Subject of questions: {subject}

Raw Exam Text:
{text}
"""
        api_url = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "inputs": prompt,
            "parameters": {"max_new_tokens": 1500, "temperature": 0.1, "return_full_text": False}
        }
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            response_text = result[0].get('generated_text', '') if isinstance(result, list) else result.get('generated_text', '')
            
            # Clean and parse JSON
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            start = cleaned.find('[')
            end = cleaned.rfind(']')
            if start != -1 and end != -1:
                cleaned = cleaned[start:end+1]
                
            return json.loads(cleaned)
        
        raise ValueError(f"HF API returned status: {response.status_code}")

    @staticmethod
    def _parse_using_rules(text, subject):
        """
        Robust regex parser fallback that parses questions, options, and scores from raw text,
        and associates answers written along with the questions or separately at the end.
        """
        questions = []
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        current_question = None
        
        # Regex patterns
        q_pattern = re.compile(r'^(?:Q|q)?(?:uestion)?\s*(\d+)[\.\:\)]\s*(.+)$')
        opt_pattern = re.compile(r'^([a-gA-G1-7])[\.\)\-\s]\s*(.+)$')
        inline_ans_pattern = re.compile(r'(?:Ans|Answer|Correct|Key)[:\-\s]+([a-gA-G])\b', re.IGNORECASE)

        # First pass: parse questions and options
        for line in lines:
            q_match = q_pattern.match(line)
            if q_match:
                if current_question:
                    questions.append(current_question)
                
                q_text = q_match.group(2).strip()
                # Remove any inline answer indicators from question text if present
                q_text = re.sub(r'\s*[\(\[]?(?:Ans|Answer|Correct|Key)[:\-\s]+[a-gA-G][\)\]]?\s*$', '', q_text, flags=re.IGNORECASE)

                q_type = "short_answer"
                marks = 5.0
                if any(kw in q_text.lower() for kw in ["explain in detail", "describe", "discuss", "code", "write a"]):
                    q_type = "long_answer"
                    marks = 10.0

                current_question = {
                    "number": int(q_match.group(1)),
                    "question_type": q_type,
                    "text": q_text,
                    "marks": marks,
                    "negative_marks": 0.0,
                    "options": [],
                    "model_answer": ""
                }
            else:
                opt_match = opt_pattern.match(line)
                if opt_match and current_question:
                    current_question["question_type"] = "mcq"
                    current_question["marks"] = 2.0
                    current_question["negative_marks"] = 0.5
                    
                    opt_letter = opt_match.group(1).upper()
                    opt_text = opt_match.group(2).strip()
                    
                    # Check if answer is written along with option e.g. "a) Option text (Correct)"
                    is_correct = False
                    if any(kw in opt_text.lower() for kw in ["(correct)", "(answer)", "(ans)", "[correct]"]):
                        is_correct = True
                        opt_text = re.sub(r'\s*[\(\[](?:correct|answer|ans)[\)\]]\s*$', '', opt_text, flags=re.IGNORECASE)

                    current_question["options"].append({
                        "letter": opt_letter,
                        "text": opt_text,
                        "is_correct": is_correct
                    })
                elif current_question:
                    # Check for inline answer key on a separate line below question/options
                    inline_ans_match = inline_ans_pattern.search(line)
                    if inline_ans_match:
                        current_question["detected_ans_letter"] = inline_ans_match.group(1).upper()
                    else:
                        # Append to question text
                        current_question["text"] += " " + line

        if current_question:
            questions.append(current_question)

        # Parse separate answer keys (e.g., "Answer Key: 1-A, 2-B, 3: C, 4. D")
        answer_key_map = {}
        key_patterns = [
            re.compile(r'(\d+)\s*[\.\-\:\)]\s*([a-gA-G])\b'),
            re.compile(r'(?:q|question)?\s*(\d+)\s*[:\-\s]\s*(?:ans|answer)?\s*([a-gA-G])\b', re.IGNORECASE)
        ]
        
        for pattern in key_patterns:
            for match in pattern.finditer(text):
                q_num = int(match.group(1))
                ans_letter = match.group(2).upper()
                answer_key_map[q_num] = ans_letter

        # Second pass: Associate answers & cleanup
        final_questions = []
        for q in questions:
            q_num = q.pop("number", None)
            detected_ans_letter = q.pop("detected_ans_letter", None)
            ans_letter = answer_key_map.get(q_num) or detected_ans_letter
            
            if q["question_type"] == "mcq" and len(q["options"]) >= 2:
                has_correct_inline = any(o["is_correct"] for o in q["options"])
                
                if ans_letter:
                    for o in q["options"]:
                        if o["letter"] == ans_letter:
                            o["is_correct"] = True
                        else:
                            o["is_correct"] = False
                elif not has_correct_inline:
                    q["options"][0]["is_correct"] = True
            
            for o in q["options"]:
                o.pop("letter", None)

            if q["question_type"] == "mcq" and len(q["options"]) < 2:
                q["question_type"] = "short_answer"
                q["options"] = []
                q["marks"] = 5.0
                if ans_letter:
                    q["model_answer"] = f"Correct answer is {ans_letter}"

            final_questions.append(q)

        return final_questions
