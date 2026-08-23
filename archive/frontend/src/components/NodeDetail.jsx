import React from 'react';
import { X, Link2, Clock, Tag } from 'lucide-react';

export function NodeDetail({ node, onClose, onCreateLink }) {
  const path = node.classification?.path || node.path || [];
  const entities = node.extracted_entities || node.entities || [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Node Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">Classification Path</h3>
            <div className="flex items-center gap-2 text-sm">
              {path.map((p, i) => (
                <React.Fragment key={i}>
                  <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-lg border border-indigo-500/20">
                    {p}
                  </span>
                  {i < path.length - 1 && <span className="text-slate-600">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">Summary</h3>
            <p className="text-slate-200 leading-relaxed">{node.summary}</p>
          </div>

          {entities.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Extracted Entities
              </h3>
              <div className="flex flex-wrap gap-2">
                {entities.map((e, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm border border-slate-700">
                    {e.text || e}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-slate-500 pt-4 border-t border-slate-800">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(node.created_at).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Link2 className="w-4 h-4" />
              {node.node_id || node.id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
