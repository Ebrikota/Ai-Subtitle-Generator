
import { SubtitleEntry } from '../types';

export const timeStringToSeconds = (time: string): number => {
  if (typeof time !== 'string') return NaN;
  const parts = time.replace(',', '.').split(':');
  if (parts.length !== 3) return NaN;
  const [h, m, s] = parts.map(parseFloat);
  if (isNaN(h) || isNaN(m) || isNaN(s)) return NaN;
  return h * 3600 + m * 60 + s;
};

export const secondsToTimeString = (totalSeconds: number): string => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00:00,000';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

  const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
};

export const parseSrt = (srt: string): SubtitleEntry[] => {
  if (!srt) return [];
  
  const blocks = srt.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);
  
  return blocks.map(block => {
    const lines = block.split('\n');
    if (lines.length < 2) return null; // Can be just time + text

    const timeLineIndex = lines.findIndex(line => line.includes('-->'));
    if (timeLineIndex === -1) return null;

    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    
    if (!timeMatch) return null;

    const startTime = timeStringToSeconds(timeMatch[1]);
    const endTime = timeStringToSeconds(timeMatch[2]);
    const text = lines.slice(timeLineIndex + 1).join('\n').trim();
    
    if (isNaN(startTime) || isNaN(endTime)) return null;

    return { startTime, endTime, text };
  }).filter((entry): entry is SubtitleEntry => entry !== null);
};


export const toSrt = (entries: SubtitleEntry[], duration?: number): string => {
  if (!entries.length) return '';

  // Deep copy to avoid modifying the original array from the component state
  const localEntries: SubtitleEntry[] = JSON.parse(JSON.stringify(entries));

  // Extend the last subtitle to the end of the media if duration is provided
  if (duration && localEntries.length > 0) {
    const lastEntry = localEntries[localEntries.length - 1];
    if (lastEntry.endTime < duration) {
      lastEntry.endTime = duration;
    }
  }

  const blocks: string[] = [];
  let i = 0;
  let srtIndex = 1;

  while (i < localEntries.length) {
    const sub1 = localEntries[i];
    const sub2 = localEntries[i + 1];

    // A pair is two sequential subs with a small time gap, AND the first line does not end a sentence.
    const endsWithPunctuation = /[.?!]$/.test(sub1.text.trim());
    const isPair = sub2 && sub2.startTime - sub1.endTime < 0.5 && !endsWithPunctuation;

    if (isPair) {
      const startTime = secondsToTimeString(sub1.startTime);
      const endTime = secondsToTimeString(sub2.endTime);
      const text = `${sub1.text}\n${sub2.text}`;
      blocks.push(`${srtIndex}\n${startTime} --> ${endTime}\n${text}`);
      i += 2; // Skip both entries of the pair
    } else {
      const startTime = secondsToTimeString(sub1.startTime);
      const endTime = secondsToTimeString(sub1.endTime);
      const text = sub1.text;
      blocks.push(`${srtIndex}\n${startTime} --> ${endTime}\n${text}`);
      i += 1; // Skip single entry
    }
    srtIndex++;
  }
  return blocks.join('\n\n');
};
