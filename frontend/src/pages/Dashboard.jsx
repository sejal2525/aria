import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adherenceToday, setAdherenceToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [weeksCompleted, setWeeksCompleted] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    async function fetchPatientData() {
      try {
        // Fetch patient document
        const patientRef = doc(db, 'patients', currentUser.uid);
        const patientSnap = await getDoc(patientRef);

        if (patientSnap.exists()) {
          const data = patientSnap.data();
          setPatient(data);

          // Calculate weeks completed
          if (data.prescription_start_date) {
            const startDate = new Date(data.prescription_start_date);
            const now = new Date();
            const weeks = Math.floor((now - startDate) / (7 * 24 * 60 * 60 * 1000));
            setWeeksCompleted(Math.max(0, weeks));
          }

          // Check today's adherence
          const today = new Date().toISOString().split('T')[0];
          const adherenceRef = doc(db, 'patients', currentUser.uid, 'adherence', today);
          const adherenceSnap = await getDoc(adherenceRef);

          if (adherenceSnap.exists()) {
            setAdherenceToday(adherenceSnap.data().completed || false);
          }

          // Calculate streak
          await calculateStreak();
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    }

    async function calculateStreak() {
      try {
        let currentStreak = 0;
        const today = new Date();

        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];

          const adherenceRef = doc(db, 'patients', currentUser.uid, 'adherence', dateStr);
          const adherenceSnap = await getDoc(adherenceRef);

          if (adherenceSnap.exists() && adherenceSnap.data().completed) {
            currentStreak++;
          } else {
            break;
          }
        }

        setStreak(currentStreak);
      } catch (error) {
        console.error('Error calculating streak:', error);
      }
    }

    fetchPatientData();
  }, [currentUser]);

  async function handleAdherenceToggle() {
    if (!currentUser) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const adherenceRef = doc(db, 'patients', currentUser.uid, 'adherence', today);

      const newValue = !adherenceToday;
      await setDoc(adherenceRef, { completed: newValue, date: today });
      setAdherenceToday(newValue);

      // Recalculate streak
      if (newValue) {
        setStreak(streak + 1);
      } else {
        setStreak(0);
      }
    } catch (error) {
      console.error('Error updating adherence:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-76px)]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-76px)]">
        <div className="text-gray-500">No patient data found</div>
      </div>
    );
  }

  const progressPercentage = patient.total_weeks
    ? Math.min(100, (weeksCompleted / patient.total_weeks) * 100)
    : 0;

  return (
    <div className="min-h-[calc(100vh-76px)] bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900">{patient.name}</h1>
          <p className="text-gray-600 mt-1">{patient.diagnosis}</p>
        </div>

        {/* Treatment Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Treatment Progress</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Week {weeksCompleted} of {patient.total_weeks || 0}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Treatment Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Treatment</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Drug Name:</span>
              <span className="font-semibold text-gray-900">{patient.drug_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Start Date:</span>
              <span className="font-semibold text-gray-900">
                {new Date(patient.prescription_start_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Next Appointment:</span>
              <span className="font-semibold text-gray-900">
                {patient.next_appointment
                  ? new Date(patient.next_appointment).toLocaleDateString()
                  : 'Not scheduled'}
              </span>
            </div>
          </div>
        </div>

        {/* Daily Adherence */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Adherence</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleAdherenceToggle}
                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${adherenceToday
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                  }`}
              >
                {adherenceToday && (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-medium text-gray-900">Mark today's dose as taken</p>
                <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{streak}</p>
              <p className="text-sm text-gray-600">day streak</p>
            </div>
          </div>
        </div>

        {/* Ask ARIA Button */}
        <Link
          to="/chat"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/30"
        >
          Ask ARIA
        </Link>
      </div>
    </div>
  );
}
