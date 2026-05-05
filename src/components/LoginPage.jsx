import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      // Check stored profile email (fallback to default)
      const storedProfile = JSON.parse(localStorage.getItem('crm_profile') || '{}');
      const validEmail = storedProfile.email || 'admin@fyintech.com';

      // Check stored password (fallback to 'admin')
      const validPassword = JSON.parse(localStorage.getItem('crm_password') || '"admin"');

      if (email === validEmail && password === validPassword) {
        sessionStorage.setItem('isAuthenticated', 'true');
        navigate('/dashboard', { replace: true });
      } else {
        setError('Invalid credentials. Access denied.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="flex h-screen items-center justify-center relative z-10 px-4 animate-in fade-in duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="glass-panel-heavy p-8 rounded-3xl w-full max-w-md relative overflow-hidden"
      >
        {/* Animated Top Border Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="FY INTECH" className="h-10 w-auto drop-shadow-md" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">System Login</h2>
        <p className="text-crm-textMuted text-center text-sm mb-8">Enter your secure credentials to access the CRM.</p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-6 text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-textMuted" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address" 
                className="w-full bg-black/40 border border-crm-border/50 text-white text-sm rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/50 focus:bg-black/60 transition-all backdrop-blur-md"
                required
              />
            </div>
          </div>
          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-textMuted" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" 
                className="w-full bg-black/40 border border-crm-border/50 text-white text-sm rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-white/50 focus:bg-black/60 transition-all backdrop-blur-md"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-bold tracking-wide transition-all flex items-center justify-center space-x-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Authenticate</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
