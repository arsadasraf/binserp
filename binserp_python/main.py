from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import os
from typing import List, Optional

from anti_spoof import anti_spoof_engine
from face_engine import face_engine, DLIB_AVAILABLE

app = FastAPI(
    title="Binserp AI Biometrics & Anti-Spoofing Service",
    version="2.0.0",
    description="High-accuracy face recognition with passive anti-spoofing and multi-tenant company isolation."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_DIM = 640  # Max resolution processed for optimal balance of speed and anti-spoofing detail

def decode_image(contents: bytes) -> Optional[np.ndarray]:
    """Decode raw bytes into RGB numpy array with resolution constraint."""
    try:
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        h, w = img.shape[:2]
        if max(h, w) > MAX_DIM:
            scale = MAX_DIM / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)
        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "service": "Binserp AI Face Recognition & Anti-Spoofing",
        "version": "2.0.0",
        "dlib_active": DLIB_AVAILABLE,
        "anti_spoofing": "Active (Fourier + Color + Texture + ONNX)"
    }

@app.get("/health")
def health_check():
    total_companies = len(face_engine.company_cache)
    total_faces = sum(len(v) for v in face_engine.company_cache.values())
    return {
        "status": "healthy",
        "engine": "dlib" if DLIB_AVAILABLE else "mock",
        "active_companies": total_companies,
        "total_enrolled_faces": total_faces
    }

@app.post("/anti-spoof-check")
async def check_spoof(file: UploadFile = File(...)):
    """
    Standalone endpoint to verify if an image is a live human or a photo/screen spoof.
    """
    contents = await file.read()
    rgb_img = decode_image(contents)
    if rgb_img is None:
        raise HTTPException(status_code=400, detail="Invalid image file format")

    _, box, _ = face_engine.detect_and_encode(rgb_img, fast_mode=True)
    liveness = anti_spoof_engine.check_liveness(rgb_img, box)
    return {
        "status": "success",
        "is_live": liveness["is_live"],
        "liveness_score": liveness["liveness_score"],
        "details": liveness.get("details", {})
    }

@app.post("/train")
async def train_face(
    employee_id: str = Form(...),
    company_id: str = Form(default="default"),
    files: List[UploadFile] = File(...)
):
    """
    Enrolls employee face embeddings with quality filtering and angle aggregation.
    """
    print(f"[Train] Enrolling employee {employee_id} (Company: {company_id}) with {len(files)} frames")
    valid_encodings = []
    quality_issues = []

    for idx, file in enumerate(files):
        try:
            contents = await file.read()
            rgb_img = decode_image(contents)
            if rgb_img is None:
                continue

            # Check liveness during training to prevent enrolling photos
            _, box, quality = face_engine.detect_and_encode(rgb_img, fast_mode=False)
            if box is None:
                quality_issues.append(f"Frame {idx+1}: No face detected")
                continue

            liveness = anti_spoof_engine.check_liveness(rgb_img, box)
            if not liveness["is_live"] and liveness["liveness_score"] < 0.45:
                quality_issues.append(f"Frame {idx+1}: Photo/screen spoof detected during enrollment")
                continue

            encoding, _, _ = face_engine.detect_and_encode(rgb_img, fast_mode=False)
            if encoding is not None:
                valid_encodings.append(encoding)
        except Exception as e:
            print(f"Error processing frame {idx}: {e}")

    if not valid_encodings:
        raise HTTPException(
            status_code=400, 
            detail=f"Enrollment failed. No high-quality live face frames detected. Issues: {', '.join(quality_issues[:2])}"
        )

    # Compute mean vector
    mean_encoding = np.mean(valid_encodings, axis=0)
    company_store = face_engine.get_company_encodings(company_id)
    company_store[employee_id] = mean_encoding
    face_engine.save_company_encodings(company_id, company_store)

    return {
        "status": "success",
        "message": f"Successfully enrolled face for employee {employee_id}",
        "company_id": company_id,
        "employee_id": employee_id,
        "samples_used": len(valid_encodings)
    }

@app.post("/recognize")
async def recognize_face(
    file: UploadFile = File(...),
    company_id: str = Form(default="default")
):
    """
    High-speed recognition endpoint with multi-tenant company isolation and anti-spoofing verification.
    """
    try:
        contents = await file.read()
        rgb_img = decode_image(contents)
        if rgb_img is None:
            return {"status": "failed", "message": "Invalid image payload"}

        # 1. Fast Face Detection and Encoding
        encoding, box, quality = face_engine.detect_and_encode(rgb_img, fast_mode=True)
        if encoding is None:
            return {
                "status": "failed",
                "message": "No face detected in camera frame. Please center your face."
            }

        # 2. Anti-Spoofing & Liveness Analysis
        liveness = anti_spoof_engine.check_liveness(rgb_img, box)
        if not liveness["is_live"]:
            return {
                "status": "spoof_detected",
                "anti_spoof_passed": False,
                "liveness_score": liveness["liveness_score"],
                "message": "Spoof Alert: Live human face required. Digital screens and photos are not permitted.",
                "details": liveness.get("details", {})
            }

        # 3. Vector Matching against Company Employee Directory
        match_result = face_engine.match_face(company_id, encoding)
        match_result["anti_spoof_passed"] = True
        match_result["liveness_score"] = liveness["liveness_score"]

        return match_result

    except Exception as e:
        print(f"Recognition exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/company/{company_id}/reset")
def reset_company_faces(company_id: str):
    """Clears face records for a specific company without affecting other tenants."""
    try:
        face_engine.save_company_encodings(company_id, {})
        return {"status": "success", "message": f"All face data for company '{company_id}' cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset: {str(e)}")
