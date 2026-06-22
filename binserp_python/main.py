from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import pickle
import os
from typing import List

# Try importing face_recognition, else mock it
try:
    import face_recognition
    MOCK_MODE = False
    print("Face Recognition library loaded successfully.")
except ImportError:
    print("WARNING: 'face_recognition' library not found. Running in MOCK MODE.")
    MOCK_MODE = True
    face_recognition = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "data"
ENCODINGS_FILE = os.path.join(DATA_DIR, "encodings.pickle")
known_encodings: dict = {}

# ── Optimisation constants ────────────────────────────────────────────────────
# Max dimension before processing. Keeps HOG fast without losing accuracy.
MAX_DIM = 480          # Frontend now sends 480×360 – keep as-is; larger images get downscaled
RECOGNITION_TOLERANCE = 0.52  # Slightly tighter than default 0.6 → fewer false positives

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def load_encodings():
    global known_encodings
    if MOCK_MODE:
        return
    if os.path.exists(ENCODINGS_FILE):
        try:
            with open(ENCODINGS_FILE, "rb") as f:
                known_encodings = pickle.load(f)
            print(f"Loaded {len(known_encodings)} face encodings.")
        except Exception as e:
            print(f"Error loading encodings: {e}")
            known_encodings = {}
    else:
        print("No existing encodings found. Starting fresh.")

def save_encodings():
    if MOCK_MODE:
        return
    try:
        with open(ENCODINGS_FILE, "wb") as f:
            pickle.dump(known_encodings, f)
        print("Encodings saved.")
    except Exception as e:
        print(f"Error saving encodings: {e}")

def decode_image(contents: bytes):
    """Decode uploaded bytes → RGB numpy array, downscaled if too large."""
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    # Downscale to MAX_DIM on the longest side to keep HOG fast
    h, w = img.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

load_encodings()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    mode = "MOCK" if MOCK_MODE else "REAL"
    return {"message": f"Face Recognition Service Running ({mode} MODE)"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "mode": "MOCK" if MOCK_MODE else "REAL", "faces_loaded": len(known_encodings)}

@app.post("/train")
async def train_face(employee_id: str = Form(...), files: List[UploadFile] = File(...)):
    if MOCK_MODE:
        return {"message": "MOCK Training successful", "employee_id": employee_id, "samples_used": len(files)}

    print(f"Training: {employee_id} with {len(files)} images")
    temp_encodings = []

    for file in files:
        try:
            contents = await file.read()
            rgb_img = decode_image(contents)
            if rgb_img is None:
                continue

            # HOG is fine for training (done once); use number_of_times_to_upsample=1 for speed
            boxes = face_recognition.face_locations(rgb_img, model="hog", number_of_times_to_upsample=1)
            if not boxes:
                continue
            encodings = face_recognition.face_encodings(rgb_img, boxes, num_jitters=1)
            if encodings:
                temp_encodings.append(encodings[0])
        except Exception as e:
            print(f"Error processing image: {e}")

    if not temp_encodings:
        raise HTTPException(status_code=400, detail="No valid faces detected in uploaded photos.")

    # Store the MEAN encoding for this employee
    known_encodings[employee_id] = np.mean(temp_encodings, axis=0)
    save_encodings()

    return {"message": "Training successful", "employee_id": employee_id, "samples_used": len(temp_encodings)}


@app.post("/recognize")
async def recognize_face(file: UploadFile = File(...)):
    if MOCK_MODE:
        return {"status": "success", "employee_id": "69370497f400282eb3ceed5f", "confidence": 0.99}

    try:
        contents = await file.read()
        rgb_img = decode_image(contents)

        if rgb_img is None:
            return {"status": "failed", "message": "Invalid image data"}

        # ── Fast face location ───────────────────────────────────────────────
        # number_of_times_to_upsample=0: no upsampling → 2-3× faster, still works at 480p
        boxes = face_recognition.face_locations(
            rgb_img,
            model="hog",
            number_of_times_to_upsample=0
        )

        if not boxes:
            # Retry once with 1 upsample in case the face is small
            boxes = face_recognition.face_locations(rgb_img, model="hog", number_of_times_to_upsample=1)
            if not boxes:
                return {"status": "failed", "message": "No face detected"}

        # num_jitters=0: no data augmentation during encoding → fastest path
        unknown_encodings = face_recognition.face_encodings(rgb_img, boxes, num_jitters=0)
        if not unknown_encodings:
            return {"status": "failed", "message": "Could not encode face"}

        unknown_encoding = unknown_encodings[0]

        if not known_encodings:
            return {"status": "unknown", "message": "No known faces in database"}

        ids           = list(known_encodings.keys())
        known_values  = np.array(list(known_encodings.values()))  # numpy array for vectorised distance

        distances = face_recognition.face_distance(known_values, unknown_encoding)
        best_idx  = int(np.argmin(distances))

        if distances[best_idx] < RECOGNITION_TOLERANCE:
            return {
                "status": "success",
                "employee_id": ids[best_idx],
                "confidence": float(1 - distances[best_idx])
            }
        else:
            return {"status": "unknown", "message": "Face not recognized"}

    except Exception as e:
        print(f"Recognition error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/reset")
def reset_encodings():
    global known_encodings
    try:
        known_encodings = {}
        if os.path.exists(ENCODINGS_FILE):
            os.remove(ENCODINGS_FILE)
        return {"status": "success", "message": "All face data cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset: {str(e)}")
