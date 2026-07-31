import os
import json
import requests
import logging
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

class HFGradingService:
    @staticmethod
    def evaluate_subjective_answer(question_text, model_answer, student_answer, max_marks):
        """
        Grades a subjective answer using Hugging Face models.
        Attempts to call HF Inference API. Fallbacks to heuristic keyword matching
        if API fails or token is missing.
        """
        if not student_answer or not student_answer.strip():
            return {
                "score": 0.0,
                "justification": "The student did not submit an answer or the answer was blank."
            }

        prompt = f"""
You are an expert academic evaluator. Evaluate the student's answer against the model answer and award a score out of {max_marks} marks.
Return ONLY a valid JSON object in the following format:
{{"score": 4.5, "justification": "Detailed explanation of marks awarded, matching points, and missed concepts."}}

Question: {question_text}
Model Answer / Rubric: {model_answer}
Student Answer: {student_answer}
Max Marks: {max_marks}

Your response must be JSON only. Do not add markdown formatting or explanations outside the JSON object.
"""
        
        # Method 1: Try Hugging Face Serverless Inference API (Free & fast, does not load model in RAM)
        token = getattr(settings, 'HF_API_TOKEN', '')
        if token and token != 'your_hugging_face_hub_token_here':
            try:
                # Using Qwen 2.5 7B Instruct which is highly capable at instruction following and free on HF API
                api_url = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct"
                headers = {"Authorization": f"Bearer {token}"}
                payload = {
                    "inputs": prompt,
                    "parameters": {"max_new_tokens": 512, "temperature": 0.1, "return_full_text": False}
                }
                response = requests.post(api_url, headers=headers, json=payload, timeout=15)
                
                if response.status_code == 200:
                    result = response.json()
                    response_text = result[0].get('generated_text', '') if isinstance(result, list) else result.get('generated_text', '')
                    
                    # Attempt to clean and parse JSON
                    parsed = HFGradingService._parse_json_from_response(response_text)
                    if parsed:
                        # Ensure score is numeric and capped at max_marks
                        score = min(float(max_marks), max(0.0, float(parsed.get('score', 0))))
                        return {
                            "score": score,
                            "justification": parsed.get('justification', 'Graded using Qwen 2.5 via HF API.')
                        }
            except Exception as e:
                logger.error(f"Hugging Face Inference API failed: {e}")

        # Method 2: Local model fallback if requested
        if getattr(settings, 'USE_LOCAL_HF_MODELS', False):
            try:
                from transformers import pipeline
                # Use a very small instruction model to prevent out of memory issues
                pipe = pipeline("text-generation", model="Qwen/Qwen2.5-0.5B-Instruct", device_map="auto")
                messages = [{"role": "user", "content": prompt}]
                res = pipe(messages, max_new_tokens=256, temperature=0.1)
                res_text = res[0]['generated_text'][-1]['content']
                parsed = HFGradingService._parse_json_from_response(res_text)
                if parsed:
                    score = min(float(max_marks), max(0.0, float(parsed.get('score', 0))))
                    return {
                        "score": score,
                        "justification": parsed.get('justification', 'Graded using local Qwen2.5-0.5B.')
                    }
            except Exception as e:
                logger.error(f"Local Transformers pipeline failed: {e}")

        # Method 3: Deterministic Heuristic Fallback
        # If APIs are unavailable, calculate a baseline score using common keyword overlap
        return HFGradingService._heuristic_fallback(model_answer, student_answer, max_marks)

    @staticmethod
    def _parse_json_from_response(text):
        """Cleans and extracts JSON block from text."""
        try:
            # Strip markdown block formatting if present
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            # Find first { and last }
            start = cleaned.find('{')
            end = cleaned.rfind('}')
            if start != -1 and end != -1:
                cleaned = cleaned[start:end+1]
                
            return json.loads(cleaned)
        except Exception:
            return None

    @staticmethod
    def _heuristic_fallback(model_answer, student_answer, max_marks):
        """
        Calculates a fallback grading score by analyzing keyword overlap.
        Prevents pipeline failures if remote/local LLMs are inaccessible.
        """
        if not model_answer or not student_answer:
            return {"score": 0.0, "justification": "Could not verify answer structure. Heuristic score awarded."}
            
        m_words = set(model_answer.lower().split())
        s_words = set(student_answer.lower().split())
        
        # Find shared non-trivial words (keywords longer than 4 chars)
        keywords = {w for w in m_words if len(w) > 4}
        if not keywords:
            keywords = m_words
            
        matched = keywords.intersection(s_words)
        
        if not keywords:
            ratio = 0.5
        else:
            ratio = len(matched) / len(keywords)
            
        score = round(float(max_marks) * ratio, 2)
        justification = (
            f"AI evaluation fallback mode. Student answer contained {len(matched)} matching keywords "
            f"({', '.join(list(matched)[:5])}...) compared against the model answer rubric."
        )
        return {"score": score, "justification": justification}

class OCRService:
    @staticmethod
    def extract_text_from_image(image_path):
        """
        Performs OCR text extraction from written responses.
        Falls back cleanly if Tesseract binary is not installed.
        """
        if not os.path.exists(image_path):
            return ""

        # Try pytesseract
        try:
            import pytesseract
            # Convert image to grayscale for better OCR accuracy
            img = Image.open(image_path).convert('L')
            text = pytesseract.image_to_string(img)
            return text.strip()
        except Exception as e:
            logger.warning(f"pytesseract OCR extraction failed: {e}. Checking fallback.")

        # Try easyocr if installed
        try:
            import easyocr
            reader = easyocr.Reader(['en'], gpu=False)
            results = reader.readtext(image_path, detail=0)
            return " ".join(results).strip()
        except Exception as e:
            logger.warning(f"easyocr extraction failed: {e}. Returning blank placeholder.")

        # If both fail, we return a mock message indicating the image exists but OCR failed
        return "[Handwritten Answer Image Uploaded. OCR text extraction was unavailable on this server environment.]"
