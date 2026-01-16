
import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { FileIcon } from './icons/FileIcon';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  file: File | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, file }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  }, [onFileChange]);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <label
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
            ${isDragging ? 'border-indigo-400 bg-gray-700/50' : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/30'}`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadIcon className="w-10 h-10 mb-3 text-gray-400" />
            <p className="mb-2 text-sm text-gray-400">
              <span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">Audio or Video file</p>
          </div>
          <input 
            id="dropzone-file" 
            type="file" 
            className="hidden"
            accept="audio/*,video/*"
            onChange={handleFileSelect}
          />
        </label>
      ) : (
        <div className="p-4 bg-gray-700/50 border border-gray-600 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <FileIcon className="w-6 h-6 text-indigo-400 flex-shrink-0" />
            <span className="text-gray-300 font-medium truncate" title={file.name}>
              {file.name}
            </span>
          </div>
          <button
            onClick={() => onFileChange(null)}
            className="text-gray-400 hover:text-white transition-colors duration-200 ml-4 px-2 py-1 rounded-md text-sm font-semibold"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
