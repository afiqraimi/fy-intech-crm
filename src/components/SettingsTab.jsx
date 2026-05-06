import React, { useState, useRef, useEffect } from 'react';
import { User, Shield, Bell, Moon, Sun, Lock, Camera, Check, X, Eye, EyeOff, Mail, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

// ─── Helpers ───────────────────────────────────────────────────────────────
const loadPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem('crm_prefs')) || {
      darkMode: true,
      notifications: false,
      notifEmail: '',
    };
  } catch { return { darkMode: true, notifications: false, notifEmail: '' }; }
};

const SectionCard = ({ icon: Icon, iconColor, title, children }) => (
  <div className="bg-crm-card rounded-2xl border border-crm-border overflow-hidden">
    <div className="p-5 border-b border-crm-border flex items-center space-x-3">
      <Icon className={iconColor} size={20} />
      <h3 className="text-base font-bold text-white">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none ${checked ? 'bg-violet-600' : 'bg-crm-border'}`}
  >
    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${checked ? 'right-1' : 'left-1'}`} />
  </button>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">{label}</label>
    {children}
  </div>
);

const Input = ({ type = 'text', value, onChange, placeholder, className = '', disabled = false }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className={`w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-sm text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  />
);

const Toast = ({ message, type, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 30, scale: 0.95 }}
    className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold ${
      type === 'success'
        ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300'
        : 'bg-red-900/80 border-red-500/40 text-red-300'
    } backdrop-blur-md`}
  >
    {type === 'success' ? <Check size={16} /> : <X size={16} />}
    <span>{message}</span>
    <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
  </motion.div>
);

