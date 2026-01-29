
export interface MusicAnalysis {
  artist: string;
  title: string;
  mood: string;
  genre: string;
  lyrics: string;
  visualPrompt: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  releaseDate?: string;
  sources: { title: string; uri: string }[];
}

export interface VisionaryState {
  isRecording: boolean;
  isAnalyzing: boolean;
  error: string | null;
  result: MusicAnalysis | null;
  imageUrl: string | null;
  countdown: number;
}
