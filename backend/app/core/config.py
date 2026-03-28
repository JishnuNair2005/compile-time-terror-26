import os
import firebase_admin
from firebase_admin import credentials, firestore
from openai import OpenAI
from dotenv import load_dotenv

# Load the variables from the .env file (for OpenAI)
load_dotenv()

# Initialize Firebase Admin ONLY if it hasn't been initialized yet
if not firebase_admin._apps:
    
    # Point directly to your downloaded JSON file
    # Make sure the file name matches exactly
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

# Export the database instance so your services can use it
db = firestore.client()

# Initialize OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))