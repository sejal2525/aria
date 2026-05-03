import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export default function AdherenceLog() {
    const { currentUser } = useAuth();
    const [adherenceData, setAdherenceData] = useState({});
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [adherenceScore, setAdherenceScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        async function fetchAdherenceData() {
            try {
                const adherenceRef = collection(db, 'patients', currentUser.uid, 'adherence');
                const adherenceSnap = await getDocs(adherenceRef);

                const data = {};
                adherenceSnap.forEach(doc => {
                    data[doc.id] = doc.data();
                });

                setAdherenceData(data);
                calculateStats(data);
            } catch (error) {
                console.error('Error fetching adherence data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchAdherenceData();
    }, [currentUser]);

    function calculateStats(data) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Calculate adherence score for current month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = now.getDate();

        let completedDays = 0;
        for (let day = 1; day <= today; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (data[dateStr]?.completed) {
                completedDays++;
            }
        }

        const score = today > 0 ? Math.round((completedDays / today) * 100) : 0;
        setAdherenceScore(score);

        // Calculate 7-day streak
        let currentStreak = 0;
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(now.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            if (data[dateStr]?.completed) {
                currentStreak++;
            } else {
                break;
            }
        }
        setStreak(currentStreak);
    }

    async function toggleAdherence(dateStr) {
        if (!currentUser) return;

        try {
            const adherenceRef = doc(db, 'patients', currentUser.uid, 'adherence', dateStr);
            const currentValue = adherenceData[dateStr]?.completed || false;
            const newValue = !currentValue;

            await setDoc(adherenceRef, { completed: newValue, date: dateStr });

            const newData = {
                ...adherenceData,
                [dateStr]: { completed: newValue, date: dateStr }
            };

            setAdherenceData(newData);
            calculateStats(newData);
        } catch (error) {
            console.error('Error updating adherence:', error);
        }
    }

    function getDaysInMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        const startPadding = firstDay.getDay(); // 0 = Sunday

        // Add padding for days before month starts
        for (let i = 0; i < startPadding; i++) {
            days.push(null);
        }

        // Add all days in month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            days.push(day);
        }

        return days;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-76px)]">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    const days = getDaysInMonth(currentMonth);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    return (
        <div className="min-h-[calc(100vh-76px)] bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h1 className="text-3xl font-bold text-gray-900">Adherence Log</h1>
                    <p className="text-gray-600 mt-1">Track your daily medication adherence</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <p className="text-sm text-gray-600 mb-1">Adherence Score (This Month)</p>
                        <p className="text-4xl font-bold text-blue-600">{adherenceScore}%</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <p className="text-sm text-gray-600 mb-1">7-Day Streak</p>
                        <p className="text-4xl font-bold text-green-600">{streak} days</p>
                    </div>
                </div>

                {/* Calendar */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">{monthName}</h2>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {days.map((day, index) => {
                            if (day === null) {
                                return <div key={`empty-${index}`} className="aspect-square" />;
                            }

                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isCompleted = adherenceData[dateStr]?.completed || false;
                            const isToday = isCurrentMonth && day === today.getDate();
                            const isFuture = new Date(dateStr) > today;

                            return (
                                <button
                                    key={day}
                                    onClick={() => !isFuture && toggleAdherence(dateStr)}
                                    disabled={isFuture}
                                    className={`
                    aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                    transition-all relative
                    ${isFuture
                                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                                            : 'hover:border-blue-400 cursor-pointer'
                                        }
                    ${isCompleted
                                            ? 'bg-green-100 border-green-500'
                                            : 'bg-white border-gray-200'
                                        }
                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  `}
                                >
                                    <span className={`text-lg font-semibold ${isCompleted ? 'text-green-700' : 'text-gray-700'}`}>
                                        {day}
                                    </span>
                                    {isCompleted && (
                                        <svg className="w-5 h-5 text-green-600 absolute bottom-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-500"></div>
                            <span>Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-white border-2 border-gray-200"></div>
                            <span>Not completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-white border-2 border-blue-500 ring-2 ring-blue-500 ring-offset-2"></div>
                            <span>Today</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
