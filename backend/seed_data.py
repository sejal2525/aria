import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

# Initialize Firebase Admin SDK
cred = credentials.Certificate('firebase_service_account.json')
try:
    firebase_admin.initialize_app(cred)
except ValueError:
    pass

db = firestore.client()

# YOUR ACTUAL FIREBASE AUTH UID
MY_UID = 'hEL5cy1qYAZg2aHGMczPn0OqzZr1'

def create_patient_documents():
    now = datetime.now()

    patient1_start = now - timedelta(days=70)
    patient1_data = {
        'name': 'Rajesh Kumar',
        'diagnosis': 'Primary Open-Angle Glaucoma',
        'drug_name': 'Latanoprost',
        'prescription_start_date': patient1_start.isoformat(),
        'total_weeks': 24,
        'iop_readings': [
            {'date': (now - timedelta(days=75)).isoformat(), 'value': 26},
            {'date': (now - timedelta(days=45)).isoformat(), 'value': 22},
            {'date': (now - timedelta(days=15)).isoformat(), 'value': 18}
        ],
        'allergies': [],
        'next_appointment': (now + timedelta(days=14)).isoformat()
    }
    db.collection('patients').document(MY_UID).set(patient1_data)
    print('✓ Created patient: Rajesh Kumar')

    patient2_start = now - timedelta(days=28)
    patient2_data = {
        'name': 'Meena Sundaram',
        'diagnosis': 'Ocular Hypertension',
        'drug_name': 'Timolol',
        'prescription_start_date': patient2_start.isoformat(),
        'total_weeks': 12,
        'iop_readings': [
            {'date': (now - timedelta(days=28)).isoformat(), 'value': 24},
            {'date': (now - timedelta(days=14)).isoformat(), 'value': 21}
        ],
        'allergies': ['sulfonamides'],
        'next_appointment': (now + timedelta(days=7)).isoformat()
    }
    db.collection('patients').document('demo-patient-2').set(patient2_data)
    print('✓ Created patient: Meena Sundaram')

    patient3_start = now - timedelta(days=112)
    patient3_data = {
        'name': 'Arjun Venkat',
        'diagnosis': 'Normal Tension Glaucoma',
        'drug_name': 'Brimonidine',
        'prescription_start_date': patient3_start.isoformat(),
        'total_weeks': 24,
        'iop_readings': [
            {'date': (now - timedelta(days=112)).isoformat(), 'value': 25},
            {'date': (now - timedelta(days=84)).isoformat(), 'value': 22},
            {'date': (now - timedelta(days=56)).isoformat(), 'value': 19},
            {'date': (now - timedelta(days=28)).isoformat(), 'value': 16}
        ],
        'allergies': [],
        'next_appointment': (now + timedelta(days=21)).isoformat()
    }
    db.collection('patients').document('demo-patient-3').set(patient3_data)
    print('✓ Created patient: Arjun Venkat')

def create_user_documents():
    users = [
        {'id': MY_UID, 'email': 'sejal@demo.com', 'role': 'patient'},
        {'id': 'demo-patient-2', 'email': 'meena@demo.com', 'role': 'patient'},
        {'id': 'demo-patient-3', 'email': 'arjun@demo.com', 'role': 'patient'},
        {'id': 'demo-doctor-1', 'email': 'doctor@demo.com', 'role': 'doctor'}
    ]
    for user in users:
        uid = user['id']
        db.collection('users').document(uid).set({
            'email': user['email'],
            'role': user['role']
        })
        print(f'✓ Created user: {user["email"]} ({user["role"]})')

def main():
    print('Starting seed data creation...\n')
    print('Creating patient documents...')
    create_patient_documents()
    print('\nCreating user documents...')
    create_user_documents()
    print('\n✅ Seed data creation completed successfully!')

if __name__ == '__main__':
    main()