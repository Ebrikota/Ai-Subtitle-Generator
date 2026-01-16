
import React, { useState } from 'react';

interface ApiKeyInputProps {
  onKeySubmit: (key: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onKeySubmit }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="text-center p-6 bg-gray-800/60 rounded-lg border border-gray-700 animate-fade-in">
      <h3 className="text-lg font-semibold text-white mb-2">OpenAI API Key Required</h3>
      <p className="text-sm text-gray-400 mb-4">
        Please enter your OpenAI API key to enable transcription via Whisper.
        Your key is stored in your browser for this session only.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your OpenAI API key (sk-...)"
          className="flex-grow w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
          aria-label="OpenAI API Key"
        />
        <button
          type="submit"
          disabled={!apiKey.trim()}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          Save Key
        </button>
      </form>
       <p className="text-xs text-gray-500 mt-3">
        Don't have a key? Get one from{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
          OpenAI's website
        </a>.
      </p>
    </div>
  );
};

export default ApiKeyInput;
