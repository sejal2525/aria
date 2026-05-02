import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-2xl font-extrabold text-blue-600 tracking-tight">ARIA</Link>
        {currentUser && (
          <div className="hidden md:flex gap-6">
            <Link to="/dashboard" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">Dashboard</Link>
            <Link to="/chat" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">Chat</Link>
            <Link to="/profile" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">Treatment Profile</Link>
            <Link to="/doctor" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">Doctor Portal</Link>
          </div>
        )}
      </div>
      {currentUser && (
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-700 font-medium">{currentUser.email}</span>
          <button 
            onClick={handleLogout}
            className="bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-gray-200 hover:border-red-100"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
