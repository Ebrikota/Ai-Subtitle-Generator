
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { synchronizeSubtitles } from './services/geminiService';
import { transcribeWithWhisper } from './services/openaiService';
import { fileToBase64 } from './utils/fileUtils';
import FileUpload from './components/FileUpload';
import SubtitlePreview from './components/SubtitlePreview';
import CircularProgress from './components/CircularProgress';
import ApiKeyInput from './components/ApiKeyInput';
import { Status, SubtitleEntry } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const key = localStorage.getItem('openai_api_key');
    if (key) {
      setIsApiKeySet(true);
    }
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearProgressInterval();
    };
  }, [clearProgressInterval]);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setStatus(Status.IDLE);
    setSubtitles([]);
    setError('');
    setProgress(0);
    setLoadingMessage('');
    clearProgressInterval();
  };
  
  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem('openai_api_key', key);
    setIsApiKeySet(true);
    setError('');
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('openai_api_key');
    setIsApiKeySet(false);
    setError('');
    handleReset();
  };

  const handleGenerateSubtitles = useCallback(async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setStatus(Status.LOADING);
    setError('');
    setSubtitles([]);
    setProgress(0);

    try {
      setLoadingMessage('Transcribing with Whisper...');
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(p => (p < 45 ? p + 1 : 45)); 
      }, 150);
      const transcript = await transcribeWithWhisper(file);
      clearProgressInterval();
      setProgress(50);
      
      setLoadingMessage('Synchronizing timestamps...');
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(p => (p < 95 ? p + 1 : 95));
      }, 150);

      const { base64Data, mimeType } = await fileToBase64(file);
      
      if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
        throw new Error('Unsupported file type. Please upload an audio or video file.');
      }

      const generatedSubtitles = await synchronizeSubtitles(base64Data, mimeType, transcript);
      
      clearProgressInterval();
      setProgress(100);

      setTimeout(() => {
        setSubtitles(generatedSubtitles);
        setStatus(Status.SUCCESS);
      }, 500);

    } catch (err) {
      clearProgressInterval();
      setProgress(0);
      console.error(err);
      
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      
      if (errorMessage.includes('Invalid OpenAI API key')) {
          localStorage.removeItem('openai_api_key');
          setIsApiKeySet(false);
          setError('Your OpenAI API key is invalid. Please enter a valid key.');
      } else {
          setError(`Failed to generate subtitles: ${errorMessage}`);
      }
      setStatus(Status.ERROR);
    }
  }, [file, clearProgressInterval]);
  
  const handleReset = () => {
    setFile(null);
    setSubtitles([]);
    setStatus(Status.IDLE);
    setError('');
    setProgress(0);
    setLoadingMessage('');
    clearProgressInterval();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            AI Subtitle Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Upload your media, and let AI create rhythmic subtitles for you.
          </p>
        </header>

        {isApiKeySet && (
          <div className="w-full text-right mb-4 -mt-4">
            <button 
              onClick={handleClearApiKey}
              className="text-xs text-gray-500 hover:text-indigo-400 hover:underline transition-colors"
            >
              Change OpenAI API Key
            </button>
          </div>
        )}

        <main className="bg-gray-800/50 rounded-2xl shadow-2xl shadow-indigo-500/10 p-6 sm:p-8 backdrop-blur-sm border border-gray-700">
          {!isApiKeySet ? (
             <ApiKeyInput onKeySubmit={handleApiKeySubmit} />
          ) : (
            <>
              {status !== Status.SUCCESS && (
                <FileUpload onFileChange={handleFileChange} file={file} />
              )}
            </>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
              {error}
            </div>
          )}
          
          {isApiKeySet && (
            <>
                {status === Status.LOADING && (
                <div className="mt-6 flex flex-col items-center justify-center text-center">
                    <CircularProgress progress={progress} />
                    <p className="mt-4 text-indigo-400 animate-pulse">{loadingMessage}</p>
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
                
                {status === Status.SUCCESS && file && (
                <SubtitlePreview file={file} subtitles={subtitles} onReset={handleReset} />
                )}
            </>
          )}

        </main>
        
        <footer className="text-center mt-8 text-gray-500 text-sm">
            <p>Powered by OpenAI Whisper & Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
