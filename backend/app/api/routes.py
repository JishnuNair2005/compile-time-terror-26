from fastapi import APIRouter, HTTPException
from google.cloud import firestore as google_firestore
from pydantic import BaseModel
import json
from datetime import datetime

# Assuming these are imported correctly in your project
from app.models.question import QuestionPayload 
from app.services.question_service import process_question
from app.core.config import db, openai_client

router = APIRouter()

# --- PYDANTIC MODELS ---
class JoinPayload(BaseModel):
    deviceId: str

# --- 1. AI SESSION SUMMARY ---
@router.get("/sessions/{session_id}/summary")
def get_session_summary(session_id: str):
    try:
        # Fetch Session Context for better AI prompting
        session_ref = db.collection('sessions').document(session_id).get()
        if not session_ref.exists:
            return {"success": False, "message": "Session not found", "data": None}
            
        session_data = session_ref.to_dict()
        subject = session_data.get('subject', 'General')
        topic = session_data.get('topic', 'Ongoing Lecture')

        # Fetch Questions
        questions_ref = db.collection('questions').where('sessionId', '==', session_id).stream()
        
        questions_data = []
        for doc in questions_ref:
            q = doc.to_dict()
            
            # Only summarize actual text questions
            if q.get('text') and q['text'].strip() != "":
                time_str = "Unknown time"
                if 'timestamp' in q and q['timestamp']:
                    # Handle both integer ms and Firestore Datetime objects safely
                    if isinstance(q['timestamp'], int):
                        dt = datetime.fromtimestamp(q['timestamp'] / 1000.0)
                        time_str = dt.strftime('%I:%M %p')
                    else:
                        time_str = q['timestamp'].strftime('%I:%M %p')
                
                # Add conceptTag and type to the AI's context
                q_type = "Lost" if q.get('type') == 1 else "Sort Of"
                questions_data.append(f"[{time_str}] [{q_type}] ({q.get('conceptTag', 'General')}): {q['text']}")

        # Fallback if no text questions were asked
        if not questions_data:
            return {
                "success": True, 
                "data": {
                    "overallIdea": f"The class on {topic} lacked interactive text questions. Rely on the Got It / Lost ratio for understanding.",
                    "topDoubt": "N/A - No written questions",
                    "topics": [
                        {
                            "topic": "No text inputs received", 
                            "doubtsLevel": "Low", 
                            "timestamps": "N/A", 
                            "summary": "Students used the quick-poll buttons but did not submit written confusion signals."
                        }
                    ]
                }
            }

        # Prepare Llama Prompt with Subject/Topic Context
        raw_text = "\n".join(questions_data)
        prompt = f"""
        You are an expert teaching assistant analyzing a class on '{subject}', specifically covering '{topic}'.
        Here are the questions and confusion signals submitted by students, along with timestamps and AI-generated concept tags:
        
        {raw_text}
        
        Task:
        1. Write a 1-sentence 'overallIdea' summarizing how well the class understood {topic}.
        2. Identify the 'topDoubt' - the single specific concept that had the most doubts.
        3. Cluster the questions into 2 to 4 main topics of confusion.
        4. For each topic, identify the 'doubtsLevel' ("High", "Medium", or "Low") and note the specific timestamps when confusion spiked.
        
        Respond STRICTLY in valid JSON format using this EXACT structure:
        {{
          "overallIdea": "Brief overall summary of the class's performance...",
          "topDoubt": "Name of the most confusing concept",
          "topics": [
            {{
              "topic": "Concept Name",
              "doubtsLevel": "High/Medium/Low",
              "timestamps": "10:15 AM - 10:18 AM",
              "summary": "Brief 1-sentence explanation of what confused them."
            }}
          ]
        }}
        """

        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1, 
        )
        
        ai_response = chat_response.choices[0].message.content.strip()
        
        if ai_response.startswith("```json"):
            ai_response = ai_response[7:-3].strip()
        elif ai_response.startswith("```"):
            ai_response = ai_response[3:-3].strip()
            
        parsed_data = json.loads(ai_response)
        
        return {"success": True, "data": parsed_data}

    except Exception as e:
        print(f"Summary Generation Error: {e}")
        return {"success": False, "message": "Failed to generate summary", "data": None}

