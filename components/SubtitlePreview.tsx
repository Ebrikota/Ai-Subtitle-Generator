
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toSrt } from '../utils/srtParser';
import { DownloadIcon } from './icons/DownloadIcon';
import { EditIcon } from './icons/EditIcon';
import { SubtitleEntry } from '../types';
import SubtitleLineEdit from './SubtitleLineEdit';
import WaveformEditor from './WaveformEditor';
import SubtitleLineDisplay from './SubtitleLineDisplay';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';

// Custom hook for managing state history (undo/redo)
const useHistory = (initialState: SubtitleEntry[]) => {
  const [history, setHistory] = useState<SubtitleEntry[][]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const setState = (newState: SubtitleEntry[], overwrite = false) => {
    const newHistory = history.slice(0, currentIndex + 1);
    setHistory([...newHistory, newState]);
    setCurrentIndex(newHistory.length);
  };

  const undo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const redo = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const resetHistory = (newState: SubtitleEntry[]) => {
      setHistory([newState]);
      setCurrentIndex(0);
  }

  return { state: history[currentIndex] || [], setState, undo, redo, canUndo: currentIndex > 0, canRedo: currentIndex < history.length - 1, resetHistory };
};


interface SubtitlePreviewProps {
  file: File;
  subtitles: SubtitleEntry[];
  onReset: () => void;
}

