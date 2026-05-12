import { useState, useCallback, useMemo } from 'react';
import { Radar, MoreVertical, ChevronLeft, ChevronRight, Edit2, Trash2, X, Info, Flame, Target, Rocket, Check, Loader2, AlertTriangle, ArrowUp, ArrowDown, Search } from 'lucide-react';
import ProjectFormModal from './ProjectFormModal';
import { apiJson } from '../utils/api';

const ScoreBadge = ({ score }) => {
  const colorClass = score >= 80
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : score >= 50
      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20';

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass} flex items-center justify-center w-16`}>
      {score}%
    </span>
  );
};

const SORT_FIELDS = ['company', 'industry', 'location', 'status', 'score'];

const SortHeader = ({ label, field, sortField, sortDirection, onClick, className = '' }) => (
  <th
    className={`px-6 py-4 text-xs font-semibold text-crm-textMuted uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none ${className}`}
    onClick={() => onClick(field)}
  >
    <div className="flex items-center gap-1.5">
      {label}
      {sortField === field ? (
        sortDirection === 'asc' ? <ArrowUp size={12} className="text-white" /> : <ArrowDown size={12} className="text-white" />
      ) : (
        <span className="w-3" />
      )}
    </div>
  </th>
);

export default function LeadRadarTab({ leads, updateLeadStatus, searchQuery = '', onSearchChange }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);
  const [promoteTarget, setPromoteTarget] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ problem: '', solution: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [removedIds, setRemovedIds] = useState(new Set());
  const [leadEdits, setLeadEdits] = useState({});
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [localSearch, setLocalSearch] = useState('');
  const itemsPerPage = 50;

  const query = searchQuery || localSearch;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedLeads = useMemo(() => {
    let result = leads.filter(l => !removedIds.has(l.id)).map(l => ({
      ...l,
      ...(leadEdits[l.id] || {}),
    }));

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(l =>
        (l.company || '').toLowerCase().includes(q) ||
        (l.industry || '').toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q)
      );
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = (a[sortField] || '').toString().toLowerCase();
        const bVal = (b[sortField] || '').toString().toLowerCase();
        if (sortField === 'score') {
          return sortDirection === 'asc' ? (a.score || 0) - (b.score || 0) : (b.score || 0) - (a.score || 0);
        }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [leads, removedIds, leadEdits, query, sortField, sortDirection]);

  const openEditDetails = useCallback((lead) => {
    setSelectedLeadDetails(lead);
    setEditForm({ problem: lead.problem || '', solution: lead.solution || '' });
    setEditMode(true);
    setActiveDropdown(null);
  }, []);

  const saveEdit = useCallback(async () => {
    setSavingEdit(true);
    try {
      await apiJson(`/api/leads/${selectedLeadDetails.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: selectedLeadDetails.status,
          problem: editForm.problem,
          solution: editForm.solution,
        }),
      });
    } catch {
    }
    setLeadEdits(prev => ({ ...prev, [selectedLeadDetails.id]: { problem: editForm.problem, solution: editForm.solution } }));
    setSelectedLeadDetails(prev => ({ ...prev, problem: editForm.problem, solution: editForm.solution }));
    setEditMode(false);
    setSavingEdit(false);
  }, [selectedLeadDetails, editForm]);

  const handleRemoveLead = useCallback(async (id) => {
    try {
      await updateLeadStatus(id, 'Closed');
    } catch {
    }
    setRemovedIds(prev => new Set([...prev, id]));
    setSelectedLeadDetails(null);
    setConfirmDeleteId(null);
  }, [updateLeadStatus]);

  const totalPages = Math.ceil(filteredAndSortedLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLeads = filteredAndSortedLeads.slice(startIndex, startIndex + itemsPerPage);

  const toggleDropdown = (id) => {
    if (activeDropdown === id) setActiveDropdown(null);
    else setActiveDropdown(id);
  };

  return (
    <div className="animate-in fade-in duration-500 glass-panel rounded-2xl flex flex-col h-[calc(100vh-140px)]">

      {/* Header */}
      <div className="px-4 md:px-6 py-4 md:py-5 border-b border-crm-border/30 flex flex-wrap items-center justify-between shrink-0 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Radar className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white shadow-sm">Target Directory</h3>
            <p className="text-xs text-crm-textMuted/80">{filteredAndSortedLeads.length} Total Targets Identified</p>
          </div>
        </div>

        <div className="relative md:hidden w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-textMuted" size={16} />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search company, industry, location..."
            className="w-full bg-black/40 border border-crm-border/50 text-sm rounded-xl py-2.5 pl-9 pr-4 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-textMuted hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        {filteredAndSortedLeads.length === 0 && query ? (
          <div className="flex flex-col items-center justify-center h-full text-crm-textMuted gap-2">
            <Search size={32} className="opacity-30" />
            <p className="text-sm">No leads match "{query}"</p>
            <button
              onClick={() => {
                if (onSearchChange) onSearchChange('');
                setLocalSearch('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-crm-darker/60 backdrop-blur-md border-b border-crm-border/50 shadow-sm">
              <tr>
                <SortHeader label="Company Name" field="company" sortField={sortField} sortDirection={sortDirection} onClick={handleSort} />
                <SortHeader label="Industry" field="industry" sortField={sortField} sortDirection={sortDirection} onClick={handleSort} />
                <SortHeader label="Location" field="location" sortField={sortField} sortDirection={sortDirection} onClick={handleSort} />
                <SortHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onClick={handleSort} />
                <SortHeader label="VR Potential" field="score" sortField={sortField} sortDirection={sortDirection} onClick={handleSort} className="text-center" />
                <th className="px-6 py-4 text-xs font-semibold text-crm-textMuted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crm-border/30">
              {currentLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-crm-border/30 transition-colors group">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-crm-border flex items-center justify-center text-xs font-bold text-white">
                        {lead.company.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{lead.company}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-crm-border text-crm-textMuted">
                      {lead.industry}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-crm-textMuted">
                    {lead.location}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      lead.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-400' :
                      lead.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex justify-center">
                      <ScoreBadge score={lead.score} />
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right relative">
                    <button
                      onClick={() => toggleDropdown(lead.id)}
                      className="p-1.5 text-crm-textMuted hover:text-white hover:bg-crm-border rounded-lg transition-colors focus:outline-none"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {activeDropdown === lead.id && (
                      <div className="absolute right-8 top-8 w-48 bg-crm-dark border border-crm-border rounded-xl shadow-xl shadow-black/50 overflow-hidden z-20">
                        <button
                          onClick={() => { setSelectedLeadDetails(lead); setEditMode(false); setActiveDropdown(null); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-crm-textMuted hover:text-white hover:bg-crm-border transition-colors flex items-center border-b border-crm-border/30"
                        >
                          <Info size={14} className="mr-2" /> More Details
                        </button>
                        <button
                          onClick={() => { setPromoteTarget(lead); setActiveDropdown(null); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-violet-400 hover:text-white hover:bg-violet-500/10 transition-colors flex items-center border-b border-crm-border/30"
                        >
                          <Rocket size={14} className="mr-2" /> Promote to Project
                        </button>
                        <button
                          onClick={() => openEditDetails(lead)}
                          className="w-full text-left px-4 py-2.5 text-sm text-crm-textMuted hover:text-white hover:bg-crm-border transition-colors flex items-center border-b border-crm-border/30"
                        >
                          <Edit2 size={14} className="mr-2" /> Edit Details
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(lead.id); setActiveDropdown(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center"
                        >
                          <Trash2 size={14} className="mr-2" /> Remove Lead
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {filteredAndSortedLeads.length > 0 && (
        <div className="px-6 py-4 border-t border-crm-border flex items-center justify-between shrink-0 bg-crm-card rounded-b-2xl">
          <p className="text-sm text-crm-textMuted">
            Showing <span className="font-medium text-white">{Math.min(startIndex + 1, filteredAndSortedLeads.length)}</span> to <span className="font-medium text-white">{Math.min(startIndex + itemsPerPage, filteredAndSortedLeads.length)}</span> of <span className="font-medium text-white">{filteredAndSortedLeads.length}</span> leads
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-crm-border text-crm-textMuted hover:text-white hover:bg-crm-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-sm text-crm-textMuted px-2">
              Page {currentPage} of {Math.max(1, totalPages)}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-crm-border text-crm-textMuted hover:text-white hover:bg-crm-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedLeadDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-crm-card border border-crm-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col scale-in-center">
            <div className="px-6 py-4 border-b border-crm-border/50 flex justify-between items-center bg-crm-darker/50">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{selectedLeadDetails.company}</h2>
                <p className="text-xs text-crm-textMuted uppercase tracking-wider">{selectedLeadDetails.industry} | {selectedLeadDetails.location}</p>
              </div>
              <button
                onClick={() => setSelectedLeadDetails(null)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-crm-textMuted hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
              <div>
                <h3 className="text-red-400 text-sm font-bold uppercase tracking-widest mb-3 flex items-center"><Flame size={16} className="mr-2"/> Core Problem Identified</h3>
                <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-xl shadow-inner">
                  {editMode ? (
                    <textarea
                      rows={4}
                      value={editForm.problem}
                      onChange={e => setEditForm(f => ({ ...f, problem: e.target.value }))}
                      className="w-full bg-crm-darker border border-red-500/20 rounded-xl px-4 py-3 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-red-500/50 text-sm resize-none"
                      placeholder="Describe the core problem..."
                    />
                  ) : (
                    <p className="text-crm-text leading-relaxed text-sm whitespace-pre-wrap">
                      {selectedLeadDetails.problem || "No problem statement generated yet."}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-3 flex items-center"><Target size={16} className="mr-2"/> FY Intech Proposed Solution</h3>
                <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-xl shadow-inner">
                  {editMode ? (
                    <textarea
                      rows={4}
                      value={editForm.solution}
                      onChange={e => setEditForm(f => ({ ...f, solution: e.target.value }))}
                      className="w-full bg-crm-darker border border-blue-500/20 rounded-xl px-4 py-3 text-white placeholder-crm-textMuted focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-sm resize-none"
                      placeholder="Describe the proposed solution..."
                    />
                  ) : (
                    <p className="text-white leading-relaxed text-sm font-medium whitespace-pre-wrap">
                      {selectedLeadDetails.solution || "No proposed solution generated yet."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-crm-border/50 bg-crm-darker/50 flex justify-end gap-3">
              {editMode ? (
                <>
                  <button
                    onClick={() => { setEditMode(false); }}
                    className="px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openEditDetails(selectedLeadDetails)}
                    className="px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Edit2 size={14} />
                    <span>Edit Details</span>
                  </button>
                  <button
                    onClick={() => setSelectedLeadDetails(null)}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                  >
                    Close Insights
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (() => { const target = (leads || []).find(l => l.id === confirmDeleteId); return target ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-crm-card border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-red-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Remove Lead?</h3>
            <p className="text-crm-textMuted text-sm mb-1 font-medium">{target.company}</p>
            <p className="text-crm-textMuted text-xs mb-6">This will mark the lead as Closed and remove it from the directory.</p>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-6 py-2.5 rounded-xl border border-crm-border text-crm-textMuted hover:text-white transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveLead(confirmDeleteId)}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-colors"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      ) : null; })()}

      {promoteTarget && (
        <ProjectFormModal
          prefill={{
            client: promoteTarget.company,
            source_lead_id: promoteTarget.id,
            source_lead_name: promoteTarget.company,
          }}
          onClose={() => setPromoteTarget(null)}
          onSave={() => {}}
        />
      )}

    </div>
  );
}
