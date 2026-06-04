import { useState } from 'react';
import { X, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import { sendCrmNotification } from '../utils/notify';
import { apiJson } from '../utils/api';

const STAGES = ['POC Complete', 'Awaiting Feedback', 'In Development', 'Presented', 'Deployed', 'On Hold'];
const SERVICES = ['VR', 'AR', 'MR', 'XR'];

export default function ProjectFormModal({ onClose, onSave, prefill = {}, existingProject = null }) {
  const isEdit = !!existingProject;
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    client: existingProject?.client || prefill.client || '',
    project_name: existingProject?.project_name || prefill.project_name || '',
    service_type: existingProject?.service_type || prefill.service_type || 'VR',
    stage: existingProject?.stage || prefill.stage || 'POC Complete',
    description: existingProject?.description || prefill.description || '',
    next_action: existingProject?.next_action || prefill.next_action || '',
    start_date: existingProject?.start_date || today,
    last_update: existingProject?.last_update || today,
    source_lead_id: existingProject?.source_lead_id || prefill.source_lead_id || null,
    source_lead_name: existingProject?.source_lead_name || prefill.source_lead_name || null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.client.trim() || !form.project_name.trim() || !form.description.trim() || !form.next_action.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/projects/${existingProject.id}` : '/api/projects';
      const method = isEdit ? 'PUT' : 'POST';
      const savedProject = await apiJson(url, {
        method,
        body: JSON.stringify(form),
      });
      // 🔔 Notify
      if (isEdit) {
        sendCrmNotification(
          `Project Updated: ${savedProject.client}`,
          `The project "${savedProject.project_name}" for ${savedProject.client} has been updated.\n\nCurrent Stage: ${savedProject.stage}\n\nNext Action:\n${savedProject.next_action}`
        );
      } else {
        sendCrmNotification(
          `New Project Launched: ${savedProject.client}`,
          `A new active project has been created in the FY Intech CRM.\n\nClient: ${savedProject.client}\nProject: ${savedProject.project_name}\nService: ${savedProject.service_type}\nStage: ${savedProject.stage}\n\nNext Action:\n${savedProject.next_action}`
        );
      }
      onSave(savedProject);
      onClose();
    } catch {
      setError('Failed to save project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25 }}
        className="bg-crm-card border border-crm-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-crm-border/50 bg-crm-darker/60 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Rocket size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEdit ? `Edit: ${existingProject.client}` : prefill.client ? `Promote ${prefill.client}` : 'New Active Project'}
              </h2>
              {prefill.source_lead_name && !isEdit && (
                <p className="text-xs text-crm-textMuted">Converting from Lead Radar: <span className="text-violet-400 font-semibold">{prefill.source_lead_name}</span></p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-crm-textMuted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>}

          {/* Client */}
          <div>
            <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Client Name *</label>
            <input
              type="text"
              value={form.client}
              onChange={e => set('client', e.target.value)}
              placeholder="e.g. Majlis Bandaraya Johor Bahru"
              className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm"
            />
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Project Name *</label>
            <input
              type="text"
              value={form.project_name}
              onChange={e => set('project_name', e.target.value)}
              placeholder="e.g. VR Urban Planning POC"
              className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm"
            />
          </div>

          {/* Service Type + Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Service Type</label>
              <select
                value={form.service_type}
                onChange={e => set('service_type', e.target.value)}
                className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm"
              >
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Current Stage</label>
              <select
                value={form.stage}
                onChange={e => set('stage', e.target.value)}
                className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm"
              >
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Project Description *</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What is FY Intech building for this client? What was demonstrated in the POC?"
              className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm resize-none"
            />
          </div>

          {/* Next Action */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">⚡ Next Action Required *</label>
            <textarea
              rows={3}
              value={form.next_action}
              onChange={e => set('next_action', e.target.value)}
              placeholder="What needs to happen next to move this project forward?"
              className="w-full bg-crm-darker border border-amber-500/20 rounded-xl px-4 py-3 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-sm resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-2">Last Update</label>
              <input
                type="date"
                value={form.last_update}
                onChange={e => set('last_update', e.target.value)}
                className="w-full bg-crm-darker border border-crm-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-sm [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-crm-border/50 bg-crm-darker/60 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-crm-border text-crm-textMuted hover:text-white hover:bg-white/5 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-sm transition-colors shadow-[0_0_15px_rgba(139,92,246,0.4)] disabled:opacity-50 flex items-center space-x-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Rocket size={15} />
            )}
            <span>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Launch Project'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
