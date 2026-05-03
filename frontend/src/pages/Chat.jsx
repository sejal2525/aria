import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../firebase';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: 'aria', content: 'Hi! I am ARIA, your treatment assistant. How are you feeling today?', grounding: 'GROUNDED' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [banner, setBanner] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const uid = auth.currentUser?.uid;

      console.log('Sending patient_id:', uid);
      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: uid, message: userMessage })
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'aria',
        content: data.response_text || data.response || 'Sorry, I could not process that.',
        grounding: data.grounding_tag || 'GENERAL'
      }]);

      if (data.anomaly_score > 65) {
        setBanner(true);
        fetch('http://localhost:5000/escalate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: uid,
            message: userMessage,
            anomaly_score: data.anomaly_score,
            ai_response: data.response_text || ''
          })
        }).catch(console.error);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'aria',
        content: 'I am having trouble connecting right now. Please make sure the backend is running.',
        grounding: 'GENERAL'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Use Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      setInput(e.results[0][0].transcript);
      setRecording(false);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">A</div>
        <div>
          <h1 className="font-semibold text-gray-900">ARIA</h1>
          <p className="text-xs text-gray-500">Your treatment assistant</p>
        </div>
      </div>

      {banner && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
          <p className="text-amber-800 text-sm">⚠️ This symptom has been flagged for your doctor's review.</p>
          <button onClick={() => setBanner(false)} className="text-amber-600 text-sm font-medium">Dismiss</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-xs lg:max-w-md">
              <div className={`px-4 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm border rounded-bl-sm'}`}>
                {msg.content}
              </div>
              {msg.role === 'aria' && msg.grounding && (
                <div className="mt-1 ml-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${msg.grounding === 'GROUNDED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {msg.grounding === 'GROUNDED' ? 'based on your treatment record' : 'general medical information'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t px-4 py-3 flex items-center gap-2">
        <button
          onClick={toggleRecording}
          className={`p-2 rounded-full transition-colors ${recording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {recording ? (
            <span className="flex items-center gap-1 px-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-xs">Recording</span>
            </span>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 15a4 4 0 004-4V7a4 4 0 00-8 0v4a4 4 0 004 4z" />
            </svg>
          )}
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ARIA anything about how you're feeling..."
          className="flex-1 bg-gray-50 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}