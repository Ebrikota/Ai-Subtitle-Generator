
import React, from 'react';
import { SubtitleEntry } from '../types';
import { secondsToTimeString, timeStringToSeconds } from '../utils/srtParser';
import { PlayIcon } from './icons/PlayIcon';

interface SubtitleLineEditProps {
  entry: SubtitleEntry;
  index: number;
  onUpdate: (index: number, updatedEntry: SubtitleEntry) => void;
  onPlay: (startTime: number, endTime: number) => void;
}

const ConfidenceIndicator: React.FC<{ confidence?: number }> = ({ confidence }) => {
  if (typeof confidence !== 'number') return null;

  const getConfidenceColor = () => {
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="relative group flex items-center justify-center">
      <span className={`w-3 h-3 rounded-full ${getConfidenceColor()}`}></span>
      <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Confidence: {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
};


const SubtitleLineEdit: React.FC<SubtitleLineEditProps> = ({ entry, index, onUpdate, onPlay }) => {
  const [startTimeStr, setStartTimeStr] = React.useState('');
  const [endTimeStr, setEndTimeStr] = React.useState('');
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    setStartTimeStr(secondsToTimeString(entry.startTime));
    setEndTimeStr(secondsToTimeString(entry.endTime));
    setText(entry.text);
  }, [entry]);

  const timeRegex = /^\d{2}:\d{2}:\d{2},\d{3}$/;
  const isStartTimeValid = timeRegex.test(startTimeStr);
  const isEndTimeValid = timeRegex.test(endTimeStr);

  const handleTimeBlur = (field: 'startTime' | 'endTime') => {
    const value = field === 'startTime' ? startTimeStr : endTimeStr;
    const isValid = field === 'startTime' ? isStartTimeValid : isEndTimeValid;

    if (isValid) {
      const seconds = timeStringToSeconds(value);
      if (!isNaN(seconds)) {
        onUpdate(index, { ...entry, [field]: seconds });
      }
    } else {
      if (field === 'startTime') setStartTimeStr(secondsToTimeString(entry.startTime));
      if (field === 'endTime') setEndTimeStr(secondsToTimeString(entry.endTime));
    }
  };
  
  const handleTextBlur = () => {
    if (text !== entry.text) {
        onUpdate(index, { ...entry, text });
    }
  };

  const commonInputClasses = "w-full bg-gray-900/70 text-gray-300 border focus:ring-2 focus:outline-none rounded-md px-2 py-1 font-mono text-sm transition-colors";
  const validClasses = "border-gray-600 focus:border-indigo-400 focus:ring-indigo-500/50";
  const invalidClasses = "border-red-500 focus:border-red-500 focus:ring-red-500/50";

  return (
     <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 p-2 rounded-md transition-colors duration-200 odd:bg-gray-800/40 even:bg-gray-800/20">
      <div className="row-span-2 flex flex-col items-center justify-center space-y-2">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 font-bold text-sm">{index + 1}</span>
          <ConfidenceIndicator confidence={entry.confidence} />
        </div>
        <button
          onClick={() => onPlay(entry.startTime, entry.endTime)}
          className="p-1.5 rounded-full text-gray-400 hover:bg-indigo-600 hover:text-white transition-colors duration-200"
          aria-label={`Play audio for line ${index + 1}`}
        >
          <PlayIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full">
        <input
            type="text"
            value={startTimeStr}
            onChange={(e) => setStartTimeStr(e.target.value)}
            onBlur={() => handleTimeBlur('startTime')}
            className={`${commonInputClasses} ${isStartTimeValid ? validClasses : invalidClasses}`}
            aria-label={`Start time for line ${index + 1}`}
        />
        <span className="text-gray-500 text-center px-1">→</span>
        <input
            type="text"
            value={endTimeStr}
            onChange={(e) => setEndTimeStr(e.target.value)}
            onBlur={() => handleTimeBlur('endTime')}
            className={`${commonInputClasses} ${isEndTimeValid ? validClasses : invalidClasses}`}
            aria-label={`End time for line ${index + 1}`}
        />
      </div>
      <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleTextBlur}
          className={`${commonInputClasses} ${validClasses} resize-y min-h-[40px] leading-snug`}
          rows={Math.max(1, text.split('\n').length)}
          aria-label={`Text for line ${index + 1}`}
      />
    </div>
  );
};

export default SubtitleLineEdit;
