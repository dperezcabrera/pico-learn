
import { useState, useEffect, useRef } from 'react';
import { LevelFile } from '../types';

// Pyodide is loaded from a CDN in index.html, so we can expect it on the window object.
declare global {
  interface Window {
    loadPyodide: () => Promise<any>;
  }
}

export const usePyodide = () => {
  const [pyodide, setPyodide] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [output, setOutput] = useState('');
  const [graphData, setGraphData] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  const installedPackagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const initializePyodide = async () => {
      try {
        const pyodideInstance = await window.loadPyodide();
        
        const stdoutCallback = (str: string) => {
            const graphPrefix = '__GRAPH_DATA__:';
            const lines = str.trim().split('\n');
            let consoleOutput = '';
            let detectedGraphJson = null;

            for (const line of lines) {
                if (line.startsWith(graphPrefix)) {
                    detectedGraphJson = line.substring(graphPrefix.length);
                } else if (line.trim()) { // Avoid adding empty lines
                    consoleOutput += line + '\n';
                }
            }
            
            if (consoleOutput) {
                setOutput(prev => prev + consoleOutput);
            }

            if (detectedGraphJson) {
                try {
                    setGraphData(JSON.parse(detectedGraphJson));
                } catch (e) {
                    console.error("Failed to parse graph data", e);
                    setOutput(prev => prev + `\n[ERROR] Failed to parse graph data.\n`);
                }
            }
        };

        pyodideInstance.setStdout({ batched: stdoutCallback });
        pyodideInstance.setStderr({ batched: (str: string) => setOutput(prev => prev + str + '\n') });

        await pyodideInstance.loadPackage('micropip');
        console.log("Pyodide and micropip loaded successfully.");

        setPyodide(pyodideInstance);
      } catch (error) {
        console.error("Failed to initialize Pyodide:", error);
        setOutput("Failed to initialize Pyodide. See console for details.");
      } finally {
        setIsLoading(false);
      }
    };
    initializePyodide();
  }, []);

  const installPackages = async (packages: string[]) => {
    if (!pyodide) return;
    
    const newPackages = packages.filter(p => !installedPackagesRef.current.has(p));
    if (newPackages.length === 0) return;

    setIsInstalling(true);
    setOutput(`Installing packages: ${newPackages.join(', ')}...`);
    
    try {
      const micropip = pyodide.pyimport('micropip');
      await micropip.install(newPackages);
      newPackages.forEach(p => installedPackagesRef.current.add(p));
      setOutput(prev => prev + `\nInstallation complete.`);
    } catch (error) {
      console.error("Failed to install packages:", error);
      setOutput(prev => prev + `\nError installing packages. See console for details.`);
    } finally {
      setIsInstalling(false);
    }
  };

  const runCode = async (files: LevelFile[]): Promise<boolean> => {
    if (!pyodide) return false;
    
    setIsExecuting(true);
    setOutput('Executing code...');
    setGraphData(null); // Clear graph on new run
    
    try {
      const moduleNames = files.map(f => f.name.replace('.py', ''));
      await pyodide.runPythonAsync(`
        import sys
        modules_to_unload = ${JSON.stringify(moduleNames)}
        for module in modules_to_unload:
            if module in sys.modules:
                del sys.modules[module]
      `);

      files.forEach(file => {
        pyodide.FS.writeFile(file.name, file.content);
      });
      
      const testFile = files.find(f => f.name.startsWith('test_'));
      const mainFile = files.find(f => f.name === 'main.py');

      if (testFile) {
        setOutput(prev => prev + `\nRunning tests in ${testFile.name}...`);
        const pytest = pyodide.pyimport('pytest');
        const pytestArgs = pyodide.toPy(['-v', testFile.name]);
        const exitCode = await pytest.main(pytestArgs, null);
        return exitCode === 0;
      } else if (mainFile) {
        setOutput(prev => prev + `\nRunning ${mainFile.name}...\n`);
        const mainContent = pyodide.FS.readFile(mainFile.name, { encoding: 'utf8' });
        await pyodide.runPythonAsync(mainContent);
        return true;
      } else {
        setOutput('No entrypoint found (e.g., main.py or test_*.py)');
        return false;
      }
      
    } catch (error: any) {
      console.error("Error running Python code:", error);
      setOutput(prev => prev + `\n\n--- PYTHON ERROR ---\n${error.message}`);
      return false;
    } finally {
      setIsExecuting(false);
    }
  };
  
  const clearOutput = () => {
    setOutput('');
    setGraphData(null);
  };

  return { 
    isLoading, 
    isExecuting,
    isInstalling,
    output,
    graphData,
    installPackages,
    runCode,
    clearOutput,
    isReady: !!pyodide 
  };
};