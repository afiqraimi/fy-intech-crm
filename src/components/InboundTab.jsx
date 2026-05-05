import React, { useState, useEffect } from 'react';
import { Inbox, Check, X, Clock, DollarSign, Mail, User, Building, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InboundTab() {
  const [inbounds, setInbounds] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbounds();
  }, []);

  const fetchInbounds = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/inbound`);
      const data = await res.json();
      setInbounds(data);
      if (data.length > 0 && !selectedLead) {
        setSelectedLead(data[0]);
      }
    } catch (error) {
      console.error("Error fetching inbound leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    // Optimistic UI update
    setInbounds(prev => prev.map(lead => lead.id === id ? { ...lead, status: newStatus } : lead));
    if (selectedLead && selectedLead.id === id) {
      setSelectedLead({ ...selectedLead, status: newStatus });
    }

    try {
      await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/inbound/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (error) {
      console.error("Error updating inbound status:", error);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      
      {/* Left List Pane */}
      <div className="w-full md:w-1/3 flex flex-col glass-panel rounded-2xl overflow-hidden border border-crm-border/50">
        <div className="p-5 border-b border-crm-border/50 bg-crm-darker/30 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Inbox className="text-purple-400" size={20} />
            </div>
            <h3 className="font-bold text-white tracking-wide">Inbound Terminal</h3>
          </div>
          <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-2.5 py-1 rounded-full">
            {inbounds.filter(l => l.status === 'New').length} New
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {inbounds.map(lead => (
            <button 
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className={`w-full text-left p-4 rounded-xl transition-all duration-200 border ${
                selectedLead?.id === lead.id 
                  ? 'bg-white/10 border-white/20 shadow-lg' 
                  : 'bg-crm-card border-crm-border hover:bg-crm-border/50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-white text-sm truncate pr-2">{lead.company}</span>
                {lead.status === 'New' && <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1"></span>}
                {lead.status === 'Reviewed' && <Check size={14} className="text-emerald-400 shrink-0" />}
                {lead.status === 'Archived' && <X size={14} className="text-red-400 shrink-0" />}
              </div>
              <p className="text-xs text-crm-textMuted truncate mb-3">{lead.requested_service}</p>
              <div className="flex items-center justify-between text-[10px] text-crm-textMuted uppercase tracking-wider font-semibold">
                <span>{lead.created_at.split(' ')[0]}</span>
                <span className="bg-crm-dark px-2 py-0.5 rounded border border-crm-border">{lead.budget}</span>
              </div>
            </button>
          ))}
          {inbounds.length === 0 && (
            <div className="p-8 text-center text-crm-textMuted text-sm">No inbound requests found.</div>
          )}
        </div>
      </div>

      {/* Right Detail Pane */}
      <div className="w-full md:w-2/3 glass-panel-heavy rounded-2xl border border-white/5 flex flex-col relative overflow-hidden shadow-2xl">
        <AnimatePresence mode="wait">
          {selectedLead ? (
            <motion.div 
              key={selectedLead.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              {/* Detail Header */}
              <div className="p-8 border-b border-crm-border/50 bg-gradient-to-br from-crm-darker to-transparent relative">
                {selectedLead.status === 'Archived' && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
                )}
                {selectedLead.status === 'Reviewed' && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50"></div>
                )}
                {selectedLead.status === 'New' && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-purple-500/50"></div>
                )}
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-black text-white mb-2">{selectedLead.company}</h2>
                    <div className="flex items-center space-x-4 text-sm font-medium text-crm-textMuted">
                      <span className="flex items-center"><User size={14} className="mr-1.5" /> {selectedLead.contact_name}</span>
                      <span className="flex items-center"><Mail size={14} className="mr-1.5" /> {selectedLead.email}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg border ${
                    selectedLead.status === 'New' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    selectedLead.status === 'Reviewed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {selectedLead.status}
                  </span>
                </div>
                
                <div className="flex gap-4">
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex-1 backdrop-blur-sm">
                    <p className="text-[10px] text-crm-textMuted uppercase tracking-widest mb-1 font-semibold flex items-center">
                      <Building size={12} className="mr-1" /> Requested Service
                    </p>
                    <p className="text-white text-sm font-bold">{selectedLead.requested_service}</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex-1 backdrop-blur-sm">
                    <p className="text-[10px] text-crm-textMuted uppercase tracking-widest mb-1 font-semibold flex items-center">
                      <DollarSign size={12} className="mr-1" /> Budget Range
                    </p>
                    <p className="text-emerald-400 text-sm font-bold">{selectedLead.budget}</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex-1 backdrop-blur-sm">
                    <p className="text-[10px] text-crm-textMuted uppercase tracking-widest mb-1 font-semibold flex items-center">
                      <Clock size={12} className="mr-1" /> Received
                    </p>
                    <p className="text-white text-sm font-bold">{selectedLead.created_at}</p>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="flex-1 p-8 overflow-y-auto">
                <h4 className="text-xs font-bold text-crm-textMuted uppercase tracking-widest mb-4 flex items-center">
                  <AlertCircle size={14} className="mr-2" /> Original Inquiry Message
                </h4>
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                  <p className="text-white/90 leading-loose whitespace-pre-wrap text-sm">
                    {selectedLead.message}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-6 border-t border-crm-border/50 bg-crm-darker/80 backdrop-blur-md flex justify-end space-x-3 shrink-0">
                {selectedLead.status !== 'Archived' && (
                  <button 
                    onClick={() => updateStatus(selectedLead.id, 'Archived')}
                    className="px-6 py-2.5 rounded-xl border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/10 transition-colors"
                  >
                    Reject & Archive
                  </button>
                )}
                {selectedLead.status !== 'Reviewed' && (
                  <button 
                    onClick={() => updateStatus(selectedLead.id, 'Reviewed')}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-colors shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  >
                    Accept to Pipeline
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-crm-textMuted">
              <Inbox size={48} className="mb-4 opacity-20" />
              <p>Select an inbound inquiry to view details.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