const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({ file, subtitles, onReset }) => {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [currentSubtitles, setCurrentSubtitles] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  
  const { state: editableSubtitles, setState: setEditableSubtitles, undo, redo, canUndo, canRedo, resetHistory } = useHistory(subtitles);

  const playbackEndTimeRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    resetHistory([...subtitles]);
    setIsEditing(false);
    setMediaDuration(null);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, subtitles]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (isEditing) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSubtitleIndex(prev => prev !== null && prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSubtitleIndex(prev => prev !== null && prev < editableSubtitles.length - 1 ? prev + 1 : editableSubtitles.length - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, isEditing, editableSubtitles.length]);


  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    const time = mediaRef.current.currentTime;
    setCurrentTime(time);

    if (playbackEndTimeRef.current !== null && time >= playbackEndTimeRef.current) {
        mediaRef.current.pause();
        playbackEndTimeRef.current = null;
    }

    let displaySubs: string[] = [];

    // This logic processes subtitles in discrete groups (triplets, pairs, or singles)
    // to prevent any line from appearing in multiple on-screen sets.
    for (let i = 0; i < editableSubtitles.length; ) {
        const sub1 = editableSubtitles[i];
        const sub2 = editableSubtitles[i + 1];
        const sub3 = editableSubtitles[i + 2];

        // Check for triplet first
        const endsWithPunctuation1 = /[.?!]$/.test(sub1.text.trim());
        const isPair = sub2 && sub2.startTime - sub1.endTime < 0.5 && !endsWithPunctuation1;
        const endsWithPunctuation2 = isPair && sub2 && /[.?!]$/.test(sub2.text.trim());
        const isTriplet = isPair && sub3 && sub3.startTime - sub2.endTime < 0.5 && !endsWithPunctuation2;

        if (isTriplet) {
            if (time >= sub1.startTime && time <= sub3.endTime) {
                displaySubs = [sub1.text, sub2.text, sub3.text];
                break; // Found the active group, stop searching.
            }
            i += 3; // Move to the next potential group
        } else if (isPair) {
            if (time >= sub1.startTime && time <= sub2.endTime) {
                displaySubs = [sub1.text, sub2.text];
                break; // Found the active group, stop searching.
            }
            i += 2; // Move to the next potential group
        } else {
            if (time >= sub1.startTime && time <= sub1.endTime) {
                displaySubs = [sub1.text];
                break; // Found the active group, stop searching.
            }
            i += 1; // Move to the next potential group
        }
    }
    
    setCurrentSubtitles(displaySubs);
  };

  const handlePlaySegment = (startTime: number, endTime: number) => {
    if (mediaRef.current) {
        mediaRef.current.currentTime = startTime;
        mediaRef.current.play();
        playbackEndTimeRef.current = endTime;
    }
  };

  const handleDownload = () => {
    const srtContent = toSrt(editableSubtitles, mediaDuration ?? undefined);
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseFilename = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    a.download = `${baseFilename}_subtitles.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleSubtitleUpdate = (index: number, updatedEntry: SubtitleEntry) => {
    const newSubtitles = [...editableSubtitles];
    
    if (updatedEntry.startTime > updatedEntry.endTime) {
        [updatedEntry.startTime, updatedEntry.endTime] = [updatedEntry.endTime, updatedEntry.startTime];
    }

    newSubtitles[index] = updatedEntry;
    setEditableSubtitles(newSubtitles, true); // Overwrite last history state for continuous drag
  };

  const handleSubtitleUpdateFinished = () => {
      // Create a new history entry after dragging is finished
      setEditableSubtitles([...editableSubtitles]);
  }
  
  const handleSplitSubtitle = (index: number, time: number) => {
    const subToSplit = editableSubtitles[index];
    if (time <= subToSplit.startTime || time >= subToSplit.endTime) return;
    
    // Attempt a smarter split based on spaces
    const words = subToSplit.text.split(' ');
    const approxCharTime = (subToSplit.endTime - subToSplit.startTime) / subToSplit.text.length;
    const splitCharIndex = Math.round((time - subToSplit.startTime) / approxCharTime);
    
    let cumulativeLength = 0;
    let splitWordIndex = words.length -1;
    for(let i=0; i < words.length; i++) {
        cumulativeLength += words[i].length + 1; // +1 for space
        if(cumulativeLength >= splitCharIndex) {
            splitWordIndex = i;
            break;
        }
    }

    const text1 = words.slice(0, splitWordIndex + 1).join(' ');
    const text2 = words.slice(splitWordIndex + 1).join(' ');

    if (!text1 || !text2) { // fallback for simple split if smart split fails
        const newSub1: SubtitleEntry = { ...subToSplit, endTime: time };
        const newSub2: SubtitleEntry = { ...subToSplit, startTime: time };
        const newSubtitles = [...editableSubtitles];
        newSubtitles.splice(index, 1, newSub1, newSub2);
        setEditableSubtitles(newSubtitles);
        return;
    }

    const newSub1: SubtitleEntry = { ...subToSplit, endTime: time, text: text1 };
    const newSub2: SubtitleEntry = { ...subToSplit, startTime: time, text: text2 };
    
    const newSubtitles = [...editableSubtitles];
    newSubtitles.splice(index, 1, newSub1, newSub2);
    setEditableSubtitles(newSubtitles);
  }

  const handleSeek = (time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
    }
  };

  const handleMetadata = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    setMediaDuration(e.currentTarget.duration);
  };

  const isVideo = file.type.startsWith('video/');

  return (
    <div className="w-full flex flex-col items-center space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-gray-200">Subtitle Preview & Editor</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Left Column: Subtitle List */}
        <div className="w-full h-[60vh] flex flex-col">
           <div className="flex justify-end gap-2 mb-2">
                <button onClick={undo} disabled={!canUndo} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 transition-colors"><UndoIcon className="w-5 h-5"/></button>
                <button onClick={redo} disabled={!canRedo} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 transition-colors"><RedoIcon className="w-5 h-5"/></button>
           </div>
           <div className="flex-grow w-full space-y-2 overflow-y-auto p-2 rounded-lg bg-gray-900/50 border border-gray-700">
              {isEditing ? (
                editableSubtitles.map((entry, index) => (
                    <SubtitleLineEdit 
                        key={`${index}-${entry.startTime}`}
                        entry={entry}
                        index={index}
                        onUpdate={(updatedIndex, updatedEntry) => {
                            handleSubtitleUpdate(updatedIndex, updatedEntry);
                            handleSubtitleUpdateFinished();
                        }}
                        onPlay={handlePlaySegment}
                        isSelected={index === selectedSubtitleIndex}
                        onSelect={() => setSelectedSubtitleIndex(index)}
                    />
                ))
              ) : (
                editableSubtitles.map((entry, index) => {
                    const isActive = currentTime >= entry.startTime && currentTime <= entry.endTime;
                    return (
                        <SubtitleLineDisplay
                            key={`${index}-${entry.startTime}`}
                            entry={entry}
                            isActive={isActive}
                            onClick={() => handleSeek(entry.startTime)}
                        />
                    );
                })
              )}
            </div>
        </div>

        {/* Right Column: Player and Controls */}
        <div className="flex flex-col space-y-4">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg border border-gray-700">
            {isVideo ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={fileUrl}
                controls
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleMetadata}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-800">
                <p className="text-lg font-semibold text-gray-300 mb-4 truncate max-w-full px-4" title={file.name}>{file.name}</p>
                <audio
                  ref={mediaRef as React.RefObject<HTMLAudioElement>}
                  src={fileUrl}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleMetadata}
                  className="w-full max-w-md"
                />
              </div>
            )}
            
            {currentSubtitles.length > 0 && (
              <div 
                className="absolute bottom-[35%] left-1/2 -translate-x-1/2 w-11/12 text-center pointer-events-none"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                aria-live="polite"
              >
                {currentSubtitles.map((text, i) => (
                    <p key={i} className="inline-block w-full bg-black bg-opacity-60 text-white font-bold text-sm sm:text-base md:text-lg px-2 py-1 rounded leading-tight">
                    {text}
                    </p>
                ))}
              </div>
            )}
          </div>
           
           {isEditing && (
                <div className="w-full">
                    <WaveformEditor
                        file={file}
                        subtitles={editableSubtitles}
                        onUpdateSubtitle={handleSubtitleUpdate}
                        onUpdateFinished={handleSubtitleUpdateFinished}
                        onSplitSubtitle={handleSplitSubtitle}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        selectedSubtitleIndex={selectedSubtitleIndex}
                        onSelectSubtitle={setSelectedSubtitleIndex}
                    />
                </div>
            )}

          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full justify-center pt-2">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
            >
              <DownloadIcon className="w-5 h-5 mr-2" />
              Download .srt
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center justify-center px-6 py-3 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                isEditing
                  ? 'bg-indigo-600 text-white focus:ring-indigo-400'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500'
              }`}
              aria-pressed={isEditing}
            >
              <EditIcon className="w-5 h-5 mr-2" />
              {isEditing ? 'Finish Editing' : 'Edit Subtitles'}
            </button>
            <button
              onClick={onReset}
              className="px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
            >
              Generate New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubtitlePreview;
