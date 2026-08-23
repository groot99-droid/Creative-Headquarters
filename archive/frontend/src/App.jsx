import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { Brain, Loader, List, Network, GitBranch, RefreshCw } from 'lucide-react';

import { api } from './services/api';
import { WebSocketManager } from './services/websocket';
import { AuthModal } from './components/AuthModal';
import { TreeView } from './components/TreeView';
import { GraphVisualization } from './components/GraphVisualization';
import { SearchBar } from './components/SearchBar';
import { NodeDetail } from './components/NodeDetail';

export default function App() {
  const [authenticated, setAuthenticated] = useState(!!localStorage.getItem('token'));
  const [nodes, setNodes] = useState([]);
  const [view, setView] = useState('tree');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [metrics, setMetrics] = useState({ total: 0, avgConfidence: 0 });

  const ws = useRef(null);

  useEffect(() => {
    if (authenticated) {
      loadNodes();
      // ws.current = new WebSocketManager('ws://localhost:8000/ws');
      // ws.current.connect();
    }
  }, [authenticated]);

  const loadNodes = async () => {
    try {
      const data = await api.getNodes();
      setNodes(data);
      updateMetrics(data);
    } catch (err) {
      toast.error('Failed to load nodes');
    }
  };

  const updateMetrics = (nodeList) => {
    const total = nodeList.length;
    const avgConf = total > 0 
      ? nodeList.reduce((sum, n) => sum + (n.confidence || n.classification?.confidence || 0), 0) / total 
      : 0;
    setMetrics({ total, avgConfidence: avgConf });
  };

  const handleSubmit = useCallback(async () => {
    if (!inputText.trim() || isProcessing) return;
    
    setIsProcessing(true);
    
    const payload = {
      type: 'knowledge_ingestion',
      content: {
        raw_text: inputText,
        timestamp: new Date().toISOString(),
        source: 'manual_input'
      },
      context: {
        session_id: generateSessionId(),
        user_preferences: { auto_link: true, language: 'en' }
      }
    };

    try {
      const response = await api.ingest(payload);
      
      if (response.ok) {
        const newNode = {
          id: response.data.node_id,
          node_id: response.data.node_id,
          ...response.data
        };
        setNodes(prev => [newNode, ...prev]);
        setInputText('');
        toast.success(`Classified: ${response.data.classification.path.join(' > ')}`);
        updateMetrics([newNode, ...nodes]);
      } else {
        toast.error(response.error || 'Processing failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, isProcessing, nodes]);

  const handleSearch = async (query) => {
    if (!query) {
      loadNodes();
      return;
    }
    try {
      const results = await api.search(query);
      setNodes(results);
    } catch (err) {
      toast.error('Search failed');
    }
  };

  if (!authenticated) {
    return <AuthModal onAuth={setAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Living Archive</h1>
              <p className="text-xs text-slate-500">Self-organizing knowledge engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <SearchBar onSearch={handleSearch} />
            
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              <ViewButton active={view === 'tree'} onClick={() => setView('tree')} icon={GitBranch} label="Tree" />
              <ViewButton active={view === 'graph'} onClick={() => setView('graph')} icon={Network} label="Graph" />
              <ViewButton active={view === 'list'} onClick={() => setView('list')} icon={List} label="List" />
            </div>
            
            <button onClick={loadNodes} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
            
            <div className="text-xs text-slate-500 font-mono">
              {metrics.total} nodes • {(metrics.avgConfidence * 100).toFixed(0)}% avg
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* Input Panel */}
        <div className="col-span-4 space-y-4">
          <div className="glass-panel rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              Ingest Knowledge
            </h2>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:border-indigo-500 focus:outline-none transition-colors"
              rows={5}
              placeholder="Enter text to classify and archive..."
              disabled={isProcessing}
            />
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !inputText.trim()}
              className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader className="w-4 h-4 animate-spin" /> : null}
              {isProcessing ? 'Processing...' : 'Process & Archive'}
            </button>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Entities</h3>
            <div className="flex flex-wrap gap-2">
              {nodes.slice(0, 10).flatMap(n => n.extracted_entities || n.entities || []).slice(0, 8).map((e, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded border border-slate-700">
                  {e.text || e}
                </span>
              ))}
              {nodes.length === 0 && <span className="text-xs text-slate-600">No entities yet...</span>}
            </div>
          </div>
        </div>

        {/* Main View */}
        <div className="col-span-8">
          {view === 'tree' && <TreeView nodes={nodes} onSelect={setSelectedNode} />}
          
          {view === 'graph' && (
            <GraphVisualization 
              nodes={nodes} 
              links={[]}
              onNodeClick={setSelectedNode}
            />
          )}
          
          {view === 'list' && (
            <div className="space-y-2">
              {nodes.map(node => (
                <div 
                  key={node.id || node.node_id} 
                  onClick={() => setSelectedNode(node)}
                  className="p-4 glass-panel rounded-lg hover:border-indigo-500/50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">
                        {node.title || node.summary?.slice(0, 50) || 'Untitled'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {(node.classification?.path || node.path || []).join(' > ')}
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 font-mono">
                      {((node.classification?.confidence || node.confidence || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedNode && (
        <NodeDetail 
          node={selectedNode} 
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function ViewButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active 
          ? 'bg-indigo-600 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substr(2, 9);
}
