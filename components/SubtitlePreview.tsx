
import React, { useState, useEffect, useRef } from 'react';
import { toSrt } from '../utils/srtParser';
import { DownloadIcon } from './icons/DownloadIcon';
import { EditIcon } from './icons/EditIcon';
import { SubtitleEntry } from '../types';
import SubtitleLineEdit from './SubtitleLineEdit';
import WaveformEditor from './WaveformEditor';
import SubtitleLineDisplay from './SubtitleLineDisplay';

interface SubtitlePreviewProps {
  file: File;
  subtitles: SubtitleEntry[];
  onReset: () => void;
}

const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({ file, subtitles, onReset }) => {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editableSubtitles, setEditableSubtitles] = useState<SubtitleEntry[]>([]);
  const playbackEndTimeRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setEditableSubtitles([...subtitles]);
    setIsEditing(false);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, subtitles]);

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    const newTime = mediaRef.current.currentTime;
    setCurrentTime(newTime);


    if (playbackEndTimeRef.current !== null && newTime >= playbackEndTimeRef.current) {
        mediaRef.current.pause();
        playbackEndTimeRef.current = null;
    }

    const activeSubtitle = editableSubtitles.find(
      (sub) => newTime >= sub.startTime && newTime <= sub.endTime
    );
    setCurrentSubtitle(activeSubtitle ? activeSubtitle.text : '');
  };

  const handlePlaySegment = (startTime: number, endTime: number) => {
    if (mediaRef.current) {
        mediaRef.current.currentTime = startTime;
        mediaRef.current.play();
        playbackEndTimeRef.current = endTime;
    }
  };

  const handleDownload = () => {
    const srtContent = toSrt(editableSubtitles);
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
    setEditableSubtitles(newSubtitles);
  };
  
  const handleSeek = (time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
    }
  };

  const isVideo = file.type.startsWith('video/');

  return (
    <div className="w-full flex flex-col items-center space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-gray-200">Subtitle Preview & Editor</h2>
      
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg border border-gray-700">
        {isVideo ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={fileUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
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
              className="w-full max-w-md"
            />
          </div>
        )}
        
        {currentSubtitle && (
          <div 
            className="absolute bottom-5 sm:bottom-12 lg:bottom-16 left-1/2 -translate-x-1/2 w-11/12 text-center pointer-events-none"
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            aria-live="polite"
          >
            <p className="inline bg-black bg-opacity-60 text-white font-bold text-lg sm:text-xl md:text-2xl px-3 py-1.5 rounded">
              {currentSubtitle}
            </p>
          </div>
        )}
      </div>
       
       {isEditing && (
            <div className="w-full mt-2">
                <WaveformEditor
                    file={file}
                    subtitles={editableSubtitles}
                    onUpdateSubtitle={handleSubtitleUpdate}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    selectedSubtitleIndex={selectedSubtitleIndex}
                    onSelectSubtitle={setSelectedSubtitleIndex}
                />
            </div>
        )}

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full justify-center">
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

       <div className="w-full pt-4 border-t border-gray-700/50">
        <div className="w-full space-y-2 max-h-96 overflow-y-auto p-2 rounded-lg bg-gray-900/50 border border-gray-700">
          {isEditing ? (
            editableSubtitles.map((entry, index) => (
                <SubtitleLineEdit 
                    key={`${index}-${entry.startTime}`}
                    entry={entry}
                    index={index}
                    onUpdate={handleSubtitleUpdate}
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
    </div>
  );
};

export default SubtitlePreview;
