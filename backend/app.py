import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from ppt_parser import extract_text
from quiz_generator import generate_quiz

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.get("/")
def home():
    return {"message": "AI Quiz Generator API Running"}


@app.post("/generate-quiz")
async def create_quiz(
    file: UploadFile = File(...),
    difficulty: str = Form(...),
    num_questions: int = Form(...)
):
    try:

        file_path = os.path.join(
            UPLOAD_FOLDER,
            file.filename
        )

        with open(file_path, "wb") as f:
            f.write(await file.read())

        extracted_text = extract_text(file_path)

        quiz = generate_quiz(
            extracted_text,
            difficulty,
            num_questions
        )

        return {
            "quiz": quiz
        }

    except Exception as e:
        return {
            "error": str(e)
        }