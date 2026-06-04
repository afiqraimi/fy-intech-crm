import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  LayoutDashboard,
  Radar,
  KanbanSquare,
  Settings,
  Search,
  Bell,
  User,
  TrendingUp,
  Flame,
  CheckCircle2,
  LogOut,
  Rocket,
  ServerCrash,
  RefreshCw,
  Download,
  Share2,
  X,
  Volume2,
} from 'lucide-react';

import DashboardTab from './DashboardTab';
import LeadRadarTab from './LeadRadarTab';
import PipelineTab from './PipelineTab';
import SettingsTab, { applyTheme } from './SettingsTab';
import ProjectsTab from './ProjectsTab';
import AvatarTab from './AvatarTab';
import { apiJson, API_BASE } from '../utils/api';
import { clearAuthSession, getStoredProfile, setStoredProfile } from '../utils/auth';
import toast from 'react-hot-toast';

// ── Theme watcher ──────────────────────────────────────────────────
function useIsDark() {
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute('data-theme') !== 'light'
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ── Neural-network particle background (persistent across all tabs) ─
const N = 130, LINK = 3.0, SPEED = 0.0028, BOUNDS = 9;

function NeuralNet() {
  const isDark   = useIsDark();
  const groupRef = useRef();
  const coreRef  = useRef();
  const linesRef = useRef();

  const { pos, vel, lineBuf } = useMemo(() => {
    const pos    = new Float32Array(N * 3);
    const vel    = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * BOUNDS * 2;
      pos[i*3+1] = (Math.random() - 0.5) * BOUNDS * 2;
      pos[i*3+2] = (Math.random() - 0.5) * BOUNDS;
      const s = SPEED * (0.5 + Math.random());
      const a = Math.random() * Math.PI * 2;
      vel[i*3]   = Math.cos(a) * s;
      vel[i*3+1] = Math.sin(a) * s;
      vel[i*3+2] = (Math.random() - 0.5) * s * 0.35;
    }
    return { pos, vel, lineBuf: new Float32Array(N * N * 6) };
  }, []);

  useFrame(({ clock }) => {
    for (let i = 0; i < N; i++) {
      const b = i * 3;
      pos[b]   += vel[b];   if (Math.abs(pos[b])   > BOUNDS)        vel[b]   *= -1;
      pos[b+1] += vel[b+1]; if (Math.abs(pos[b+1]) > BOUNDS)        vel[b+1] *= -1;
      pos[b+2] += vel[b+2]; if (Math.abs(pos[b+2]) > BOUNDS * 0.55) vel[b+2] *= -1;
    }
    if (coreRef.current)
      coreRef.current.geometry.attributes.position.needsUpdate = true;

    let seg = 0;
    const ld2 = LINK * LINK;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1], dz = pos[i*3+2]-pos[j*3+2];
        if (dx*dx + dy*dy + dz*dz < ld2) {
          lineBuf[seg*6]   = pos[i*3];   lineBuf[seg*6+1] = pos[i*3+1]; lineBuf[seg*6+2] = pos[i*3+2];
          lineBuf[seg*6+3] = pos[j*3];   lineBuf[seg*6+4] = pos[j*3+1]; lineBuf[seg*6+5] = pos[j*3+2];
          seg++;
        }
      }
    }
    if (linesRef.current) {
      linesRef.current.geometry.setDrawRange(0, seg * 2);
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.035;
      groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.022) * 0.12;
    }
  });

  const dotColor   = isDark ? '#a5b4fc' : '#6d28d9';
  const lineColor  = isDark ? '#7c3aed' : '#7c3aed';
  const dotOpacity  = isDark ? 0.75 : 0.55;
  const lineOpacity = isDark ? 0.20 : 0.10;

  return (
    <group ref={groupRef}>
      <points ref={coreRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={N} array={pos} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.10} sizeAttenuation color={dotColor} transparent opacity={dotOpacity} />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={N * N * 2} array={lineBuf} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color={lineColor} transparent opacity={lineOpacity} />
      </lineSegments>
    </group>
  );
}

