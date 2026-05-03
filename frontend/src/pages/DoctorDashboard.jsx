import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export default function DoctorDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPending: 0,
    thisWeek: 0,
    avgScore: 0
  });

  useEffect(() => {
    if (!currentUser) return;

    async function checkRoleAndFetchData() {
      try {
        // Check if user is a doctor
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || userSnap.data().role !== 'doctor') {
          navigate('/dashboard');
          return;
        }

        // Fetch escalations from backend
        const response = await fetch('http://localhost:5000/get_escalations');
        if (response.ok) {
          const data = await response.json();
          const pending = data.filter(e => e.status === 'pending');
          setEscalations(pending);

          // Calculate stats
          const totalPending = pending.length;
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          const thisWeek = pending.filter(e => {
            if (!e.timestamp) return false;
            const escalationDate = new Date(e.timestamp);
            return escalationDate >= oneWeekAgo;
          }).length;

          const avgScore = pending.length > 0
            ? Math.round(pending.reduce((sum, e) => sum + (e.anomaly_score || 0), 0) / pending.length)
            : 0;

          setStats({ totalPending, thisWeek, avgScore });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    checkRoleAndFetchData();
  }, [currentUser, navigate]);

  async function handleSchedule(escalationId) {
    try {
      const escalationRef = doc(db, 'escalations', escalationId);
      await updateDoc(escalationRef, { status: 'scheduled' });

      // Remove from UI
      setEscalations(escalations.filter(e => e.id !== escalationId));

      // Update stats
      setStats(prev => ({
        ...prev,
        totalPending: prev.totalPending - 1
      }));
    } catch (error) {
      console.error('Error scheduling escalation:', error);
    }
  }

  async function handleDismiss(escalationId) {
    try {
      const escalationRef = doc(db, 'escalations', escalationId);
      await updateDoc(escalationRef, { status: 'dismissed' });

      // Remove from UI
      setEscalations(escalations.filter(e => e.id !== escalationId));

      // Update stats
      setStats(prev => ({
        ...prev,
        totalPending: prev.totalPending - 1
      }));
    } catch (error) {
      console.error('Error dismissing escalation:', error);
    }
  }

  function getScoreBadgeColor(score) {
    if (score < 40) return 'bg-green-100 text-green-700 border-green-200';
    if (score <= 65) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-76px)]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-76px)] bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-gray-600 mt-1">Patient Escalation Management</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Total Pending</p>
            <p className="text-4xl font-bold text-blue-600">{stats.totalPending}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Escalations This Week</p>
            <p className="text-4xl font-bold text-amber-600">{stats.thisWeek}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-1">Average Anomaly Score</p>
            <p className="text-4xl font-bold text-red-600">{stats.avgScore}</p>
          </div>
        </div>

        {/* Escalations List */}
        <div className="space-y-4">
          {escalations.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-500 text-lg">No pending escalations</p>
            </div>
          ) : (
            escalations.map(escalation => (
              <div
                key={escalation.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {escalation.patient_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {escalation.drug_name} • Week {escalation.weeks_in_treatment}
                    </p>
                  </div>
                  <span
                    className={`px-4 py-2 rounded-lg font-semibold border ${getScoreBadgeColor(escalation.anomaly_score)}`}
                  >
                    Score: {escalation.anomaly_score}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Symptom Reported:</p>
                    <p className="text-gray-900">{escalation.symptom_reported}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">AI Triage Summary:</p>
                    <p className="text-gray-900 bg-blue-50 p-4 rounded-lg border border-blue-100">
                      {escalation.triage_summary}
                    </p>
                  </div>
                  {escalation.timestamp && (
                    <p className="text-xs text-gray-500">
                      Escalated: {new Date(escalation.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleSchedule(escalation.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all"
                  >
                    Schedule Early Review
                  </button>
                  <button
                    onClick={() => handleDismiss(escalation.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