# --- ADD THIS TO YOUR routes.py ---
@router.get("/sessions/{session_id}/questions/smart-sort")
def get_smart_sorted_questions(session_id: str):
    try:
        # 1. Fetch all active questions for this session
        questions_ref = db.collection('questions').where('sessionId', '==', session_id).where('isActive', '==', True).stream()
        
        raw_questions = []
        for doc in questions_ref:
            q = doc.to_dict()
            # Only process actual text questions
            if q.get('text') and q['text'].strip():
                q['id'] = doc.id # Save the document ID
                raw_questions.append(q)

        if not raw_questions:
            return {"success": True, "data": []}

        # 2. Format them into a numbered list for the LLM
        prompt_data = ""
        for i, q in enumerate(raw_questions):
            prompt_data += f"[{i}] Count: {q.get('count', 1)} | Concept: {q.get('conceptTag', 'N/A')} | Question: '{q.get('text')}'\n"

        # 3. The Pedagogical System Instruction
        prompt = f"""
        You are an expert Computer Science Professor organizing student questions for a Q&A session.
        Here is the list of questions asked by the class:
        
        {prompt_data}
        
        Sort these questions into the optimal teaching order using these two strict rules:
        1. Logical Progression: Foundational concepts MUST come before specific/advanced concepts (e.g., answer "What is a data structure?" before "What is a Stack?").
        2. Frequency: If two questions are on the same conceptual level, the one with the higher 'Count' goes first.
        
        Respond STRICTLY with a valid JSON array of the index numbers in the new sorted order. Do NOT add markdown, explanations, or code blocks.
        Example output format: [3, 0, 2, 1]
        """

        # 4. Ask the LLM
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0, # Zero temperature for strict logic
        )
        
        ai_response = chat_response.choices[0].message.content.strip()
        
        # Clean up Markdown if the LLM misbehaves
        if ai_response.startswith("```json"):
            ai_response = ai_response[7:-3].strip()
        elif ai_response.startswith("```"):
            ai_response = ai_response[3:-3].strip()
            
# 5. Reorder the array based on the LLM's indices
        try:
            sorted_indices = json.loads(ai_response)
            if not isinstance(sorted_indices, list):
                sorted_indices = []
        except:
            sorted_indices = []
            
        sorted_questions = []
        seen_ids = set()

        # Phase A: Add items in the AI's requested order (ignoring duplicates)
        for i in sorted_indices:
            if isinstance(i, int) and i < len(raw_questions):
                q = raw_questions[i]
                if q['id'] not in seen_ids:
                    sorted_questions.append(q)
                    seen_ids.add(q['id'])

        # Phase B: Append any questions the AI accidentally forgot
        for q in raw_questions:
            if q['id'] not in seen_ids:
                sorted_questions.append(q)
                seen_ids.add(q['id'])

        return {"success": True, "data": sorted_questions}

    except Exception as e:
        print(f"Smart Sort Error: {e}")
        return {"success": False, "message": "Failed to sort questions"}

# --- 2. JOIN SESSION ---
@router.post("/sessions/{session_id}/join")
def join_session(session_id: str, payload: JoinPayload):
    device_id = payload.deviceId
    if not device_id:
        raise HTTPException(status_code=400, detail="Device ID missing in payload")

    try:
        session_ref = db.collection('sessions').document(session_id)
        session_doc = session_ref.get()
        
        if not session_doc.exists:
            return {"valid": False, "message": "Session not found"}
            
        session_data = session_doc.to_dict()
        
        # Don't allow joins if teacher ended the session
        if session_data.get('isActive') is False:
             return {"valid": False, "message": "This session has ended."}

        participant_id = f"{session_id}_{device_id}" 
        p_ref = db.collection('session_participants').document(participant_id)
        participant_doc = p_ref.get()
        
        # Standard return payload matching UserScreen.js expectations
        response_data = {
            "valid": True,
            "subject": session_data.get("subject", "General"),
            "topic": session_data.get("topic", "Unspecified"),
            "teacherId": session_data.get("teacherId", "unknown"),
        }
        
        if participant_doc.exists:
            response_data["message"] = "Welcome back!"
            response_data["alreadyJoined"] = True
        else:
            session_ref.update({'totalJoined': google_firestore.Increment(1)})
            p_ref.set({
                'deviceId': device_id,
                'sessionId': session_id,
                'joinedAt': google_firestore.SERVER_TIMESTAMP
            })
            response_data["message"] = "First time join"
            response_data["alreadyJoined"] = False
            
        return response_data
        
    except Exception as e:
        print(f"Join Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- 3. SUBMIT QUESTION ---
@router.post("/questions")
def submit_question(payload: QuestionPayload):
    try:
        result = process_question(payload)
        return result
    except Exception as e:
        print(f"❌ Question Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question")


# --- 4. GET SESSION COUNT ---
@router.get("/sessions/{session_id}/count")
def get_session_count(session_id: str):
    try:
        session_ref = db.collection('sessions').document(session_id)
        doc = session_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return {"count": data.get("totalJoined", 0)}
        return {"count": 0, "message": "Session not found"}
    except Exception as e:
        print(f"❌ Count Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch count")