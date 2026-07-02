import os
import json
import requests

from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


def generate_quiz(content, difficulty, num_questions):

    prompt = f"""Generate exactly {num_questions} multiple-choice questions.

Difficulty: {difficulty}

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.

Format:
[
  {{
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "topic": "Topic Name",
    "explanation": "Brief explanation of the correct answer"
  }}
]

Rules:
- Generate exactly {num_questions} questions
- Each question must have exactly 4 options
- "correct_answer" must be the exact text of one of the 4 options
- Base all questions strictly on the provided content
- Difficulty "{difficulty}": {"basic recall and definitions" if difficulty == "Easy" else "understanding and application" if difficulty == "Medium" else "analysis, synthesis, and edge cases"}

Content:
{content[:12000]}
"""

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "openai/gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
        },
    )

    print("Status:", response.status_code)

    response.raise_for_status()

    data = response.json()
    result = data["choices"][0]["message"]["content"]

    # Strip markdown fences if present
    result = (
        result
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    questions = json.loads(result)

    # Validate structure
    for q in questions:
        if "correct_answer" not in q or q["correct_answer"] not in q.get("options", []):
            raise ValueError(
                f"Invalid question format — correct_answer must match one of the options.\nGot: {q}"
            )

    return questions