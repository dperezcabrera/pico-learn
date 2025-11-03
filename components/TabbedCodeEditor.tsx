
import React, { useState, useEffect } from 'react';
import CodeEditor from './CodeEditor';
import GraphVisualizer from './GraphVisualizer';
import { GraphIcon } from './icons';
import { LevelFile } from '../types';

const GRAPH_TAB_ID = '__GRAPH__';

interface TabbedCodeEditorProps {
  files: LevelFile[];
  onFilesChange: (files: LevelFile[]) => void;
  isReadOnly?: boolean;
  graphData?: any;
}

const TabbedCodeEditor: React.FC<TabbedCodeEditorProps> = ({ files, onFilesChange, isReadOnly = false, graphData }) => {
  const [activeTabId, setActiveTabId] = useState<string>(files[0]?.name);

  useEffect(() => {
    // When files change (e.g., new level), reset to the first file if the current tab is invalid
    const fileExists = files.some(f => f.name === activeTabId);
    if (!fileExists && activeTabId !== GRAPH_TAB_ID) {
      setActiveTabId(files[0]?.name);
    }
  }, [files, activeTabId]);

  useEffect(() => {
    // When graph data appears, automatically switch to it
    if (graphData) {
      setActiveTabId(GRAPH_TAB_ID);
    }
  }, [graphData]);


  const handleFileContentChange = (newContent: string) => {
    if (isReadOnly) return;
    const activeFile = files.find(f => f.name === activeTabId);
    if (!activeFile) return;

    const updatedFiles = files.map((file) => 
      file.name === activeTabId ? { ...file, content: newContent } : file
    );
    onFilesChange(updatedFiles);
  };

  const activeFile = files.find(f => f.name === activeTabId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center border-b border-slate-700 bg-slate-800/25">
        {files.map((file) => (
          <button
            key={file.name}
            onClick={() => setActiveTabId(file.name)}
            className={`px-4 py-2 text-sm font-medium border-b-2
              ${activeTabId === file.name
                ? 'text-cyan-400 border-cyan-400 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-white'
              }
            `}
          >
            {file.name}
          </button>
        ))}
        {graphData && (
          <button
            key={GRAPH_TAB_ID}
            onClick={() => setActiveTabId(GRAPH_TAB_ID)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2
              ${activeTabId === GRAPH_TAB_ID
                ? 'text-cyan-400 border-cyan-400 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-white'
              }
            `}
          >
            <GraphIcon />
            Graph
          </button>
        )}
      </div>
      <div className="flex-grow min-h-0">
        {activeTabId === GRAPH_TAB_ID ? (
            <GraphVisualizer data={graphData} />
        ) : activeFile ? (
          <CodeEditor
            value={activeFile.content}
            onChange={handleFileContentChange}
            isReadOnly={isReadOnly}
          />
        ) : (
          <div className="h-full bg-[#0d1117] flex items-center justify-center text-slate-500">
            Select a file to view its content.
          </div>
        )}
      </div>
    </div>
  );
};

export default TabbedCodeEditor;