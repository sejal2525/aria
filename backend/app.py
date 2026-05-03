from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
import json
from datetime import datetime
import google.generativeai as genai
import os
import traceback
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize Firebase Admin SDK
try:
    cred = credentials.Certificate('firebase_service_account.json')
    firebase_admin.initialize_app(cred)
except ValueError:
    pass

# Replace with your actual Gemini API key
genai.configure(api_key="your_actual_gemini_key_here")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        if not data or 'patient_id' not in data or 'message' not in data:
            return jsonify({"error": "Missing patient_id or message"}), 400

        patient_id = data['patient_id']
        message = data['message']

        # Load drug reference
        try:
            with open('drug_reference.json', 'r') as f:
                drug_ref = json.load(f)
        except FileNotFoundError:
            drug_ref = {}

        # Fetch patient from Firestore
        db = firestore.client()
        patient_ref = db.collection('patients').document(patient_id)
        patient_doc = patient_ref.get()
        if not patient_doc.exists:
            return jsonify({"error": "Patient not found"}), 404
        patient_data = patient_doc.to_dict()

        # Extract patient data
        name = patient_data.get('name', 'Unknown')
        diagnosis = patient_data.get('diagnosis', 'Unknown')
        drug_name = patient_data.get('drug_name', 'Unknown')
        start_date_str = patient_data.get('prescription_start_date', '')
        iop_readings = patient_data.get('iop_readings', [])
        allergies = patient_data.get('allergies', [])

        # Calculate weeks in treatment
        weeks_in_treatment = 0
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str.split('T')[0], "%Y-%m-%d")
                weeks_in_treatment = max(0, (datetime.now() - start_date).days // 7)
            except ValueError:
                pass

        # Determine week range
        week_key = "weeks_1_2"
        if 3 <= weeks_in_treatment <= 8:
            week_key = "weeks_3_8"
        elif weeks_in_treatment >= 9:
            week_key = "weeks_9_plus"

        drug_info = drug_ref.get(drug_name, {})
        current_week_info = drug_info.get(week_key, {})
        expected_side_effects = current_week_info.get("expected_side_effects", [])
        always_escalate = drug_info.get("always_escalate", [])

        # Anomaly Score
        anomaly_score = 50
        msg_lower = message.lower()
        for symptom in always_escalate:
            if symptom.lower() in msg_lower:
                anomaly_score = 90
                break
        if anomaly_score != 90:
            for symptom in expected_side_effects:
                if symptom.lower() in msg_lower:
                    anomaly_score = 20
                    break

        # Build context block
        context_block = f"""PATIENT CLINICAL CONTEXT:
Name: {name}
Diagnosis: {diagnosis}
Current Drug: {drug_name}
Prescription Start Date: {start_date_str}
Weeks in Treatment: {weeks_in_treatment}
Recent IOP Readings: {iop_readings}
Allergies: {allergies}
Expected Side Effects for Current Week Range ({week_key}): {expected_side_effects}
"""

        system_instruction = "You are ARIA, a clinical aftercare assistant for ophthalmology patients. The following is this patient's verified treatment record. Answer their question using this record as your primary source. If your answer is grounded in their specific record, end your response with the tag [GROUNDED]. If it is general medical knowledge, end with [GENERAL]."
        full_prompt = f"{system_instruction}\n\n{context_block}\n\nPatient Message: {message}"

        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(full_prompt)
        response_text = response.text

        grounding_tag = "GENERAL"
        if "[GROUNDED]" in response_text:
            grounding_tag = "GROUNDED"
            response_text = response_text.replace("[GROUNDED]", "").strip()
        elif "[GENERAL]" in response_text:
            grounding_tag = "GENERAL"
            response_text = response_text.replace("[GENERAL]", "").strip()

        return jsonify({
            "response_text": response_text,
            "grounding_tag": grounding_tag,
            "anomaly_score": anomaly_score
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/escalate', methods=['POST'])
def escalate():
    try:
        data = request.get_json()
        if not data or 'patient_id' not in data or 'message' not in data or 'anomaly_score' not in data:
            return jsonify({"error": "Missing required fields"}), 400

        anomaly_score = int(data['anomaly_score'])
        if anomaly_score <= 65:
            return jsonify({"status": "ignored"})

        patient_id = data['patient_id']
        message = data['message']
        ai_response = data.get('ai_response', '')

        db = firestore.client()
        patient_doc = db.collection('patients').document(patient_id).get()
        if not patient_doc.exists:
            return jsonify({"error": "Patient not found"}), 404
        patient_data = patient_doc.to_dict()

        name = patient_data.get('name', 'Unknown')
        diagnosis = patient_data.get('diagnosis', 'Unknown')
        drug_name = patient_data.get('drug_name', 'Unknown')
        start_date_str = patient_data.get('prescription_start_date', '')

        weeks_in_treatment = 0
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str.split('T')[0], "%Y-%m-%d")
                weeks_in_treatment = max(0, (datetime.now() - start_date).days // 7)
            except ValueError:
                pass

        context_block = f"""PATIENT CLINICAL CONTEXT:
Name: {name}
Diagnosis: {diagnosis}
Current Drug: {drug_name}
Weeks in Treatment: {weeks_in_treatment}
Symptom Reported: {message}
AI Initial Response: {ai_response}
"""
        system_instruction = "You are a clinical triage assistant. Based on the patient's context and reported symptoms, write a concise one-paragraph clinical triage summary highlighting the urgency and potential risks."
        full_prompt = f"{system_instruction}\n\n{context_block}"

        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(full_prompt)
        triage_summary = response.text.strip()

        escalation_ref = db.collection('escalations').document()
        escalation_ref.set({
            "patient_id": patient_id,
            "patient_name": name,
            "drug_name": drug_name,
            "weeks_in_treatment": weeks_in_treatment,
            "symptom_reported": message,
            "anomaly_score": anomaly_score,
            "triage_summary": triage_summary,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "status": "pending"
        })

        return jsonify({"status": "escalated", "escalation_id": escalation_ref.id})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/get_escalations', methods=['GET'])
def get_escalations():
    try:
        db = firestore.client()
        docs = db.collection('escalations').where('status', '==', 'pending').stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            if 'timestamp' in data and data['timestamp']:
                try:
                    data['timestamp'] = data['timestamp'].isoformat()
                except Exception:
                    data['timestamp'] = str(data['timestamp'])
            results.append(data)
        return jsonify(results)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/resolve_escalation', methods=['POST'])
def resolve_escalation():
    try:
        data = request.get_json()
        escalation_id = data.get('escalation_id')
        status = data.get('status')
        db = firestore.client()
        db.collection('escalations').document(escalation_id).update({'status': status})
        return jsonify({"status": "updated"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/drug_info/<drug_name>', methods=['GET'])
def get_drug_info(drug_name):
    try:
        with open('drug_reference.json', 'r') as f:
            drug_ref = json.load(f)
        if drug_name not in drug_ref:
            return jsonify({"error": "Drug not found"}), 404
        return jsonify(drug_ref[drug_name])
    except FileNotFoundError:
        return jsonify({"error": "drug_reference.json not found"}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/iop_trend', methods=['POST'])
def iop_trend():
    try:
        data = request.get_json()
        patient_id = data.get('patient_id')
        db = firestore.client()
        patient_doc = db.collection('patients').document(patient_id).get()
        if not patient_doc.exists:
            return jsonify({"error": "Patient not found"}), 404
        patient_data = patient_doc.to_dict()
        iop_readings = patient_data.get('iop_readings', [])
        iop_readings.sort(key=lambda x: x['date'])

        projected_next = None
        if len(iop_readings) >= 2:
            import numpy as np
            values = [r['value'] for r in iop_readings]
            x = list(range(len(values)))
            coeffs = np.polyfit(x, values, 1)
            projected_next = round(float(np.polyval(coeffs, len(values))), 1)

        return jsonify({
            "iop_readings": iop_readings,
            "projected_next_value": projected_next
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)