const METRIC_STYLES = {
  1: { icon: TrendingUp, color: 'text-white', bg: 'bg-white/10' },
  2: { icon: Flame, color: 'text-white', bg: 'bg-white/10' },
  3: { icon: CheckCircle2, color: 'text-white', bg: 'bg-white/10' },
  4: { icon: Rocket, color: 'text-white', bg: 'bg-white/10' },
};

const FALLBACK_PROFILE = { name: 'Admin User', email: 'admin@fyintech.com', avatar: null };
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const SidebarItem = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      isActive
        ? 'bg-white/10 text-white shadow-lg shadow-white/5 border border-white/10'
        : 'text-crm-textMuted hover:bg-crm-border/50 hover:text-white'
    }`}
  >
    <Icon size={20} className={isActive ? 'text-white' : 'text-crm-textMuted group-hover:text-white transition-colors'} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const MobileNavItem = ({ icon: Icon, label, active, onClick, danger = false }) => (
  <button
    onClick={onClick}
    className={`min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-xl transition-all ${
      danger
        ? 'text-red-400 hover:bg-red-500/10'
        : active
          ? 'bg-white/20 text-white'
          : 'text-crm-textMuted hover:bg-white/10 hover:text-white'
    }`}
  >
    <Icon size={19} />
    <span className="w-full truncate text-center text-[9px] font-semibold leading-tight">{label}</span>
  </button>
);

export default function DashboardShell() {
  const [activeTab, setActiveTab] = React.useState('Dashboard');
  const [leads, setLeads] = React.useState([]);
  const [metrics, setMetrics] = React.useState([]);
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMsg, setLoadingMsg] = React.useState('Loading...');
  const [loadError, setLoadError] = React.useState(false);
  const [profile, setProfile] = React.useState(() => getStoredProfile() || FALLBACK_PROFILE);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showIosTip, setShowIosTip] = React.useState(false);
  const navigate = useNavigate();

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Ping backend every 8 min to prevent Render free tier from sleeping
  React.useEffect(() => {
    const ping = () => fetch(`${API_BASE}/api/health`).catch(() => {});
    const id = setInterval(ping, 8 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const syncTheme = () => {
      try {
        const prefs = JSON.parse(localStorage.getItem('crm_prefs') || '{}');
        applyTheme(prefs.darkMode !== false);
      } catch (_) {}
    };
    syncTheme();
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  React.useEffect(() => {
    if (isIos && !isStandalone) {
      const dismissed = localStorage.getItem('crm_ios_tip_dismissed');
      if (!dismissed) setShowIosTip(true);
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isIos, isStandalone]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const refreshProfile = React.useCallback(async () => {
    try {
      const data = await apiJson('/api/auth/me', {}, { timeoutMs: 20000 });
      const nextProfile = {
        name: data.name,
        email: data.email,
        avatar: data.avatar || null,
      };
      setProfile(nextProfile);
      setStoredProfile(nextProfile);
    } catch (error) {
      if (error.status === 401) {
        clearAuthSession();
        navigate('/login', { replace: true });
      }
    }
  }, [navigate]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setLoadingMsg('Loading...');

    const wakingTimer = setTimeout(() => setLoadingMsg('Waking server from sleep...'), 4000);
    const slowTimer = setTimeout(() => setLoadingMsg('Almost there - server is starting up...'), 15000);

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const [leadsData, metricsData, projectsData] = await Promise.all([
            apiJson('/api/leads?limit=500', {}, { timeoutMs: 30000 }),
            apiJson('/api/metrics', {}, { timeoutMs: 30000 }),
            apiJson('/api/projects', {}, { timeoutMs: 30000 }),
          ]);

          setLeads(Array.isArray(leadsData) ? leadsData : []);
          setMetrics((Array.isArray(metricsData) ? metricsData : []).map(m => ({ ...m, ...METRIC_STYLES[m.id] })));
          setProjects(Array.isArray(projectsData) ? projectsData : []);
          setLoadError(false);
          return;
        } catch (error) {
          console.error('Error fetching data:', error);
          if (error.status === 401) {
            clearAuthSession();
            navigate('/login', { replace: true });
            return;
          }
          if (attempt === 2) throw error;
          setLoadingMsg(`Connection failed - retrying in 8 seconds (attempt ${attempt + 1}/3)`);
          await sleep(8000);
          setLoadingMsg('Retrying connection...');
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      clearTimeout(wakingTimer);
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadingMsg('Loading...');
    }
  }, [navigate]);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        refreshProfile();
        fetchData();
      }
    });
    return () => { cancelled = true; };
  }, [fetchData, refreshProfile]);

  // Delta-based optimistic metric update — avoids recomputing from the
  // paginated local leads list, which misses any leads beyond the first 200.
  const adjustProposalCount = React.useCallback((oldStatus, newStatus) => {
    if (oldStatus === newStatus) return;
    const delta = newStatus === 'Proposal Sent' ? 1 : oldStatus === 'Proposal Sent' ? -1 : 0;
    if (delta === 0) return;
    setMetrics(prev => prev.map(m =>
      m.id === 3
        ? { ...m, value: String(Math.max(0, parseInt(m.value || '0', 10) + delta)) }
        : m
    ));
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    const previousLeads = leads;
    const previousMetrics = metrics;
    const lead = leads.find(l => l.id === leadId);
    const updatedLeads = leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l);

    setLeads(updatedLeads);
    adjustProposalCount(lead?.status, newStatus); // instant metric update

    try {
      await apiJson(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      const metricsData = await apiJson('/api/metrics');
      setMetrics(metricsData.map(m => ({ ...m, ...METRIC_STYLES[m.id] })));
      if (lead) {
        toast.success(`${lead.company} moved to ${newStatus}`);
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
      setLeads(previousLeads);
      setMetrics(previousMetrics);
      toast.error('Failed to update lead status');
    }
  };

  const handleProfileChange = React.useCallback((nextProfile) => {
    setProfile(nextProfile);
    setStoredProfile(nextProfile);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    localStorage.removeItem('crm_ios_tip_dismissed');
    localStorage.removeItem('crm_last_seen_max_id');
    localStorage.removeItem('crm_prefs');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-crm-darker overflow-hidden text-crm-text font-sans relative animate-in fade-in duration-500">

      {/* ── Persistent neural-network background (all tabs) ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 14], fov: 50 }}
          gl={{ alpha: true, antialias: false }}
          onCreated={({ gl }) => gl.setClearColor(0, 0, 0, 0)}
        >
          <ambientLight intensity={1} />
          <NeuralNet />
        </Canvas>
      </div>

      <aside className="relative z-10 w-64 glass-panel-heavy flex-col hidden md:flex m-4 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-6">
          <div className="flex justify-center mb-2">
            <img src="/logo.png" alt="FY INTECH" className="h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
          <SidebarItem icon={Rocket} label="Active Projects" isActive={activeTab === 'Active Projects'} onClick={() => setActiveTab('Active Projects')} />
          <SidebarItem icon={Radar} label="Lead Radar" isActive={activeTab === 'Lead Radar'} onClick={() => setActiveTab('Lead Radar')} />
          <SidebarItem icon={KanbanSquare} label="Pipeline" isActive={activeTab === 'Pipeline'} onClick={() => setActiveTab('Pipeline')} />
          <SidebarItem icon={Volume2} label="AI Avatar" isActive={activeTab === 'AI Avatar'} onClick={() => setActiveTab('AI Avatar')} />
          <SidebarItem icon={Settings} label="Settings" isActive={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} />
        </nav>

        <div className="p-4 mt-auto">
          <div className="glass-panel rounded-2xl p-4 flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-crm-border/30 flex items-center justify-center shrink-0">
                {profile.avatar
                  ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <User size={18} className="text-crm-textMuted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile.name}</p>
                <p className="text-xs text-crm-textMuted truncate">{profile.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20 text-sm font-semibold group"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>Secure Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
        {showIosTip && (
          <div className="mx-3 md:mx-4 mt-3 md:mt-4 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Share2 size={18} className="text-blue-400 shrink-0" />
              <p className="text-xs text-blue-200 leading-relaxed">
                <span className="font-bold">Install this app:</span> Tap <span className="font-bold text-white">Share</span> {' '}
                <span className="inline-block align-middle"><Share2 size={10} /></span> then {`"Add to Home Screen"`}
              </p>
            </div>
            <button
              onClick={() => { setShowIosTip(false); localStorage.setItem('crm_ios_tip_dismissed', '1'); }}
              className="p-1.5 text-blue-400 hover:text-white transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <header className="h-16 md:h-20 glass-panel-heavy m-3 md:m-4 md:ml-0 rounded-2xl md:rounded-3xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="FY INTECH" className="h-7 w-auto md:hidden drop-shadow-md shrink-0" />
            <h2 className="text-base md:text-2xl font-bold text-white tracking-tight truncate">{activeTab}</h2>
          </div>

          <div className="flex items-center space-x-4 md:space-x-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-textMuted" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search targets..."
                className="w-64 bg-black/40 border border-crm-border/50 text-sm rounded-full py-2 pl-10 pr-4 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-md"
              />
            </div>

            <button className="relative p-2 text-crm-textMuted hover:text-white transition-colors rounded-full hover:bg-white/10">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]"></span>
            </button>

            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="p-2 text-crm-textMuted hover:text-white transition-colors rounded-full hover:bg-white/10 flex items-center gap-1.5 text-xs font-semibold"
                title="Install app"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 md:p-8 pt-2 md:pt-4">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="text-crm-textMuted text-sm animate-pulse">{loadingMsg}</p>
              {loadingMsg.includes('Waking') && (
                <p className="text-crm-textMuted text-xs opacity-60 text-center max-w-xs">
                  The server sleeps after inactivity. First load may take up to 60 seconds.
                </p>
              )}
            </div>
          ) : loadError ? (
            <div className="h-full flex flex-col items-center justify-center gap-5 text-center">
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <ServerCrash size={40} className="text-red-400 mx-auto mb-3" />
                <h3 className="text-white font-bold text-lg mb-1">Server Unreachable</h3>
                <p className="text-crm-textMuted text-sm mb-4">
                  Could not connect after 3 attempts.<br />The backend may be restarting.
                </p>
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 text-sm font-semibold"
              >
                <Download size={16} />
                <span>Install App</span>
              </button>
            )}

            <button
                  onClick={fetchData}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'Dashboard' && <DashboardTab metrics={metrics} leads={leads} setActiveTab={setActiveTab} projects={projects} />}
              {activeTab === 'Active Projects' && <ProjectsTab />}
              {activeTab === 'Lead Radar' && <LeadRadarTab leads={leads} updateLeadStatus={updateLeadStatus} searchQuery={searchQuery} onSearchChange={setSearchQuery} onRefresh={fetchData} />}
              {activeTab === 'Pipeline' && <PipelineTab leads={leads} updateLeadStatus={updateLeadStatus} />}
              {activeTab === 'AI Avatar' && <AvatarTab />}
              {activeTab === 'Settings' && <SettingsTab onProfileChange={handleProfileChange} />}
            </>
          )}
        </div>
      </main>

      <nav className="md:hidden glass-panel-heavy grid grid-cols-6 gap-1 py-2 px-2 shrink-0 z-20 m-3 mt-0 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <MobileNavItem icon={LayoutDashboard} label="Home" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
        <MobileNavItem icon={Rocket} label="Projects" active={activeTab === 'Active Projects'} onClick={() => setActiveTab('Active Projects')} />
        <MobileNavItem icon={Radar} label="Leads" active={activeTab === 'Lead Radar'} onClick={() => setActiveTab('Lead Radar')} />
        <MobileNavItem icon={KanbanSquare} label="Pipeline" active={activeTab === 'Pipeline'} onClick={() => setActiveTab('Pipeline')} />
        <MobileNavItem icon={Volume2} label="Avatar" active={activeTab === 'AI Avatar'} onClick={() => setActiveTab('AI Avatar')} />
        <MobileNavItem icon={Settings} label="Settings" active={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} />
        <MobileNavItem icon={LogOut} label="Logout" danger onClick={handleLogout} />
      </nav>
    </div>
  );
}
