
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ConsoleOutput from './components/ConsoleOutput';
import LevelNavigator from './components/LevelNavigator';
import InstructionsPanel from './components/InstructionsPanel';
import TabbedCodeEditor from './components/TabbedCodeEditor';
import SettingsModal from './components/SettingsModal';
import SolutionModal from './components/SolutionModal';
import { usePyodide } from './hooks/usePyodide';
import { PlayIcon, SpinnerIcon, TrashIcon, SettingsIcon, ChevronRightIcon, CheckCircleIcon, GraphIcon, ChevronLeftIcon, HomeIcon } from './components/icons';
import { Level, LevelFile, Course } from './types';

export default function App() {
  const { 
    initPyodide,
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
      { name: 'The Philosophy of DI in Python', url: 'course-philosophy.json' },
      { name: 'Learn Pico-IOC', url: 'course-pico-ioc.json' },
      { name: 'Advanced DI Patterns (Coming Soon)', url: '' },
      { name: 'DI in Web Frameworks (Coming Soon)', url: '' },
      { name: 'Async DI with Python (Coming Soon)', url: '' },
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

  const levelType = currentLevel?.type ?? 'lab';
  
  // Lazily initialize Pyodide only when a 'lab' level is accessed.
  useEffect(() => {
    if (levelType === 'lab') {
      initPyodide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelType, initPyodide]);

  useEffect(() => {
    if (currentLevel) {
      setFiles(currentLevel.files.map(f => ({...f})));
      if (isReady) {
        clearOutput();
        if (levelType === 'lab') {
            installPackages(currentLevel.packages);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, isReady]);

  const handleRun = async () => {
    if (!isExecuting && !isInstalling) {
      clearOutput();
      const success = await runCode(files);
      if (success && currentLevel) {
        markLevelAsCompleted(currentLevel.id);
      }
    }
  };
  
  const markLevelAsCompleted = (levelId: number) => {
    setCompletedLevels(prev => {
        const newSet = new Set(prev);
        if (newSet.has(levelId)) return prev; // Avoid unnecessary updates
        newSet.add(levelId);
        localStorage.setItem('completedLevels', JSON.stringify(Array.from(newSet)));
        return newSet;
    });
  };

  const handlePreviousLevel = () => {
    const currentIndex = courseLevels.findIndex(l => l.id === currentLevelId);
    if (currentIndex > 0) {
        setCurrentLevelId(courseLevels[currentIndex - 1].id);
    }
  };
  
  const handleNextLevel = () => {
    // Mark current doc/toc/cover as complete before navigating
    if (currentLevel && (levelType === 'doc' || levelType === 'toc' || levelType === 'cover')) {
        markLevelAsCompleted(currentLevel.id);
    }
    const currentIndex = courseLevels.findIndex(l => l.id === currentLevelId);
    if (currentIndex < courseLevels.length - 1) {
        setCurrentLevelId(courseLevels[currentIndex + 1].id);
    }
  };

  const handleGoToLevel = (levelId: number) => {
    if (courseLevels.find(l => l.id === levelId)) {
      setCurrentLevelId(levelId);
    }
  };
  
  const handleGoToToc = () => {
    const tocLevel = courseLevels.find(l => l.type === 'toc');
    if (tocLevel) {
      setCurrentLevelId(tocLevel.id);
    }
  };

  const isBusy = isPyodideLoading || isInstalling || isExecuting || isCourseLoading;
  
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
  
  const isFirstLevel = currentLevelId === (courseLevels[0]?.id ?? -1);
  const isLastLevel = courseLevels.length > 0 && currentLevelId === courseLevels[courseLevels.length - 1].id;
  
  const renderBody = () => {
    if (!currentLevel) {
      return (
        <div className="lg:col-span-12 flex items-center justify-center h-full text-slate-500 rounded-lg bg-slate-800/50 border border-slate-700">
          {isCourseLoading ? 'Loading course...' : 'No course loaded.'}
        </div>
      );
    }
    
    const navigator = (
        <LevelNavigator 
            currentLevelTitle={levelType === 'toc' ? currentLevel.title : `${currentLevel.id}. ${currentLevel.title}`}
            isCompleted={completedLevels.has(currentLevel.id)}
        />
    );

    switch(levelType) {
      case 'cover':
        return (
          <div className="lg:col-span-12 flex flex-col items-center justify-center text-center h-full bg-slate-800/50 rounded-lg border border-slate-700 p-8">
            <GraphIcon />
            <h1 className="text-5xl font-bold text-white mt-4">{courseTitle}</h1>
            <p className="text-slate-400 mt-2">{currentLevel.description}</p>
          </div>
        );
      case 'toc':
         return (
            <div className="lg:col-span-12 flex flex-col gap-4 min-h-0">
                {navigator}
                <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 p-6 overflow-y-auto">
                    <h2 className="text-3xl font-bold text-white mb-6">{currentLevel.title}</h2>
                    <div className="space-y-3">
                        {courseLevels.filter(l => l.type !== 'cover' && l.type !== 'toc').map(level => (
                            <button 
                                key={level.id}
                                onClick={() => handleGoToLevel(level.id)}
                                className="w-full text-left p-4 rounded-lg hover:bg-slate-700/50 transition-all duration-200 flex items-center justify-between"
                            >
                                <div>
                                    <span className={`text-xs font-bold uppercase ${level.type === 'doc' ? 'text-sky-400' : 'text-amber-400'}`}>{level.type}</span>
                                    <p className="font-semibold text-lg text-slate-100">{level.id}. {level.title}</p>
                                </div>
                                {completedLevels.has(level.id) && (
                                    <span className="text-green-400 flex-shrink-0 ml-4" title="Completed!">
                                        <CheckCircleIcon />
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
      case 'doc':
        return (
          <div className="lg:col-span-12 flex flex-col gap-4 min-h-0">
              {navigator}
              <InstructionsPanel 
                  level={currentLevel}
                  onShowSolution={() => {}} // No-op
                  isDocMode={true}
              />
          </div>
        );
      case 'lab':
      default:
        return (
          <>
            <aside className="lg:col-span-3 flex flex-col gap-4">
              {navigator}
              <InstructionsPanel 
                level={currentLevel}
                onShowSolution={() => setIsSolutionModalOpen(true)} 
              />
            </aside>
            <div className="lg:col-span-9 flex flex-col min-h-0">
                <TabbedCodeEditor files={files} onFilesChange={setFiles} graphData={graphData} />
            </div>
          </>
        );
    }
  };


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
          <button
            onClick={handleGoToToc}
            className="p-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
            aria-label="Table of Contents"
          >
            <HomeIcon />
          </button>
          <h1 className="text-2xl font-bold text-white">
            {renderTitle(courseTitle)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
            {levelType === 'lab' && (
                <button
                    onClick={handleRun}
                    disabled={isBusy}
                    className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white rounded-md shadow-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
                    aria-label="Run code"
                >
                    {isExecuting || isInstalling ? <SpinnerIcon /> : <PlayIcon />}
                    <span>Run</span>
                </button>
            )}
            <button
              onClick={handlePreviousLevel}
              disabled={isFirstLevel || isBusy}
              className="p-2 rounded-md transition-colors duration-200 text-slate-300 hover:bg-slate-700/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous level"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={handleNextLevel}
              disabled={isLastLevel || isBusy}
              className="p-2 rounded-md transition-colors duration-200 text-slate-300 hover:bg-slate-700/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next level"
            >
              <ChevronRightIcon />
            </button>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow min-h-0">
        {renderBody()}
      </main>

      {levelType === 'lab' && (
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
       )}

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
