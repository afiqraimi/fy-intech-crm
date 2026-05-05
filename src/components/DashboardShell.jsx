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
  Rocket
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
  const [profile, setProfile] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_profile')) || { name: 'Admin User', email: 'admin@fyintech.com', avatar: null }; }
    catch { return { name: 'Admin User', email: 'admin@fyintech.com', avatar: null }; }
  });
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [leadsRes, metricsRes, projectsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/leads`),
          fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/metrics`),
          fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/projects`)
        ]);
        const leadsData = await leadsRes.json();
        const metricsData = await metricsRes.json();
        const projectsData = await projectsRes.json();
        
        setLeads(leadsData);
        setMetrics(metricsData.map(m => ({ ...m, ...METRIC_STYLES[m.id] })));
        setProjects(projectsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    // Optimistic UI Update: Instantly update the UI so there is NO lag
    const lead = leads.find(l => l.id === leadId);
    setLeads(currentLeads => 
      currentLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
    );

    try {
      // Perform the database update in the background
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        // 🔔 Notify when a lead reaches Proposal Sent
        if (newStatus === 'Proposal Sent' && lead) {
          sendCrmNotification(
            `Proposal Sent: ${lead.company}`,
            `A proposal has been sent to ${lead.company} (${lead.industry} — ${lead.location}).\n\nThis lead has been moved to "Proposal Sent" in the Outreach Pipeline.\n\nLog in to FY Intech CRM to track the next steps.`
          );
        }
        // Fetch new metrics in the background
        const metricsRes = await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/metrics`);
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.map(m => ({ ...m, ...METRIC_STYLES[m.id] })));
      }
    } catch (error) {
      console.error("Error updating lead status:", error);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-transparent overflow-hidden text-crm-text font-sans relative z-10 animate-in fade-in duration-500">
      {/* Sidebar */}
      <aside className="w-64 glass-panel-heavy flex flex-col hidden md:flex m-4 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
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
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 glass-panel-heavy m-4 ml-0 rounded-3xl flex items-center justify-between px-8 sticky top-0 z-10 shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-white tracking-tight">{activeTab}</h2>
          </div>
          
          <div className="flex items-center space-x-6">
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
        <div className="flex-1 overflow-auto p-8 pt-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden glass-panel-heavy flex justify-around items-center p-3 shrink-0 z-20 m-4 mt-0 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <button onClick={() => setActiveTab('Dashboard')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'Dashboard' ? 'bg-white/20 text-white shadow-lg shadow-white/10' : 'text-crm-textMuted hover:text-white'}`}>
          <LayoutDashboard size={22} />
        </button>
        <button onClick={() => setActiveTab('Active Projects')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'Active Projects' ? 'bg-white/20 text-white shadow-lg shadow-white/10' : 'text-crm-textMuted hover:text-white'}`}>
          <Rocket size={22} />
        </button>
        <button onClick={() => setActiveTab('Lead Radar')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'Lead Radar' ? 'bg-white/20 text-white shadow-lg shadow-white/10' : 'text-crm-textMuted hover:text-white'}`}>
          <Radar size={22} />
        </button>
        <button onClick={() => setActiveTab('Pipeline')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'Pipeline' ? 'bg-white/20 text-white shadow-lg shadow-white/10' : 'text-crm-textMuted hover:text-white'}`}>
          <KanbanSquare size={22} />
        </button>
        <div className="w-px h-8 bg-white/10 mx-1"></div>
        <button onClick={handleLogout} className="p-2.5 rounded-xl transition-all text-red-400 hover:bg-red-500/10">
          <LogOut size={22} />
        </button>
      </nav>
    </div>
  );
}
