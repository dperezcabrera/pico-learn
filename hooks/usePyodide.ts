
import { useCallback, useRef, useState } from 'react';
import { LevelFile } from '../types';

type Pending = { resolve: (value: any) => void; reject: (reason: any) => void };

/** Thrown at in-flight work when the worker is torn down on purpose. */
class Discarded extends Error {}

/**
 * Drives Pyodide inside a Web Worker.
 *
 * Two things fall out of that choice. A lesson that loops forever no longer
 * freezes the tab - the worker is terminated and rebuilt. And switching course
 * gets a genuinely empty interpreter: micropip never uninstalls, and
 * pico_boot.init() discovers plugins from the entry points of everything
 * installed, so a package left behind by an earlier course would be booted by
 * a later one.
 */
export const usePyodide = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [graphData, setGraphData] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, Pending>>(new Map());
  const nextIdRef = useRef(1);
  const pinsRef = useRef<Record<string, string> | null>(null);
  const environmentRef = useRef<string | null>(null);
  const bootingRef = useRef<Promise<void> | null>(null);

  const disposeWorker = useCallback((reason: string) => {
    workerRef.current?.terminate();
    workerRef.current = null;
    bootingRef.current = null;
    pendingRef.current.forEach(({ reject }) => reject(new Discarded(reason)));
    pendingRef.current.clear();
    setIsReady(false);
    setIsExecuting(false);
    setIsInstalling(false);
  }, []);

  const spawnWorker = useCallback(() => {
    const worker = new Worker(`${import.meta.env.BASE_URL}pyodide-worker.js`);
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === 'stdout' || data.type === 'stderr') {
        setOutput(prev => prev + data.text);
        return;
      }
      if (data.type === 'graph') {
        try {
          setGraphData(JSON.parse(data.json));
        } catch (e) {
          console.error('Failed to parse graph data', e);
          setOutput(prev => prev + `\n[ERROR] Failed to parse graph data.\n`);
        }
        return;
      }
      const pending = pendingRef.current.get(data.id);
      if (!pending) return;
      pendingRef.current.delete(data.id);
      data.ok ? pending.resolve(data) : pending.reject(new Error(data.error));
    };
    worker.onerror = (event) => {
      console.error('Pyodide worker failed:', event.message);
      setOutput(prev => prev + `\n[ERROR] ${event.message}\n`);
      disposeWorker('worker crashed');
    };
    workerRef.current = worker;
    return worker;
  }, [disposeWorker]);

  const send = useCallback((type: string, payload?: any): Promise<any> => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('interpreter is not running'));
    const id = nextIdRef.current++;
    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  }, []);

  const initPyodide = useCallback(async () => {
    if (workerRef.current || bootingRef.current) return bootingRef.current ?? undefined;
    setIsLoading(true);
    const booting = (async () => {
      try {
        spawnWorker();
        await send('boot');
        setIsReady(true);
      } catch (error: any) {
        // A boot cancelled by a course switch is not a failure.
        if (!(error instanceof Discarded)) {
          console.error('Failed to initialize Pyodide:', error);
          setOutput('Failed to initialize Pyodide. See console for details.');
          disposeWorker('boot failed');
        }
      } finally {
        setIsLoading(false);
        bootingRef.current = null;
      }
    })();
    bootingRef.current = booting;
    return booting;
  }, [disposeWorker, send, spawnWorker]);

  /** Bind the interpreter to one environment (a course); switching throws it away. */
  const setEnvironment = useCallback((key: string) => {
    if (environmentRef.current === key) return;
    environmentRef.current = key;
    disposeWorker('environment changed');
    setOutput('');
    setGraphData(null);
  }, [disposeWorker]);

  /** Kill a run in progress - the only way out of a loop that never ends. */
  const cancelRun = useCallback(() => {
    if (!workerRef.current) return;
    disposeWorker('cancelled');
    setOutput(prev => prev + '\n> Execution stopped.\n');
  }, [disposeWorker]);

  const installPackages = useCallback(async (packages: string[]) => {
    if (!workerRef.current) return;
    setIsInstalling(true);
    try {
      // pins.json freezes the pico-* versions the lessons are validated
      // against (scripts/course-qa.py runs the same pins in CI)
      if (!pinsRef.current) {
        pinsRef.current = await fetch(`${import.meta.env.BASE_URL}pins.json`)
          .then(r => (r.ok ? r.json() : {}))
          .catch(() => ({}));
      }
      const result = await send('install', { packages, pins: pinsRef.current ?? {} });
      if (result.installed?.length) {
        setOutput(prev => prev + `> Installed: ${result.installed.join(', ')}\n`);
      }
    } catch (error: any) {
      if (error instanceof Discarded) return;
      console.error('Failed to install packages:', error);
      setOutput(prev => prev + `\n> Error installing packages: ${error.message}\n`);
    } finally {
      setIsInstalling(false);
    }
  }, [send]);

  const runCode = useCallback(async (files: LevelFile[]): Promise<boolean> => {
    if (!workerRef.current) return false;
    setIsExecuting(true);
    setOutput('> Executing code...\n');
    setGraphData(null);
    try {
      const result = await send('run', { files });
      if (result.detail) setOutput(prev => prev + result.detail);
      return !!result.passed;
    } catch (error: any) {
      // Stop/course switch already told the user what happened.
      if (!(error instanceof Discarded)) {
        setOutput(prev => prev + `\n\n--- PYTHON ERROR ---\n${error.message}`);
      }
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [send]);

  const clearOutput = useCallback(() => {
    setOutput('');
    setGraphData(null);
  }, []);

  return {
    initPyodide,
    setEnvironment,
    cancelRun,
    isLoading,
    isExecuting,
    isInstalling,
    output,
    graphData,
    installPackages,
    runCode,
    clearOutput,
    isReady,
  };
};
