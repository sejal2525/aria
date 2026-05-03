import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Profile() {
  const { currentUser } = useAuth();
  const [patient, setPatient] = useState(null);
  const [drugInfo, setDrugInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    async function fetchData() {
      try {
        // Fetch patient document
        const patientRef = doc(db, 'patients', currentUser.uid);
        const patientSnap = await getDoc(patientRef);

        if (patientSnap.exists()) {
          const data = patientSnap.data();
          setPatient(data);

          // Fetch drug info from Flask backend
          if (data.drug_name) {
            try {
              const response = await fetch(`http://localhost:5000/drug_info/${data.drug_name}`);
              if (response.ok) {
                const drugData = await response.json();
                setDrugInfo(drugData);
              }
            } catch (error) {
              console.error('Error fetching drug info:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser]);

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

  // Prepare chart data
  const iopReadings = patient.iop_readings || [];
  const chartData = {
    labels: iopReadings.map(reading => new Date(reading.date).toLocaleDateString()),
    datasets: [
      {
        label: 'IOP (mmHg)',
        data: iopReadings.map(reading => reading.value),
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: true,
        text: 'IOP Readings Over Time',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      annotation: {
        annotations: {
          line1: {
            type: 'line',
            yMin: 21,
            yMax: 21,
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: 'Upper Normal Limit',
              enabled: true,
              position: 'end'
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        min: 10,
        max: 30,
        title: {
          display: true,
          text: 'IOP (mmHg)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Visit Date'
        }
      }
    }
  };

  // Add reference line manually since annotation plugin needs separate install
  const maxIOP = Math.max(...iopReadings.map(r => r.value), 21);
  const minIOP = Math.min(...iopReadings.map(r => r.value), 10);

  return (
    <div className="min-h-[calc(100vh-76px)] bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Patient Demographics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Treatment Profile</h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Patient Name</p>
              <p className="text-lg font-semibold text-gray-900">{patient.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Diagnosis</p>
              <p className="text-lg font-semibold text-gray-900">{patient.diagnosis}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Medication</p>
              <p className="text-lg font-semibold text-gray-900">{patient.drug_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Treatment Start</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(patient.prescription_start_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* IOP Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">IOP Readings</h2>
          <div className="h-80 relative">
            <Line data={chartData} options={chartOptions} />
            {/* Manual reference line annotation */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div
                className="absolute w-full border-t-2 border-red-500 border-dashed"
                style={{ top: `${((maxIOP - 21) / (maxIOP - minIOP)) * 100}%` }}
              >
                <span className="absolute right-2 -top-3 text-xs text-red-600 bg-white px-1">
                  Upper Normal Limit (21 mmHg)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Effect Timeline */}
        {drugInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Expected Side Effects Timeline</h2>
            <div className="space-y-6">
              {/* Weeks 1-2 */}
              {drugInfo.weeks_1_2 && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                    <div className="w-0.5 h-full bg-blue-200 mt-2"></div>
                  </div>
                  <div className="flex-1 pb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Weeks 1-2</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {drugInfo.weeks_1_2.expected_side_effects?.map((effect, idx) => (
                        <li key={idx} className="text-sm">{effect}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500 mt-2">
                      Severity: {drugInfo.weeks_1_2.severity}
                    </p>
                  </div>
                </div>
              )}

              {/* Weeks 3-8 */}
              {drugInfo.weeks_3_8 && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                    <div className="w-0.5 h-full bg-blue-200 mt-2"></div>
                  </div>
                  <div className="flex-1 pb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Weeks 3-8</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {drugInfo.weeks_3_8.expected_side_effects?.map((effect, idx) => (
                        <li key={idx} className="text-sm">{effect}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500 mt-2">
                      Severity: {drugInfo.weeks_3_8.severity}
                    </p>
                  </div>
                </div>
              )}

              {/* Weeks 9+ */}
              {drugInfo.weeks_9_plus && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Weeks 9+</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {drugInfo.weeks_9_plus.expected_side_effects?.map((effect, idx) => (
                        <li key={idx} className="text-sm">{effect}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500 mt-2">
                      Severity: {drugInfo.weeks_9_plus.severity}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Allergies */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Allergies</h2>
          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 font-medium"
                >
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No known allergies</p>
          )}
        </div>
      </div>
    </div>
  );
}
