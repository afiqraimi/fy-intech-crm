import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Bell, Moon, Sun, Lock, Camera, Check, X, Eye, EyeOff, Mail, Save, Loader2, Rocket, Radar, Play, Trash2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiJson } from '../utils/api';
import { clearAuthSession, getStoredProfile, normalizeEmail, setAuthSession, setStoredProfile } from '../utils/auth';

const DEFAULT_PREFS = {
  darkMode: true,
  notifications: false,
  notifEmail: '',
};

const loadPrefs = () => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('crm_prefs') || '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
};

const SectionCard = ({ icon: Icon, iconColor, title, children }) => (
  <div className="bg-crm-card rounded-xl md:rounded-2xl border border-crm-border overflow-hidden">
    <div className="p-4 md:p-5 border-b border-crm-border flex items-center space-x-3">
      <Icon className={iconColor} size={20} />
      <h3 className="text-base font-bold text-white">{title}</h3>
    </div>
    <div className="p-4 md:p-6">{children}</div>
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
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
    className={`fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold ${
      type === 'success'
        ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300'
        : 'bg-red-900/80 border-red-500/40 text-red-300'
    } backdrop-blur-md`}
  >
    {type === 'success' ? <Check size={16} /> : <X size={16} />}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
  </motion.div>
);

export default function SettingsTab({ onProfileChange }) {
  const [profile, setProfile] = useState(() => getStoredProfile() || { name: 'Admin User', email: 'admin@fyintech.com', avatar: null });
  const [prefs, setPrefs] = useState(loadPrefs);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [engineIndustry, setEngineIndustry] = useState('Oil & Gas');
  const [engineRevenue, setEngineRevenue] = useState('RM10M-50M');
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineResult, setEngineResult] = useState(null);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState(null);
  const [toast, setToast] = useState(null);
  const avatarInputRef = useRef();
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.darkMode ? 'dark' : 'light');
  }, [prefs.darkMode]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const checkAndPoll = async () => {
      try {
        const status = await apiJson('/api/admin/lead-engine/sweep-status');
        if (cancelled) return;
        if (status.running || (status.finished && status.total > 0)) {
          setSweepResult(status);
          if (!status.finished) {
            setSweeping(true);
            timer = setTimeout(() => checkAndPoll(), 2000);
          } else {
            setSweeping(false);
          }
        }

        const enrichStatus = await apiJson('/api/admin/lead-engine/enrich-status');
        if (cancelled) return;
        if (enrichStatus.running || (enrichStatus.finished && enrichStatus.total > 0)) {
          setEnrichResult(enrichStatus);
          if (!enrichStatus.finished) {
            setEnriching(true);
            timer = setTimeout(() => checkAndPoll(), 2000);
          } else {
            setEnriching(false);
          }
        }
      } catch {
        // sweep-status endpoint might not exist yet on old deploy
      }
    };

    checkAndPoll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadServerSettings = async () => {
      try {
        const [serverProfile, notificationPrefs] = await Promise.all([
          apiJson('/api/auth/me'),
          apiJson('/api/notification-settings'),
        ]);
        if (cancelled) return;

        const nextProfile = {
          name: serverProfile.name,
          email: serverProfile.email,
          avatar: serverProfile.avatar || null,
        };
        setProfile(nextProfile);
        setStoredProfile(nextProfile);
        onProfileChange?.(nextProfile);
        setPrefs(current => ({
          ...current,
          notifications: notificationPrefs.notifications,
          notifEmail: notificationPrefs.notifEmail || '',
        }));
      } catch (error) {
        if (error.status === 401) {
          clearAuthSession();
          navigate('/login', { replace: true });
          return;
        }
        console.warn('Could not load server settings:', error);
      }
    };

    loadServerSettings();
    return () => { cancelled = true; };
  }, [onProfileChange, navigate]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const avatarData = reader.result;
      const nextProfile = { ...profile, avatar: avatarData };
      setProfile(nextProfile);
      setStoredProfile(nextProfile);
      onProfileChange?.(nextProfile);

      try {
        await apiJson('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name: profile.name, avatar: avatarData }),
        });
        showToast('Profile picture updated!');
      } catch (error) {
        showToast(error.message || 'Avatar saved locally only.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    const originalProfile = getStoredProfile() || {};
    const nextEmail = normalizeEmail(profile.email);
    const emailChanged = nextEmail !== normalizeEmail(originalProfile.email);

    setSavingProfile(true);
    try {
      let updated;
      if (emailChanged) {
        const pwd = prompt('Enter your current password to confirm email change:');
        if (!pwd) {
          setSavingProfile(false);
          return;
        }
        const data = await apiJson('/api/auth/update', {
          method: 'PUT',
          body: JSON.stringify({
            current_password: pwd,
            new_email: nextEmail,
            new_name: profile.name,
          }),
        });
        updated = setAuthSession(data);
      } else {
        const data = await apiJson('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name: profile.name }),
        });
        updated = { ...profile, name: data.name, email: data.email, avatar: data.avatar || null };
        setStoredProfile(updated);
      }

      setProfile(updated);
      onProfileChange?.(updated);
      showToast('Profile saved successfully!');
    } catch (error) {
      showToast(error.message || 'Cannot reach server.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (newPwd.length < 4) {
      showToast('New password must be at least 4 characters.', 'error');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setSavingPassword(true);
    try {
      const data = await apiJson('/api/auth/update', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
        }),
      });
      setAuthSession(data);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      showToast('Password updated successfully!');
    } catch (error) {
      showToast(error.message || 'Cannot reach server.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const savePrefs = async () => {
    localStorage.setItem('crm_prefs', JSON.stringify(prefs));
    try {
      const data = await apiJson('/api/notification-settings', {
        method: 'PUT',
        body: JSON.stringify({
          notifications: prefs.notifications,
          notifEmail: prefs.notifEmail,
        }),
      });
      setPrefs(current => ({
        ...current,
        notifications: data.notifications,
        notifEmail: data.notifEmail || '',
      }));
      showToast('Preferences saved!');
    } catch (error) {
      showToast(error.message || 'Preferences saved locally only.', 'error');
    }
  };

  const testNotification = async () => {
    if (!prefs.notifEmail) {
      showToast('Please enter a recipient email first.', 'error');
      return;
    }

    setTestingEmail(true);
    try {
      await savePrefs();
      await apiJson('/api/notifications/test', { method: 'POST' });
      showToast('Test email sent! Check your inbox.');
    } catch (error) {
      showToast(error.message || 'Could not reach notification service.', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const runLeadEngine = async () => {
    setEngineRunning(true);
    setEngineResult(null);
    try {
      const result = await apiJson('/api/admin/lead-engine/trigger', {
        method: 'POST',
        body: JSON.stringify({ industry: engineIndustry, revenue_range: engineRevenue }),
      });
      setEngineResult(result);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(`${result.created || 0} leads created, ${result.skipped || 0} skipped`);
      }
    } catch (error) {
      showToast(error.message || 'Failed to run lead engine', 'error');
    } finally {
      setEngineRunning(false);
    }
  };

  const clearDemoLeads = async () => {
    if (!confirm('This will permanently delete ALL demo/manual leads. Only n8n-scraped leads will remain. Continue?')) return;
    setClearingDemo(true);
    try {
      const result = await apiJson('/api/admin/leads/clear-demo', { method: 'POST' });
      showToast(`${result.deleted} demo leads deleted`);
    } catch (error) {
      showToast(error.message || 'Failed to clear demo leads', 'error');
    } finally {
      setClearingDemo(false);
    }
  };

  const sweepAllIndustries = async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const start = await apiJson('/api/admin/lead-engine/sweep', { method: 'POST' });
      if (!start.started) {
        showToast('Sweep failed to start', 'error');
        setSweeping(false);
        return;
      }
      const poll = async () => {
        const status = await apiJson('/api/admin/lead-engine/sweep-status');
        setSweepResult(status);
        if (!status.running && status.finished) {
          setSweeping(false);
          showToast(`${status.total_created} leads found across ${status.total} industries`);
        } else {
          setTimeout(poll, 2000);
        }
      };
      poll();
    } catch (error) {
      showToast(error.message || 'Sweep failed', 'error');
      setSweeping(false);
    }
  };

  const enrichExisting = async () => {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const start = await apiJson('/api/admin/lead-engine/enrich-existing', { method: 'POST' });
      if (!start.started) {
        showToast('Enrichment failed to start', 'error');
        setEnriching(false);
        return;
      }
      const poll = async () => {
        try {
          const status = await apiJson('/api/admin/lead-engine/enrich-status');
          setEnrichResult(status);
          if (!status.running && status.finished) {
            setEnriching(false);
            showToast(`${status.enriched} of ${status.total} leads enriched`);
          } else {
            setTimeout(poll, 2000);
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };
      poll();
    } catch (error) {
      showToast(error.message || 'Enrichment failed', 'error');
      setEnriching(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 w-full max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Account Settings</h2>
        <p className="text-sm text-crm-textMuted">Manage your profile, security, and system preferences.</p>
      </div>

      <SectionCard icon={User} iconColor="text-violet-400" title="Profile Information">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-6">
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
              type="button"
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
          Profile changes are saved to the server and apply on all devices. Changing your email requires your current password.
        </p>
        <button
          type="button"
          onClick={saveProfile}
          disabled={savingProfile}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors shadow-[0_0_15px_rgba(139,92,246,0.3)]"
        >
          {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </SectionCard>

      <SectionCard icon={Lock} iconColor="text-amber-400" title="Change Password">
        <div className="space-y-4">
          <Field label="Current Password">
            <div className="relative">
              <Input type={showPwd ? 'text' : 'password'} value={currentPwd} onChange={setCurrentPwd} placeholder="Enter current password" />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-textMuted hover:text-white">
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
          <button
            type="button"
            onClick={savePassword}
            disabled={savingPassword}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-black text-sm rounded-xl transition-colors"
          >
            {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
            <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
          </button>
        </div>
      </SectionCard>

      <SectionCard icon={Moon} iconColor="text-blue-400" title="Appearance">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            <div className={`p-3 rounded-xl border shrink-0 ${prefs.darkMode ? 'bg-crm-darker border-white/10' : 'bg-white/10 border-white/20'}`}>
              {prefs.darkMode ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-amber-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm">{prefs.darkMode ? 'Dark Mode' : 'Light Mode'}</p>
              <p className="text-crm-textMuted text-xs">Theme preference is saved on this device.</p>
            </div>
          </div>
          <Toggle checked={prefs.darkMode} onChange={v => setPrefs(p => ({ ...p, darkMode: v }))} />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={savePrefs}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Save size={14} />
            <span>Save Appearance</span>
          </button>
        </div>
      </SectionCard>

      <SectionCard icon={Rocket} iconColor="text-amber-400" title="Lead Engine">
        <div className="space-y-4">
          <p className="text-xs text-crm-textMuted leading-relaxed">
            Run the automated lead generation pipeline. Searches for companies via Firecrawl, scrapes contact info,
            drafts outreach emails with DeepSeek AI, and saves everything to the CRM.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Industry">
              <Input value={engineIndustry} onChange={setEngineIndustry} placeholder="e.g. Oil & Gas" />
            </Field>
            <Field label="Revenue Range">
              <select
                value={engineRevenue}
                onChange={e => setEngineRevenue(e.target.value)}
                className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
              >
                <option value="RM10M-50M">RM10M-50M (Mid Market)</option>
                <option value="RM50M+">RM50M+ (Enterprise)</option>
                <option value="RM1M-10M">RM1M-10M (SME)</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runLeadEngine}
              disabled={engineRunning}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-black text-sm rounded-xl transition-colors"
            >
              {engineRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              <span>{engineRunning ? 'Running Pipeline...' : 'Run Lead Engine'}</span>
            </button>
            <button
              type="button"
              onClick={clearDemoLeads}
              disabled={clearingDemo}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
            >
              {clearingDemo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              <span>{clearingDemo ? 'Clearing...' : 'Clear Demo Data'}</span>
            </button>
            <button
              type="button"
              onClick={enrichExisting}
              disabled={enriching}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-teal-600/80 hover:bg-teal-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
            >
              {enriching ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span>{enriching ? 'Enriching...' : 'Enrich Existing Leads'}</span>
            </button>
            {enrichResult && (
              <div className="w-full bg-teal-500/5 border border-teal-500/20 rounded-xl p-3 text-xs text-crm-textMuted space-y-1">
                <p className="text-teal-400 font-bold uppercase tracking-wider">
                  {enrichResult.running ? `Enriching\u2026 ${enrichResult.current}/${enrichResult.total} \u2014 ${enrichResult.current_company}` : 'Enrichment Complete'}
                </p>
                <p>{enrichResult.enriched || 0} enriched of {enrichResult.total || 0} leads</p>
              </div>
            )}
            <button
              type="button"
              onClick={sweepAllIndustries}
              disabled={sweeping}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors"
            >
              {sweeping ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
              <span>{sweeping ? 'Sweeping...' : 'Sweep All Industries'}</span>
            </button>
          </div>
          {sweepResult && (
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 space-y-2">
              <p className="text-violet-400 text-xs font-bold uppercase tracking-widest">
                {sweepResult.running ? `Sweeping\u2026 ${sweepResult.current}/${sweepResult.total} \u2014 ${sweepResult.current_desc}` : 'Sweep Complete'}
              </p>
              <div className="flex gap-4 text-sm">
                <span className="text-white">{sweepResult.total_created || 0} <span className="text-crm-textMuted">created</span></span>
                <span className="text-white">{sweepResult.total_skipped || 0} <span className="text-crm-textMuted">skipped</span></span>
                <span className="text-white">{sweepResult.total || 0} <span className="text-crm-textMuted">industries</span></span>
              </div>
              {sweepResult.results && sweepResult.results.length > 0 && (
                <details className="text-xs text-crm-textMuted">
                  <summary className="cursor-pointer hover:text-white mt-1">View per-industry breakdown</summary>
                  <div className="mt-2 space-y-1">
                    {sweepResult.results.map((r, i) => (
                      <div key={i} className="flex justify-between py-1 px-2 bg-black/20 rounded">
                        <span>{r.description}</span>
                        <span className={r.error ? 'text-red-400' : 'text-emerald-400'}>
                          {r.error ? 'Failed' : `+${r.created} / ${r.skipped} skip`}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          {engineResult && !engineResult.error && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Pipeline Complete</p>
              <div className="flex gap-4 text-sm">
                <span className="text-white">{engineResult.created || 0} <span className="text-crm-textMuted">created</span></span>
                <span className="text-white">{engineResult.skipped || 0} <span className="text-crm-textMuted">skipped</span></span>
              </div>
              {engineResult.log && (
                <details open={!!engineResult?.error} className="text-xs text-crm-textMuted">
                  <summary className="cursor-pointer hover:text-white">View log</summary>
                  <pre className="mt-2 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-40 whitespace-pre-wrap">{engineResult.log.join('\n')}</pre>
                </details>
              )}
            </div>
          )}
          {engineResult && engineResult.error && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Pipeline Failed</p>
              <p className="text-red-300 text-sm">{engineResult.error}</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={Bell} iconColor="text-emerald-400" title="Email Notifications">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm">Enable Email Notifications</p>
              <p className="text-crm-textMuted text-xs">Automatically email recipients after CRM updates are saved.</p>
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
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Secure Setup - No App Password</p>
                    <p className="text-crm-textMuted text-xs leading-relaxed">
                      Emails are sent by the backend through Resend. The API key stays in your server environment variables, never in the browser.
                    </p>
                  </div>

                  <Field label="Notification Recipient Email(s)">
                    <Input
                      type="text"
                      value={prefs.notifEmail}
                      onChange={v => setPrefs(p => ({ ...p, notifEmail: v }))}
                      placeholder="you@gmail.com, teammate@company.com"
                    />
                    <p className="text-[11px] text-crm-textMuted mt-1.5">Separate multiple emails with a comma.</p>
                  </Field>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={savePrefs}
                      className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      <Save size={14} />
                      <span>Save Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={testNotification}
                      disabled={testingEmail}
                      className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {testingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      <span>{testingEmail ? 'Sending...' : 'Send Test Email'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
