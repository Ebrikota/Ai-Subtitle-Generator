
export enum Status {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface SubtitleEntry {
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
}
