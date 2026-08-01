
import React, { useEffect, useRef, useState } from 'react';
import { SpinnerIcon, XMarkIcon } from './icons';

interface PresetCourse {
  name: string;
  url: string;
  blurb?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCourse: (url: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  presets?: PresetCourse[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onLoadCourse, isLoading, error, presets = [] }) => {
  const [url, setUrl] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native <dialog> gives us the focus trap, Escape and focus restore for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const handleLoadClick = () => {
    if (url.trim()) {
      onLoadCourse(url.trim());
    }
  };

  const handlePresetClick = (presetUrl: string) => {
    setUrl(presetUrl);
    onLoadCourse(presetUrl);
  };

  // A click that lands on the dialog itself is a click on the backdrop.
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={handleBackdropClick}
      aria-labelledby="load-course-title"
      className="w-[min(64rem,92vw)] max-h-[85vh] p-0 bg-slate-800 text-slate-200 rounded-lg shadow-2xl border border-slate-700 backdrop:bg-black/60"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <h2 id="load-course-title" className="text-xl font-bold text-white">Load Course</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XMarkIcon />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label htmlFor="course-url" className="block text-sm font-medium text-slate-300 mb-2">
              Load from URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="course-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/course.json"
                className="flex-grow bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                disabled={isLoading}
              />
              <button
                onClick={handleLoadClick}
                disabled={!url.trim() || isLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-cyan-600 rounded-md shadow-lg w-32 shrink-0 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? <SpinnerIcon /> : 'Load'}
              </button>
            </div>
          </div>

          {presets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Or select a preset course
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => (
                  <li key={preset.name}>
                    <button
                      onClick={() => handlePresetClick(preset.url)}
                      disabled={isLoading || !preset.url}
                      className="flex h-full min-h-[6rem] w-full flex-col gap-1 rounded-md bg-slate-700/50 p-3 text-left hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className={`font-semibold ${!preset.url ? 'text-slate-400' : 'text-cyan-400'}`}>{preset.name}</span>
                      {preset.blurb && (
                        <span className="text-xs text-slate-400">{preset.blurb}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm p-3 rounded-md">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}

        </div>
      </div>
    </dialog>
  );
};

export default SettingsModal;
