
import React, { useState, useCallback } from 'react';
import { generateSubtitles } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import FileUpload from './components/FileUpload';
import SubtitleDisplay from './components/SubtitleDisplay';
import Spinner from './components/Spinner';
import { Status } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<string>('');
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string>('');

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setStatus(Status.IDLE);
    setSubtitles('');
    setError('');
  };

  const handleGenerateSubtitles = useCallback(async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setStatus(Status.LOADING);
    setError('');
    setSubtitles('');

    try {
      const { base64Data, mimeType } = await fileToBase64(file);
      
      // Basic validation for common audio/video types
      if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
        throw new Error('Unsupported file type. Please upload an audio or video file.');
      }

      const generatedSubtitles = await generateSubtitles(base64Data, mimeType);
      setSubtitles(generatedSubtitles);
      setStatus(Status.SUCCESS);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate subtitles: ${errorMessage}`);
      setStatus(Status.ERROR);
    }
  }, [file]);
  
  const handleReset = () => {
    setFile(null);
    setSubtitles('');
    setStatus(Status.IDLE);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            AI Subtitle Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Upload your media, and let AI create rhythmic subtitles for you.
          </p>
        </header>

        <main className="bg-gray-800/50 rounded-2xl shadow-2xl shadow-indigo-500/10 p-6 sm:p-8 backdrop-blur-sm border border-gray-700">
          {status !== Status.SUCCESS && (
            <FileUpload onFileChange={handleFileChange} file={file} />
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
              {error}
            </div>
          )}

          {status === Status.LOADING && (
            <div className="mt-6 text-center">
              <Spinner />
              <p className="mt-2 text-indigo-400 animate-pulse">Generating subtitles... this may take a moment.</p>
            </div>
          )}
          
          {status === Status.IDLE && file && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleGenerateSubtitles}
                disabled={!file || status === Status.LOADING}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75"
              >
                Generate Subtitles
              </button>
            </div>
          )}
          
          {status === Status.SUCCESS && (
            <SubtitleDisplay subtitles={subtitles} onReset={handleReset} filename={file?.name ?? 'subtitles'} />
          )}

        </main>
        
        <footer className="text-center mt-8 text-gray-500 text-sm">
            <p>Powered by Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
