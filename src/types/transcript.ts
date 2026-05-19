export interface TranscriptLine {
  text: string;
  offset: number; // milliseconds from start
  duration: number; // milliseconds
  speaker?: string;
}
