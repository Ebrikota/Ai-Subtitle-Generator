
import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';

interface SubtitleDisplayProps {
  subtitles: string;
  onReset: () => void;
  filename: string;
}

const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ subtitles, onReset, filename }) => {

  const handleDownload = () => {
    const blob = new Blob([subtitles], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseFilename = filename.substring(0, filename.lastIndexOf('.')) || filename;
    a.download = `${baseFilename}_subtitles.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col items-center space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-gray-200">Generated Subtitles</h2>
      
      <div className="w-full h-64 p-4 bg-gray-900/70 border border-gray-700 rounded-lg overflow-y-auto whitespace-pre-wrap font-mono text-gray-300">
        {subtitles}
      </div>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full justify-center">
        <button
          onClick={handleDownload}
          className="flex items-center justify-center px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
        >
          <DownloadIcon className="w-5 h-5 mr-2" />
          Download .srt
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
        >
          Generate New Subtitles
        </button>
      </div>
    </div>
  );
};

export default SubtitleDisplay;
