import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon } from './icons';

interface LevelNavigatorProps {
  currentLevelTitle: string;
  onPrevious: () => void;
  onNext: () => void;
  isFirstLevel: boolean;
  isLastLevel: boolean;
  disabled: boolean;
  isCompleted: boolean;
}

const LevelNavigator: React.FC<LevelNavigatorProps> = ({ 
  currentLevelTitle, 
  onPrevious, 
  onNext, 
  isFirstLevel, 
  isLastLevel, 
  disabled,
  isCompleted
}) => {
  const buttonClasses = "p-2 rounded-md transition-colors duration-200 text-slate-300 hover:bg-slate-700/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700">
      <button
        onClick={onPrevious}
        disabled={isFirstLevel || disabled}
        className={buttonClasses}
        aria-label="Previous level"
      >
        <ChevronLeftIcon />
      </button>
      <div className="flex items-center gap-2 px-2" >
        <h2 className="text-center text-lg font-bold text-cyan-400 truncate" title={currentLevelTitle}>
          {currentLevelTitle}
        </h2>
        {isCompleted && (
          <span className="text-green-400" title="Completed!">
            <CheckCircleIcon />
          </span>
        )}
      </div>
      <button
        onClick={onNext}
        disabled={isLastLevel || disabled}
        className={buttonClasses}
        aria-label="Next level"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
};

export default LevelNavigator;
