
import React, { useEffect, useRef } from 'react';
import { SubtitleEntry } from '../types';
import { secondsToTimeString } from '../utils/srtParser';

interface SubtitleLineDisplayProps {
  entry: SubtitleEntry;
  onClick: () => void;
  isActive: boolean;
}

const SubtitleLineDisplay: React.FC<SubtitleLineDisplayProps> = ({ entry, onClick, isActive }) => {
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      lineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);
  
  return (
    <div
      ref={lineRef}
      onClick={onClick}
      className={`p-3 rounded-md cursor-pointer transition-colors duration-200 ${
        isActive ? 'bg-indigo-900/60' : 'hover:bg-gray-700/50'
      }`}
    >
      <p className="text-gray-300">{entry.text}</p>
      <p className="text-xs text-gray-500 font-mono mt-1">
        {secondsToTimeString(entry.startTime)} &rarr; {secondsToTimeString(entry.endTime)}
      </p>
    </div>
  );
};

export default SubtitleLineDisplay;
