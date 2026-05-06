import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Inbox,
  Rocket,
  ServerCrash,
  RefreshCw
} from 'lucide-react';

import DashboardTab from './DashboardTab';
import LeadRadarTab from './LeadRadarTab';
import PipelineTab from './PipelineTab';
import SettingsTab from './SettingsTab';
import InboundTab from './InboundTab';
import ProjectsTab from './ProjectsTab';
import { sendCrmNotification } from '../utils/notify';

const METRIC_STYLES = {
  1: { icon: TrendingUp, color: 'text-white', bg: 'bg-white/10' },
  2: { icon: Flame, color: 'text-white', bg: 'bg-white/10' },
  3: { icon: CheckCircle2, color: 'text-white', bg: 'bg-white/10' },
  4: { icon: Rocket, color: 'text-white', bg: 'bg-white/10' },
};

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

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

export default function DashboardShell() {
  const [activeTab, setActiveTab] = React.useState('Dashboard');
  const [leads, setLeads] = React.useState([]);
  const [metrics, setMetrics] = React.useState([]);
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMsg, setLoadingMsg] = React.useState('Loading…');
  const [loadError, setLoadError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [profile, setProfile] = React.useState(() => {
    try { return JSON.parse(sessionStorage.getItem('crm_profile')) || { name: 'Admin User', email: 'admin@fyintech.com', avatar: null }; }
    catch { return { name: 'Admin User', email: 'admin@fyintech.com', avatar: null }; }
  });
  const navigate = useNavigate();

  const fetchData = async (attempt = 0) => {
    setLoading(true);
    setLoadError(false);

    // Progressive messages to reassure the user during cold start
    const wakingTimer = setTimeout(() => setLoadingMsg('Waking server from sleep…'), 4000);
    const slowTimer = setTimeout(() => setLoadingMsg('Almost there — server is starting up…'), 15000);

    try {
      const [leadsRes, metricsRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE}/api/leads`),
        fetch(`${API_BASE}/api/metrics`),
        fetch(`${API_BASE}/api/projects`),
      ]);
      const leadsData = await leadsRes.json();
      const metricsData = await metricsRes.json();
      const projectsData = await projectsRes.json();

      setLeads(leadsData);
      setMetrics(metricsData.map(m => ({ ...m, ...METRIC_STYLES[m.id] })));
      setProjects(projectsData);
      setLoadError(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (attempt < 2) {
        // Auto-retry after 8 seconds
        setLoadingMsg(`Connection failed — retrying in 8 seconds… (attempt ${attempt + 1}/3)`);
        setTimeout(() => fetchData(attempt + 1), 8000);
        return; // Don't setLoading(false) yet
      } else {
        setLoadError(true);
      }
    } finally {
      clearTimeout(wakingTimer);
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadingMsg('Loading…');
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    const lead = leads.find(l => l.id === leadId);
    setLeads(currentLeads => 
      currentLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
    );

    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        if (newStatus === 'Proposal Sent' && lead) {
          sendCrmNotification(
            `Proposal Sent: ${lead.company}`,
            `A proposal has been sent to ${lead.company} (${lead.industry} — ${lead.location}).\n\nThis lead has been moved to "Proposal Sent" in the Outreach Pipeline.\n\nLog in to FY Intech CRM to track the next steps.`
          );
        }
        const metricsRes = await fetch(`${API_BASE}/api/metrics`);
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.map(m => ({ ...m, ...METRIC_STYLES[m.id] })));
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('crm_profile');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-transparent overflow-hidden text-crm-text font-sans relative z-10 animate-in fade-in duration-500">
      {/* Sidebar — Desktop only */}
      <aside className="w-64 glass-panel-heavy flex-col hidden md:flex m-4 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 glass-panel-heavy m-4 ml-0 md:ml-0 rounded-3xl flex items-center justify-between px-5 md:px-8 sticky top-0 z-10 shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            {/* Show logo on mobile header */}
            <img src="/logo.png" alt="FY INTECH" className="h-7 w-auto md:hidden drop-shadow-md" />
            <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight">{activeTab}</h2>
          </div>
          
          <div className="flex items-center space-x-4 md:space-x-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-textMuted" size={18} />
              <input 
                type="text" 
                placeholder="Search targets..." 
                className="w-64 bg-black/40 border border-crm-border/50 text-sm rounded-full py-2 pl-10 pr-4 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-white/30 transition-all backdrop-blur-md"
              />
            </div>
            
            <button className="relative p-2 text-crm-textMuted hover:text-white transition-colors rounded-full hover:bg-white/10">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pt-4">
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
                <button
                  onClick={() => fetchData()}
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
              {activeTab === 'Lead Radar' && <LeadRadarTab leads={leads} />}
              {activeTab === 'Pipeline' && <PipelineTab leads={leads} updateLeadStatus={updateLeadStatus} />}
              {activeTab === 'Settings' && <SettingsTab onProfileChange={setProfile} />}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation — includes Settings now */}
      <nav className="md:hidden glass-panel-heavy flex justify-around items-center py-2 px-1 shrink-0 z-20 m-4 mt-0 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveTab('Dashboard')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${activeTab === 'Dashboard' ? 'bg-white/20 text-white' : 'text-crm-textMuted'}`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[9px] font-semibold">Home</span>
        </button>
        <button
          onClick={() => setActiveTab('Active Projects')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${activeTab === 'Active Projects' ? 'bg-white/20 text-white' : 'text-crm-textMuted'}`}
        >
          <Rocket size={20} />
          <span className="text-[9px] font-semibold">Projects</span>
        </button>
        <button
          onClick={() => setActiveTab('Lead Radar')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${activeTab === 'Lead Radar' ? 'bg-white/20 text-white' : 'text-crm-textMuted'}`}
        >
          <Radar size={20} />
          <span className="text-[9px] font-semibold">Leads</span>
        </button>
        <button
          onClick={() => setActiveTab('Pipeline')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${activeTab === 'Pipeline' ? 'bg-white/20 text-white' : 'text-crm-textMuted'}`}
        >
          <KanbanSquare size={20} />
          <span className="text-[9px] font-semibold">Pipeline</span>
        </button>
        <button
          onClick={() => setActiveTab('Settings')}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${activeTab === 'Settings' ? 'bg-white/20 text-white' : 'text-crm-textMuted'}`}
        >
          <Settings size={20} />
          <span className="text-[9px] font-semibold">Settings</span>
        </button>
        <div className="w-px h-8 bg-white/10" />
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all text-red-400 hover:bg-red-500/10"
        >
          <LogOut size={20} />
          <span className="text-[9px] font-semibold">Logout</span>
        </button>
      </nav>
    </div>
  );
}
