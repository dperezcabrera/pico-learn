
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ConsoleOutput from './components/ConsoleOutput';
import LevelNavigator from './components/LevelNavigator';
import InstructionsPanel from './components/InstructionsPanel';
import TabbedCodeEditor from './components/TabbedCodeEditor';
import SettingsModal from './components/SettingsModal';
import SolutionModal from './components/SolutionModal';
import { usePyodide } from './hooks/usePyodide';
import { PlayIcon, SpinnerIcon, TrashIcon, SettingsIcon } from './components/icons';
import { Level, LevelFile, Course } from './types';

export default function App() {
  const { 
    isLoading: isPyodideLoading, 
    isExecuting, 
    isInstalling, 
    output,
    graphData,
    installPackages, 
    runCode, 
    clearOutput,
    isReady 
  } = usePyodide();
  
  const [courseLevels, setCourseLevels] = useState<Level[]>([]);
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [isCourseLoading, setIsCourseLoading] = useState(true);
  const [courseLoadingError, setCourseLoadingError] = useState<string | null>(null);
  const [currentLevelId, setCurrentLevelId] = useState(0);
  const [files, setFiles] = useState<LevelFile[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSolutionModalOpen, setIsSolutionModalOpen] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
        const completedRaw = localStorage.getItem('completedLevels');
        if (completedRaw) {
            const completed = JSON.parse(completedRaw);
            if (Array.isArray(completed)) {
                setCompletedLevels(new Set(completed));
            }
        }
    } catch (e) {
        console.error("Failed to parse completed levels from localStorage", e);
    }
  }, []);

  const PRESET_COURSES = [
      { name: 'Pico-IOC Tutorial', url: 'course.json' }
  ];

  const loadCourse = useCallback(async (url: string) => {
    try {
      setIsCourseLoading(true);
      setCourseLoadingError(null);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch course: ${response.status} ${response.statusText}`);
      }
      const data: Course = await response.json();
      if (!data || !data.title || !Array.isArray(data.levels) || data.levels.length === 0) {
          throw new Error("Course data is invalid. Expected an object with 'title' and a non-empty 'levels' array.");
      }
      setCourseLevels(data.levels);
      setCourseTitle(data.title);
      setCurrentLevelId(data.levels[0].id);
      setIsSettingsOpen(false);
    } catch (error: any) {
      console.error("Failed to load course:", error);
      setCourseLoadingError(error.message || "An unknown error occurred.");
      setCourseTitle('Error Loading Course');
    } finally {
      setIsCourseLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourse(PRESET_COURSES[0].url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCourse]);


  const currentLevel = useMemo(() => {
    return courseLevels.find(l => l.id === currentLevelId);
  }, [currentLevelId, courseLevels]);

  useEffect(() => {
    if (currentLevel) {
      setFiles(currentLevel.files.map(f => ({...f})));
      if (isReady) {
        clearOutput();
        installPackages(currentLevel.packages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, isReady]);

  const handleRun = async () => {
    if (!isExecuting && !isInstalling) {
      clearOutput();
      const success = await runCode(files);
      if (success && currentLevel) {
        setCompletedLevels(prev => {
            const newSet = new Set(prev);
            newSet.add(currentLevel.id);
            localStorage.setItem('completedLevels', JSON.stringify(Array.from(newSet)));
            return newSet;
        });
      }
    }
  };
  
  const handlePreviousLevel = () => {
    const currentIndex = courseLevels.findIndex(l => l.id === currentLevelId);
    if (currentIndex > 0) {
        setCurrentLevelId(courseLevels[currentIndex - 1].id);
    }
  };
  
  const handleNextLevel = () => {
    const currentIndex = courseLevels.findIndex(l => l.id === currentLevelId);
    if (currentIndex < courseLevels.length - 1) {
        setCurrentLevelId(courseLevels[currentIndex + 1].id);
    }
  };

  const isBusy = isPyodideLoading || isInstalling || isExecuting || isCourseLoading;
  
  const getButtonState = () => {
    if (isCourseLoading && courseLevels.length === 0) return { text: "Loading Course...", disabled: true, icon: <SpinnerIcon /> };
    if (isPyodideLoading) return { text: "Initializing...", disabled: true, icon: <SpinnerIcon /> };
    if (isInstalling) return { text: "Installing...", disabled: true, icon: <SpinnerIcon /> };
    if (isExecuting) return { text: "Running...", disabled: true, icon: <SpinnerIcon /> };
    return { text: "Run", disabled: false, icon: <PlayIcon /> };
  };
  
  const renderTitle = (title: string) => {
    if (!title) return 'Interactive Runner';
    const match = title.match(/^(.*)\[(.*)\](.*)$/);
    if (match) {
      const [, prefix, highlight, suffix] = match;
      return (
        <>
          {prefix}
          <span className="text-cyan-400">{highlight}</span>
          {suffix}
        </>
      );
    }
    return title;
  };

  const buttonState = getButtonState();
  
  const isFirstLevel = currentLevelId === (courseLevels[0]?.id ?? -1);
  const isLastLevel = courseLevels.length > 0 && currentLevelId === courseLevels[courseLevels.length - 1].id;

  return (
    <div className="flex flex-col h-screen p-4 gap-4 bg-slate-900 font-sans">
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
            aria-label="Course settings"
          >
            <SettingsIcon />
          </button>
          <h1 className="text-2xl font-bold text-white">
            {renderTitle(courseTitle)}
          </h1>
        </div>
        <button
          onClick={handleRun}
          disabled={buttonState.disabled}
          className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md shadow-lg w-48 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {buttonState.icon}
          {buttonState.text}
        </button>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow min-h-0">
        <aside className="lg:col-span-3 flex flex-col gap-4">
          {currentLevel ? (
            <>
              <LevelNavigator 
                currentLevelTitle={`${currentLevel.id}. ${currentLevel.title}`}
                onPrevious={handlePreviousLevel}
                onNext={handleNextLevel}
                isFirstLevel={isFirstLevel}
                isLastLevel={isLastLevel}
                disabled={isBusy}
                isCompleted={completedLevels.has(currentLevel.id)}
              />
              <InstructionsPanel 
                level={currentLevel}
                onShowSolution={() => setIsSolutionModalOpen(true)} 
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 rounded-lg bg-slate-800/50 border border-slate-700">
              {isCourseLoading ? 'Loading course...' : 'No course loaded.'}
            </div>
          )}
        </aside>

        <div className="lg:col-span-9 flex flex-col min-h-0">
            <TabbedCodeEditor files={files} onFilesChange={setFiles} graphData={graphData} />
        </div>
      </main>

      <footer className="flex-shrink-0 h-1/3 max-h-80 lg:h-48">
        <div className="bg-black rounded-lg h-full border border-slate-700 flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 uppercase">Console</h3>
              <button 
                onClick={clearOutput}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                aria-label="Clear console"
              >
                <TrashIcon />
                Clear
              </button>
          </div>
          <div className="flex-grow min-h-0">
            <ConsoleOutput output={output} />
          </div>
        </div>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLoadCourse={loadCourse}
        isLoading={isCourseLoading}
        error={courseLoadingError}
        presets={PRESET_COURSES}
      />
      
      {currentLevel && (
        <SolutionModal
          isOpen={isSolutionModalOpen}
          onClose={() => setIsSolutionModalOpen(false)}
          level={currentLevel}
        />
      )}
    </div>
  );
}