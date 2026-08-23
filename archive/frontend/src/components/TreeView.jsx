import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';

function TreeNode({ node, level = 0, onSelect }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-800/50 rounded cursor-pointer transition-colors"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => hasChildren ? setExpanded(!expanded) : onSelect?.(node)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
        ) : <span className="w-4" />}
        
        {hasChildren ? (
          <Folder className="w-4 h-4 text-indigo-400" />
        ) : (
          <FileText className="w-4 h-4 text-emerald-400" />
        )}
        
        <span className={`text-sm ${hasChildren ? 'text-slate-300 font-medium' : 'text-slate-400'}`}>
          {node.name}
        </span>
        
        {node.confidence && (
          <span className="text-[10px] text-slate-600 ml-auto">
            {(node.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
      
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({ nodes, onSelect }) {
  const tree = useMemo(() => {
    const root = { name: "Knowledge Root", children: [], id: "root" };
    const pathMap = new Map([["root", root]]);
    
    nodes.forEach(node => {
      const path = node.classification?.path || node.path || ["Uncategorized"];
      let current = root;
      
      path.forEach((segment, idx) => {
        const pathKey = path.slice(0, idx + 1).join("/");
        
        if (!pathMap.has(pathKey)) {
          const newNode = {
            id: pathKey,
            name: segment,
            children: [],
            level: idx
          };
          pathMap.set(pathKey, newNode);
          current.children.push(newNode);
        }
        
        current = pathMap.get(pathKey);
      });
      
      current.children.push({
        id: node.node_id || node.id,
        name: node.title || node.summary?.slice(0, 30) || 'Untitled',
        confidence: node.classification?.confidence || node.confidence,
        leaf: true,
        data: node
      });
    });
    
    return root;
  }, [nodes]);

  return (
    <div className="glass-panel rounded-xl p-4 overflow-auto max-h-[600px]">
      <TreeNode node={tree} onSelect={onSelect} />
    </div>
  );
}
