
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SubtitleEntry } from '../types';

const WAVEFORM_HEIGHT = 120;
const REGION_COLOR = 'rgba(139, 92, 246, 0.3)';
const REGION_BORDER_COLOR = 'rgba(167, 139, 250, 1)';
const SELECTED_REGION_COLOR = 'rgba(139, 92, 246, 0.5)';
const SELECTED_REGION_BORDER_COLOR = '#c4b5fd';
const HANDLE_WIDTH = 4;
const PLAYHEAD_COLOR = '#f43f5e';
const WAVE_COLOR = '#6b7280';
const WAVE_PROGRESS_COLOR = '#a78bfa';

interface WaveformEditorProps {
  file: File;
  subtitles: SubtitleEntry[];
  onUpdateSubtitle: (index: number, updatedEntry: SubtitleEntry) => void;
  onUpdateFinished: () => void;
  onSplitSubtitle: (index: number, time: number) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  selectedSubtitleIndex: number | null;
  onSelectSubtitle: (index: number | null) => void;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({ file, subtitles, onUpdateSubtitle, onUpdateFinished, onSplitSubtitle, currentTime, onSeek, selectedSubtitleIndex, onSelectSubtitle }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<[number, number][]>([]);
  const [duration, setDuration] = useState(0);
  const [dragInfo, setDragInfo] = useState<{ type: 'start' | 'end' | 'move'; index: number; startX: number; originalStart: number; originalEnd: number; } | null>(null);

  const getCanvasWidth = () => containerRef.current?.clientWidth ?? 0;

  useEffect(() => {
    let isActive = true;
    const audioContext = new AudioContext();

    const processAudio = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        if (!isActive) return;

        setAudioBuffer(buffer);
        setDuration(buffer.duration);

        const width = getCanvasWidth();
        if (width > 0) {
            const extractedPeaks = extractPeaks(buffer, width);
            setPeaks(extractedPeaks);
        }
      } catch (error) {
        console.error("Error processing audio file:", error);
      }
    };
    processAudio();

    return () => {
      isActive = false;
      audioContext.close();
    };
  }, [file]);
  
  const extractPeaks = (buffer: AudioBuffer, width: number): [number, number][] => {
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const extractedPeaks: [number, number][] = [];
    for (let i = 0; i < width; i++) {
        const start = i * step;
        const end = start + step;
        let min = 1.0;
        let max = -1.0;
        for (let j = start; j < end; j++) {
            const val = data[j];
            if (val > max) max = val;
            if (val < min) min = val;
        }
        extractedPeaks.push([min, max]);
    }
    return extractedPeaks;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const progressPx = (currentTime / duration) * width;

    // Draw waveform
    peaks.forEach(([min, max], i) => {
        const x = i;
        const yMin = (1 + min) * height / 2;
        const yMax = (1 + max) * height / 2;
        ctx.fillStyle = i < progressPx ? WAVE_PROGRESS_COLOR : WAVE_COLOR;
        ctx.fillRect(x, yMin, 1, Math.max(1, yMax - yMin));
    });

    // Draw subtitle regions
    subtitles.forEach((sub, index) => {
        const startX = (sub.startTime / duration) * width;
        const endX = (sub.endTime / duration) * width;
        const isSelected = index === selectedSubtitleIndex;

        ctx.fillStyle = isSelected ? SELECTED_REGION_COLOR : REGION_COLOR;
        ctx.fillRect(startX, 0, endX - startX, height);
        
        ctx.strokeStyle = isSelected ? SELECTED_REGION_BORDER_COLOR : REGION_BORDER_COLOR;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, 0, endX - startX, height);
    });

    // Draw playhead
    ctx.fillStyle = PLAYHEAD_COLOR;
    ctx.fillRect(progressPx, 0, 2, height);
  }, [peaks, subtitles, currentTime, duration, audioBuffer, selectedSubtitleIndex]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
        const width = getCanvasWidth();
        canvas.width = width;
        canvas.height = WAVEFORM_HEIGHT;
        if (audioBuffer && width > 0) {
            setPeaks(extractPeaks(audioBuffer, width));
        }
        draw();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [audioBuffer, draw]);


  useEffect(draw, [draw]);

  const timeToPx = (time: number) => (time / duration) * (canvasRef.current?.width ?? 0);
  const pxToTime = (px: number) => (px / (canvasRef.current?.width ?? 0)) * duration;
  
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pxToTime(x);

    // Check for split action first
    if (e.altKey) {
        for (let i = subtitles.length - 1; i >= 0; i--) {
            const sub = subtitles[i];
            if (time > sub.startTime && time < sub.endTime) {
                onSplitSubtitle(i, time);
                return;
            }
        }
    }

    for (let i = subtitles.length - 1; i >= 0; i--) {
        const sub = subtitles[i];
        const startX = timeToPx(sub.startTime);
        const endX = timeToPx(sub.endTime);

        if (Math.abs(x - startX) < HANDLE_WIDTH) {
            setDragInfo({ type: 'start', index: i, startX: x, originalStart: sub.startTime, originalEnd: sub.endTime });
            return;
        }
        if (Math.abs(x - endX) < HANDLE_WIDTH) {
            setDragInfo({ type: 'end', index: i, startX: x, originalStart: sub.startTime, originalEnd: sub.endTime });
            return;
        }
        if (x > startX && x < endX) {
            setDragInfo({ type: 'move', index: i, startX: x, originalStart: sub.startTime, originalEnd: sub.endTime });
            onSelectSubtitle(i);
            return;
        }
    }

    onSeek(time);
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragInfo || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const sub = subtitles[dragInfo.index];
    let updatedEntry = { ...sub };
    
    if (dragInfo.type === 'move') {
        const deltaX = x - dragInfo.startX;
        const deltaTime = pxToTime(deltaX);
        const newStartTime = Math.max(0, dragInfo.originalStart + deltaTime);
        const newEndTime = Math.min(duration, newStartTime + (dragInfo.originalEnd - dragInfo.originalStart));
        updatedEntry.startTime = newStartTime;
        updatedEntry.endTime = newEndTime;
    } else {
        const newTime = Math.max(0, Math.min(duration, pxToTime(x)));
        if (dragInfo.type === 'start') {
            updatedEntry.startTime = Math.min(newTime, sub.endTime);
        } else {
            updatedEntry.endTime = Math.max(newTime, sub.startTime);
        }
    }

    onUpdateSubtitle(dragInfo.index, updatedEntry);
  }, [dragInfo, duration, onUpdateSubtitle, subtitles]);

  const handleMouseUp = useCallback(() => {
    if (dragInfo) {
      onUpdateFinished();
    }
    setDragInfo(null);
  }, [dragInfo, onUpdateFinished]);
  
  const handleMouseLeave = useCallback(() => {
    if (dragInfo) {
      onUpdateFinished();
    }
    setDragInfo(null);
  }, [dragInfo, onUpdateFinished]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);


  return (
    <div ref={containerRef} className="w-full h-[120px] bg-gray-800 rounded-lg cursor-pointer">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        title="Click to seek, click and drag handles or region body to edit, Alt+Click to split"
      />
    </div>
  );
};

export default WaveformEditor;