export default function SettingsTab({ onProfileChange }) {
  // Load initial profile from sessionStorage (set on login)
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('crm_profile')) || { name: 'Admin User', email: 'admin@fyintech.com', avatar: null };
    } catch { return { name: 'Admin User', email: 'admin@fyintech.com', avatar: null }; }
  });
  const [prefs, setPrefs] = useState(loadPrefs);

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  // Avatar
  const avatarInputRef = useRef();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Apply dark/light mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.darkMode ? 'dark' : 'light');
  }, [prefs.darkMode]);

  // ─── Avatar Upload (saves to backend) ────────────────────────────────────
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const avatarData = reader.result;
      const newProfile = { ...profile, avatar: avatarData };
      setProfile(newProfile);
      sessionStorage.setItem('crm_profile', JSON.stringify(newProfile));
      if (onProfileChange) onProfileChange(newProfile);
      // Save to backend
      try {
        await fetch(`${API_BASE}/api/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profile.name, avatar: avatarData }),
        });
        showToast('Profile picture updated!');
      } catch {
        showToast('Avatar saved locally (backend unreachable).', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  // ─── Save Profile (name + email via /api/auth/update, requires password) ─
  const saveProfile = async () => {
    // If email changed, require password confirmation
    const originalProfile = JSON.parse(sessionStorage.getItem('crm_profile') || '{}');
    const emailChanged = profile.email !== originalProfile.email;

    if (emailChanged) {
      // We need to use the update credentials endpoint which requires current password
      const pwd = prompt('Enter your current password to confirm email change:');
      if (!pwd) return;
      setSavingProfile(true);
      try {
        const res = await fetch(`${API_BASE}/api/auth/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: pwd,
            new_email: profile.email,
            new_name: profile.name,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = { ...profile, name: data.name, email: data.email };
          setProfile(updated);
          sessionStorage.setItem('crm_profile', JSON.stringify(updated));
          if (onProfileChange) onProfileChange(updated);
          showToast('Profile saved successfully!');
        } else {
          const err = await res.json();
          showToast(err.detail || 'Failed to save profile.', 'error');
        }
      } catch {
        showToast('Cannot reach server.', 'error');
      } finally {
        setSavingProfile(false);
      }
    } else {
      // Name-only change — use profile endpoint
      setSavingProfile(true);
      try {
        const res = await fetch(`${API_BASE}/api/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profile.name }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = { ...profile, name: data.name };
          setProfile(updated);
          sessionStorage.setItem('crm_profile', JSON.stringify(updated));
          if (onProfileChange) onProfileChange(updated);
          showToast('Profile saved successfully!');
        } else {
          showToast('Failed to save profile.', 'error');
        }
      } catch {
        showToast('Cannot reach server.', 'error');
      } finally {
        setSavingProfile(false);
      }
    }
  };

  // ─── Change Password ──────────────────────────────────────────────────────
  const savePassword = async () => {
    if (newPwd.length < 4) { showToast('New password must be at least 4 characters.', 'error'); return; }
    if (newPwd !== confirmPwd) { showToast('Passwords do not match.', 'error'); return; }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
        }),
      });
      if (res.ok) {
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
        showToast('Password updated successfully!');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to update password.', 'error');
      }
    } catch {
      showToast('Cannot reach server.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Save Preferences ─────────────────────────────────────────────────────
  const savePrefs = () => {
    localStorage.setItem('crm_prefs', JSON.stringify(prefs));
    showToast('Preferences saved!');
  };

  // ─── Test Notification (via Resend) ───────────────────────────────────────
  const testNotification = async () => {
    if (!prefs.notifEmail) {
      showToast('Please enter a recipient email first.', 'error');
      return;
    }
    setTestingEmail(true);
    showToast('Sending test email…', 'success');
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_emails: prefs.notifEmail.split(',').map(e => e.trim()),
          subject: 'FY Intech CRM — Test Notification',
          body: 'This is a test notification from your FY Intech CRM. Email notifications are working correctly!',
        }),
      });
      if (res.ok) showToast('Test email sent! Check your inbox.');
      else {
        const err = await res.json();
        showToast(err.error || 'Failed to send email.', 'error');
      }
    } catch {
      showToast('Could not reach notification service.', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Account Settings</h2>
        <p className="text-sm text-crm-textMuted">Manage your profile, security, and system preferences.</p>
      </div>

      {/* ─── Profile ─── */}
      <SectionCard icon={User} iconColor="text-violet-400" title="Profile Information">
        <div className="flex items-center space-x-5 mb-6">
          <div className="relative group">
            <div
              onClick={() => avatarInputRef.current.click()}
              className="w-20 h-20 rounded-full overflow-hidden border-2 border-crm-border cursor-pointer group-hover:border-violet-500 transition-colors relative"
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-crm-border flex items-center justify-center text-2xl font-black text-white">
                  {(profile.name || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                <Camera size={20} className="text-white" />
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{profile.name}</p>
            <p className="text-crm-textMuted text-xs mb-2">{profile.email}</p>
            <button
              onClick={() => avatarInputRef.current.click()}
              className="text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20 transition-colors font-semibold"
            >
              Upload Photo
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <Field label="Full Name">
            <Input value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="Your full name" />
          </Field>
          <Field label="Email Address">
            <Input type="email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} placeholder="you@company.com" />
          </Field>
        </div>
        <p className="text-[11px] text-crm-textMuted mb-4 leading-relaxed">
          💡 Changes are saved to the server — your new email and name will work on <strong className="text-white">all devices</strong>.
          Changing your email requires your current password.
        </p>
        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="flex items-center space-x-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors shadow-[0_0_15px_rgba(139,92,246,0.3)]"
        >
          {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{savingProfile ? 'Saving…' : 'Save Profile'}</span>
        </button>
      </SectionCard>

      {/* ─── Security ─── */}
      <SectionCard icon={Lock} iconColor="text-amber-400" title="Change Password">
        <div className="space-y-4">
          <Field label="Current Password">
            <div className="relative">
              <Input type={showPwd ? 'text' : 'password'} value={currentPwd} onChange={setCurrentPwd} placeholder="Enter current password" />
              <button onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-textMuted hover:text-white">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="New Password">
              <Input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={setNewPwd} placeholder="New password (min. 4 chars)" />
            </Field>
            <Field label="Confirm New Password">
              <Input type={showPwd ? 'text' : 'password'} value={confirmPwd} onChange={setConfirmPwd} placeholder="Repeat new password" />
            </Field>
          </div>
          <p className="text-[11px] text-crm-textMuted leading-relaxed">
            🔒 Password is stored securely (hashed) on the server — it applies on <strong className="text-white">all devices</strong> instantly.
          </p>
          <button
            onClick={savePassword}
            disabled={savingPassword}
            className="flex items-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-black text-sm rounded-xl transition-colors"
          >
            {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
            <span>{savingPassword ? 'Updating…' : 'Update Password'}</span>
          </button>
        </div>
      </SectionCard>

      {/* ─── Appearance ─── */}
      <SectionCard icon={Moon} iconColor="text-blue-400" title="Appearance">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl border ${prefs.darkMode ? 'bg-crm-darker border-white/10' : 'bg-white/10 border-white/20'}`}>
              {prefs.darkMode ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-amber-400" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{prefs.darkMode ? 'Dark Mode' : 'Light Mode'}</p>
              <p className="text-crm-textMuted text-xs">{prefs.darkMode ? 'High-contrast XR dark theme active' : 'Clean light theme active'}</p>
            </div>
          </div>
          <Toggle checked={prefs.darkMode} onChange={v => { setPrefs(p => ({ ...p, darkMode: v })); }} />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={savePrefs}
            className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Save size={14} />
            <span>Save Appearance</span>
          </button>
        </div>
      </SectionCard>

      {/* ─── Notifications ─── */}
      <SectionCard icon={Bell} iconColor="text-emerald-400" title="Email Notifications">
        <div className="space-y-5">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <div>
              <p className="text-white font-semibold text-sm">Enable Email Notifications</p>
              <p className="text-crm-textMuted text-xs">Get notified when project stages change or leads are updated</p>
            </div>
            <Toggle checked={prefs.notifications} onChange={v => setPrefs(p => ({ ...p, notifications: v }))} />
          </div>

          <AnimatePresence>
            {prefs.notifications && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-2">
                  {/* Info banner — no App Password needed */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">✅ Secure Setup — No Password Required</p>
                    <p className="text-crm-textMuted text-xs leading-relaxed">
                      Emails are sent via <strong className="text-white">Resend</strong> — a secure email API. 
                      Your credentials are <strong className="text-white">never stored in the browser</strong>. 
                      Just enter where you want notifications delivered below.
                    </p>
                  </div>

                  <Field label="Notification Recipient Email(s)">
                    <Input
                      type="email"
                      value={prefs.notifEmail}
                      onChange={v => setPrefs(p => ({ ...p, notifEmail: v }))}
                      placeholder="Where to send alerts (e.g. you@gmail.com)"
                    />
                    <p className="text-[11px] text-crm-textMuted mt-1.5">Separate multiple emails with a comma.</p>
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={savePrefs}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      <Save size={14} />
                      <span>Save Settings</span>
                    </button>
                    <button
                      onClick={testNotification}
                      disabled={testingEmail}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {testingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      <span>{testingEmail ? 'Sending…' : 'Send Test Email'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
