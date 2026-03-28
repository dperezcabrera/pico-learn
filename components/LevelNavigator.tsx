
import React from 'react';
import { CheckCircleIcon, ChevronRightIcon } from './icons';

interface LevelNavigatorProps {
  currentLevelTitle: string;
  isCompleted: boolean;
  isLastLevel?: boolean;
  onNext?: () => void;
}

const LevelNavigator: React.FC<LevelNavigatorProps> = ({
  currentLevelTitle,
  isCompleted,
  isLastLevel = false,
  onNext,
}) => {
  return (
    <div className="flex items-center justify-center p-2 rounded-lg bg-slate-800 border border-slate-700">
      <div className="flex items-center gap-2 px-2" >
        <div className="text-center" title={currentLevelTitle}>
            <h2 className="text-lg font-bold text-cyan-400 truncate">
                {currentLevelTitle}
            </h2>
        </div>
        {isCompleted && (
          <span className="text-green-400" title="Completed!">
            <CheckCircleIcon />
          </span>
        )}
        {isCompleted && !isLastLevel && onNext && (
          <button
            onClick={onNext}
            className="flex items-center gap-1 ml-2 px-3 py-1 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-md transition-colors"
          >
            Next <ChevronRightIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export default LevelNavigator;
