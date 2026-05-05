import React, { useState, useEffect } from 'react';
import { Rocket, ChevronRight, Clock, CalendarDays, Activity, AlertTriangle, CheckCircle, Loader, RefreshCw, X, Edit3, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProjectFormModal from './ProjectFormModal';
import { sendCrmNotification } from '../utils/notify';

const STAGE_CONFIG = {
  'POC Complete':       { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     icon: CheckCircle,   bar: 'bg-blue-500',    pct: 40 },
  'Awaiting Feedback':  { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',  icon: Clock,         bar: 'bg-amber-500',   pct: 55 },
  'In Development':     { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',icon: Loader,        bar: 'bg-purple-500',  pct: 70 },
  'Presented':          { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',     icon: Activity,      bar: 'bg-cyan-500',    pct: 60 },
  'Deployed':           { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle, bar: 'bg-emerald-500', pct: 100 },
  'On Hold':            { color: 'bg-red-500/20 text-red-400 border-red-500/30',        icon: AlertTriangle, bar: 'bg-red-500',     pct: 25 },
};

const SERVICE_COLORS = {
  'VR': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'AR': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'MR': 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  'XR': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
};

const ALL_STAGES = ['POC Complete', 'Awaiting Feedback', 'In Development', 'Presented', 'Deployed', 'On Hold'];

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleNewProject = (newProject) => {
    setProjects(prev => [...prev, newProject]);
    setSelectedProject(newProject);
  };

  const handleEditSave = (updatedProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setSelectedProject(updatedProject);
    setEditingProject(null);
  };

  const handleDelete = async (id) => {
    const project = projects.find(p => p.id === id);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/projects/${id}`, { method: 'DELETE' });
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      setSelectedProject(remaining[0] || null);
      setConfirmDelete(false);
      // 🔔 Notify
      if (project) {
        sendCrmNotification(
          `Project Removed`,
          `The project "${project.project_name}" for ${project.client} has been removed from Active Projects.\n\nIf this was a mistake, please log in and re-add the project manually.`
        );
      }
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/projects`);
      const data = await res.json();
      setProjects(data);
      if (data.length > 0) setSelectedProject(data[0]);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStage = async (id, newStage) => {
    const today = new Date().toISOString().split('T')[0];
    const project = projects.find(p => p.id === id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: newStage, last_update: today } : p));
    if (selectedProject?.id === id) setSelectedProject(prev => ({ ...prev, stage: newStage, last_update: today }));
    setEditingStage(false);

    try {
      await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, last_update: today })
      });
      // 🔔 Notify
      if (project) {
        sendCrmNotification(
          `Project Stage Updated`,
          `The project "${project.project_name}" for ${project.client} has been moved to a new stage.\n\nNew Stage: ${newStage}\nUpdated: ${today}\n\nLog in to your FY Intech CRM to view the full details.`
        );
      }
    } catch (error) {
      console.error("Error updating project stage:", error);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div></div>;
  }

  const stageConf = selectedProject ? (STAGE_CONFIG[selectedProject.stage] || STAGE_CONFIG['POC Complete']) : null;
  const StageIcon = stageConf?.icon;

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">

      {/* Left: Project List */}
      <div className="w-full md:w-72 flex flex-col glass-panel rounded-2xl overflow-hidden border border-white/5 shrink-0">
        <div className="p-5 border-b border-crm-border/50 bg-crm-darker/30 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Rocket className="text-violet-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-wide text-sm">Active Projects</h3>
              <p className="text-[10px] text-crm-textMuted">{projects.length} Ongoing Deployments</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="p-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors"
            title="Add New Project"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {projects.map(project => {
            const conf = STAGE_CONFIG[project.stage] || STAGE_CONFIG['POC Complete'];
            const Icon = conf.icon;
            return (
              <button
                key={project.id}
                onClick={() => { setSelectedProject(project); setEditingStage(false); }}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 border group ${
                  selectedProject?.id === project.id
                    ? 'bg-white/10 border-white/20 shadow-lg'
                    : 'bg-crm-card border-crm-border hover:bg-crm-border/50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white text-xs leading-tight pr-2 line-clamp-2">{project.client}</span>
                  <ChevronRight size={14} className="text-crm-textMuted shrink-0 mt-0.5 group-hover:text-white transition-colors" />
                </div>
                <p className="text-[10px] text-crm-textMuted mb-3 truncate">{project.project_name}</p>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${conf.color}`}>
                    <Icon size={10} />
                    <span>{project.stage}</span>
                  </span>
                  <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded ${SERVICE_COLORS[project.service_type] || 'text-white bg-white/10 border-white/20'}`}>
                    {project.service_type}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="mt-3 h-1 bg-crm-border rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${conf.bar}`} style={{ width: `${conf.pct}%` }}></div>
                </div>
              </button>
            );
          })}

          {projects.length === 0 && (
            <div className="p-8 text-center text-crm-textMuted text-sm">No active projects yet.</div>
          )}
        </div>
      </div>

      {/* Right: Project Detail */}
      <div className="w-full flex-1 glass-panel-heavy rounded-2xl border border-white/5 flex flex-col shadow-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedProject ? (
            <motion.div
              key={selectedProject.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              {/* Top accent bar matching stage color */}
              <div className={`h-1 w-full ${stageConf?.bar || 'bg-white/20'}`} />

              {/* Header */}
              <div className="p-8 border-b border-crm-border/50 bg-gradient-to-br from-crm-darker to-transparent">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
                  <div className="flex-1">
                    <p className="text-xs text-crm-textMuted uppercase tracking-widest mb-2 font-semibold">Active Client</p>
                    <h2 className="text-2xl font-black text-white leading-tight mb-1">{selectedProject.client}</h2>
                    <p className="text-crm-textMuted text-sm font-medium">{selectedProject.project_name}</p>
                    {selectedProject.source_lead_name && (
                      <div className="flex items-center space-x-1.5 mt-2">
                        <ExternalLink size={11} className="text-violet-400" />
                        <p className="text-xs text-violet-400 font-semibold">
                          Promoted from Lead Radar: <span className="underline underline-offset-2">{selectedProject.source_lead_name}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Service badge */}
                    <span className={`font-black text-sm uppercase tracking-wider border-2 px-3 py-1.5 rounded-lg ${SERVICE_COLORS[selectedProject.service_type] || 'text-white bg-white/10 border-white/20'}`}>
                      {selectedProject.service_type}
                    </span>

                    {/* Stage badge / edit button */}
                    <div className="relative">
                      <button
                        onClick={() => setEditingStage(v => !v)}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition-all hover:brightness-125 ${stageConf?.color}`}
                      >
                        <StageIcon size={14} />
                        <span>{selectedProject.stage}</span>
                        <Edit3 size={12} className="opacity-60" />
                      </button>

                      {/* Stage picker dropdown */}
                      <AnimatePresence>
                        {editingStage && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute right-0 top-10 z-30 bg-crm-dark border border-crm-border rounded-xl shadow-2xl overflow-hidden w-48"
                          >
                            <div className="p-2 border-b border-crm-border/50 flex justify-between items-center px-3">
                              <span className="text-[10px] text-crm-textMuted uppercase tracking-wider font-bold">Update Stage</span>
                              <button onClick={() => setEditingStage(false)}><X size={12} className="text-crm-textMuted" /></button>
                            </div>
                            {ALL_STAGES.map(s => {
                              const sc = STAGE_CONFIG[s];
                              const Si = sc.icon;
                              return (
                                <button
                                  key={s}
                                  onClick={() => updateStage(selectedProject.id, s)}
                                  className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center space-x-2 transition-colors hover:bg-white/5 ${selectedProject.stage === s ? 'opacity-40 cursor-default' : ''}`}
                                >
                                  <Si size={14} className={sc.color.split(' ')[1]} />
                                  <span className="text-white">{s}</span>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Meta info row */}
                <div className="flex flex-wrap gap-4">
                  <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 flex items-center space-x-3 backdrop-blur-sm">
                    <CalendarDays size={16} className="text-crm-textMuted shrink-0" />
                    <div>
                      <p className="text-[10px] text-crm-textMuted uppercase tracking-widest font-semibold">Start Date</p>
                      <p className="text-white text-sm font-bold">{selectedProject.start_date}</p>
                    </div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 flex items-center space-x-3 backdrop-blur-sm">
                    <RefreshCw size={16} className="text-crm-textMuted shrink-0" />
                    <div>
                      <p className="text-[10px] text-crm-textMuted uppercase tracking-widest font-semibold">Last Updated</p>
                      <p className="text-white text-sm font-bold">{selectedProject.last_update}</p>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-[10px] text-crm-textMuted uppercase tracking-widest font-semibold mb-2">
                    <span>Project Progress</span>
                    <span>{stageConf?.pct}%</span>
                  </div>
                  <div className="h-2 bg-crm-border/50 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${stageConf?.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${stageConf?.pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div>
                  <h4 className="text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-4 flex items-center">
                    <Activity size={14} className="mr-2" /> Project Overview
                  </h4>
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                    <p className="text-white/90 leading-loose text-sm whitespace-pre-wrap">{selectedProject.description}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4 flex items-center">
                    <AlertTriangle size={14} className="mr-2" /> Next Action Required
                  </h4>
                  <div className="bg-amber-500/5 border border-amber-500/30 p-6 rounded-2xl">
                    <p className="text-white leading-loose text-sm font-medium whitespace-pre-wrap">{selectedProject.next_action}</p>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-8 py-4 border-t border-crm-border/50 bg-crm-darker/80 flex justify-between items-center shrink-0">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold"
                >
                  <Trash2 size={14} />
                  <span>Delete Project</span>
                </button>
                <button
                  onClick={() => setEditingProject(selectedProject)}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors text-sm font-bold"
                >
                  <Edit3 size={14} />
                  <span>Edit Project</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-crm-textMuted">
              <Rocket size={48} className="mb-4 opacity-20" />
              <p>Select a project to view details.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Modal */}
      {editingProject && (
        <ProjectFormModal
          existingProject={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleEditSave}
        />
      )}

      {/* New Project Modal */}
      {showForm && (
        <ProjectFormModal
          onClose={() => setShowForm(false)}
          onSave={handleNewProject}
        />
      )}

      {/* Delete Confirm Dialog */}
      <AnimatePresence>
        {confirmDelete && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-crm-card border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={26} className="text-red-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Delete Project?</h3>
              <p className="text-crm-textMuted text-sm mb-1 font-medium">{selectedProject.client}</p>
              <p className="text-crm-textMuted text-xs mb-6">This will permanently remove the project. The company will remain in Lead Radar.</p>
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-6 py-2.5 rounded-xl border border-crm-border text-crm-textMuted hover:text-white transition-colors text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedProject.id)}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
