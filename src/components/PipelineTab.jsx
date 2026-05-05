import React, { useState } from 'react';
import { KanbanSquare, Plus, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';

const COLUMNS = [
  { id: 'To Approach', title: 'To Approach', color: 'border-slate-500/30 bg-slate-500/5', headerColor: 'text-slate-400' },
  { id: 'Approached', title: 'Approached', color: 'border-blue-500/30 bg-blue-500/5', headerColor: 'text-blue-400' },
  { id: 'Proposal Sent', title: 'Proposal Sent', color: 'border-violet-500/30 bg-violet-500/5', headerColor: 'text-violet-400' }
];

export default function PipelineTab({ leads, updateLeadStatus }) {
  const [draggedLead, setDraggedLead] = useState(null);
  const [limits, setLimits] = useState({});

  const getLimit = (colId) => limits[colId] || 50;
  const loadMore = (colId) => setLimits(prev => ({ ...prev, [colId]: getLimit(colId) + 50 }));

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    // Small timeout to make original card semi-transparent while dragging
    setTimeout(() => {
      if (e.target) e.target.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.classList.remove('opacity-50');
    setDraggedLead(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (draggedLead && draggedLead.status !== targetStatus) {
      // Call the API update function passed from App.jsx
      await updateLeadStatus(draggedLead.id, targetStatus);
    }
  };

  const handleMoveMobile = async (lead, direction) => {
    const currentIndex = COLUMNS.findIndex(c => c.id === lead.status);
    let targetIndex = currentIndex;
    
    if (direction === 'prev' && currentIndex > 0) targetIndex--;
    if (direction === 'next' && currentIndex < COLUMNS.length - 1) targetIndex++;
    
    if (targetIndex !== currentIndex) {
      await updateLeadStatus(lead.id, COLUMNS[targetIndex].id);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <KanbanSquare className="text-indigo-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Outreach Pipeline</h2>
            <p className="text-sm text-crm-textMuted">Track your outbound approach — drag leads from targeting to proposal stage.</p>
          </div>
        </div>
        <button className="flex items-center space-x-2 bg-crm-card border border-crm-border text-white px-4 py-2 rounded-lg hover:bg-crm-border transition-colors">
          <Plus size={16} />
          <span className="text-sm font-medium">Add Stage</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {COLUMNS.map(column => {
          const columnLeads = leads.filter(l => l.status === column.id);
          const limit = getLimit(column.id);
          const displayLeads = columnLeads.slice(0, limit);
          
          return (
            <div 
              key={column.id} 
              className={`flex flex-col rounded-2xl border ${column.color} overflow-hidden`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-4 border-b border-crm-border bg-crm-dark/50 flex items-center justify-between">
                <h3 className={`font-semibold ${column.headerColor}`}>{column.title}</h3>
                <span className="bg-crm-border text-white text-xs font-bold px-2 py-1 rounded-full">
                  {columnLeads.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {displayLeads.map(lead => (
                  <div 
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    className="bg-crm-card border border-crm-border p-4 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{lead.company}</h4>
                      <GripVertical size={14} className="text-crm-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs font-medium text-crm-textMuted bg-crm-dark px-2 py-1 rounded-md border border-crm-border">
                        {lead.industry}
                      </span>
                      <span className={`text-xs font-bold ${lead.score >= 80 ? 'text-emerald-400' : lead.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {lead.score}% VR
                      </span>
                    </div>

                    {/* Mobile Move Controls (Hidden on Desktop) */}
                    <div className="flex md:hidden justify-between mt-3 pt-3 border-t border-crm-border/50">
                      <button 
                        onClick={() => handleMoveMobile(lead, 'prev')}
                        disabled={column.id === 'New'}
                        className="p-1.5 rounded bg-white/5 text-crm-textMuted disabled:opacity-30 hover:text-white"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-[10px] uppercase tracking-wider text-crm-textMuted flex items-center">Move Stage</span>
                      <button 
                        onClick={() => handleMoveMobile(lead, 'next')}
                        disabled={column.id === 'Closed'}
                        className="p-1.5 rounded bg-white/5 text-crm-textMuted disabled:opacity-30 hover:text-white"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {columnLeads.length > limit && (
                  <button 
                    onClick={() => loadMore(column.id)}
                    className="w-full text-center py-4 text-xs text-crm-textMuted hover:text-white font-medium bg-white/5 hover:bg-white/10 transition-colors rounded-xl border border-white/5 cursor-pointer"
                  >
                    Load 50 more ( {columnLeads.length - limit} remaining )
                  </button>
                )}

                {columnLeads.length === 0 && (
                  <div className="h-24 flex items-center justify-center border-2 border-dashed border-crm-border rounded-xl">
                    <p className="text-sm text-crm-textMuted">Drop leads here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
