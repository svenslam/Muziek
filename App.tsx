import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VisionaryState, MusicAnalysis } from './types';
import { analyzeAudio, generateVisual } from './services/geminiService';
import Visualizer from './components/Visualizer';

const RECORDING_DURATION = 9000; 

const LOADING_MESSAGES = [
  "Capturing sound waves...",
  "Analyzing harmonic structures...",
  "Searching global databases...",
  "Interpreting emotional resonance...",
  "Painting the visual landscape...",
  "Finalizing your vision..."
];

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [state, setState] = useState<VisionaryState>({
    isRecording: false,
    isAnalyzing: false,
    error: null,
    result: null,
    imageUrl: null,
    countdown: 0,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let interval: number;
    if (state.isAnalyzing) {
      interval = window.setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [state.isAnalyzing]);

  const startListening = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser.");
      }

      setState(prev => ({ 
        ...prev, 
        error: null, 
        result: null, 
        imageUrl: null, 
        isRecording: true, 
        countdown: Math.floor(RECORDING_DURATION / 1000) 
      }));
      
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          processAudio(base64Data, mediaRecorder.mimeType);
        };
        audioStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      mediaRecorder.start();

      const timer = setInterval(() => {
        setState(prev => {
          if (prev.countdown <= 1) {
            clearInterval(timer);
            return { ...prev, countdown: 0 };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setState(prev => ({ ...prev, isRecording: false, isAnalyzing: true }));
      }, RECORDING_DURATION);

    } catch (err: any) {
      console.error("Mic Error:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Microphone access denied or unavailable.", 
        isRecording: false 
      }));
    }
  }, []);

  const processAudio = async (base64Audio: string, mimeType: string) => {
    try {
      // Step 1: Analyze audio and search for details
      const analysis = await analyzeAudio(base64Audio, mimeType);
      
      // Step 2: Generate artistic visual based on the analysis
      const generatedImage = await generateVisual(analysis.visualPrompt);
      
      setState(prev => ({ 
        ...prev, 
        result: analysis,
        imageUrl: generatedImage,
        isAnalyzing: false 
      }));
    } catch (err: any) {
      console.error("Process Error:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to interpret the music. Please try again with clearer audio.", 
        isAnalyzing: false 
      }));
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-start p-6 md:p-12 font-sans overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[160px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-900/10 blur-[160px] rounded-full animate-pulse"></div>
      </div>

      <header className="w-full max-w-6xl z-10 flex justify-between items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
            <i className="fa-solid fa-compact-disc text-blue-500 text-2xl animate-[spin_4s_linear_infinite]"></i>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Music Visionary</h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-[0.3em] uppercase">Visual Sonic AI</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl z-10 flex flex-col items-center flex-1">
        {!state.result && !state.isAnalyzing && !state.isRecording && (
          <div className="text-center py-24 md:py-40 max-w-2xl animate-in fade-in zoom-in-95 duration-1000">
            <h2 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter leading-[0.85]">
              See what your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-400">Music Feels Like.</span>
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 font-medium">
              A sensory fusion of audio analysis and generative art. Let Gemini listen, identify, and paint your soundscape.
            </p>
            <button 
              onClick={startListening}
              className="group relative px-12 py-6 bg-white text-black font-black rounded-3xl text-xl hover:scale-105 transition-all shadow-xl active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center gap-4">
                <i className="fa-solid fa-microphone-lines animate-pulse"></i>
                CAPTURE SOUND
              </span>
            </button>
          </div>
        )}

        {state.isRecording && (
          <div className="w-full max-w-xl flex flex-col items-center gap-10 py-20 animate-in fade-in slide-in-from-bottom-8">
            <div className="relative">
              <div className="w-44 h-44 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20">
                <div className="w-28 h-28 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(37,99,235,0.4)] animate-pulse">
                   <i className="fa-solid fa-wave-square text-4xl"></i>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-white text-black text-xl font-black w-12 h-12 rounded-full flex items-center justify-center border-4 border-[#050505]">
                {state.countdown}
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black mb-2 tracking-tight uppercase">Recording Session</h3>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Analyzing acoustic environment...</p>
            </div>
            <Visualizer stream={stream} isActive={state.isRecording} />
          </div>
        )}

        {state.isAnalyzing && (
          <div className="w-full max-w-lg flex flex-col items-center gap-10 py-32 text-center">
            <div className="w-full h-[2px] bg-zinc-900 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[shimmer_2s_infinite]"></div>
            </div>
            <div>
              <h3 className="text-xl font-black mb-3 tracking-wide text-blue-400">{LOADING_MESSAGES[loadingStep]}</h3>
              <p className="text-zinc-500 text-sm font-medium">Synthesizing audio features into art...</p>
            </div>
          </div>
        )}

        {state.error && (
          <div className="w-full max-w-md p-10 bg-red-500/5 border border-red-500/20 rounded-[2.5rem] flex flex-col items-center gap-6 text-center backdrop-blur-3xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
              <i className="fa-solid fa-bolt text-2xl"></i>
            </div>
            <div>
              <p className="font-black text-xl mb-2 uppercase">Audio Interference</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{state.error}</p>
            </div>
            <button onClick={startListening} className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl font-black transition-all text-xs uppercase tracking-widest">
              Try Again
            </button>
          </div>
        )}

        {state.result && state.imageUrl && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out pb-20">
            <div className="lg:col-span-5 flex flex-col gap-6">
               <div className="relative group rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 aspect-square bg-zinc-900">
                <img 
                  src={state.imageUrl} 
                  alt="AI Sonic Interpretation" 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-blue-500/20">
                      {state.result.genre}
                    </span>
                    {state.result.releaseDate && (
                      <span className="px-2.5 py-1 bg-white/10 text-white/60 text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/10">
                        {state.result.releaseDate}
                      </span>
                    )}
                  </div>
                  <h3 className="text-3xl font-black leading-tight mb-1 tracking-tighter uppercase">{state.result.title}</h3>
                  <p className="text-white/50 font-bold text-base tracking-wide uppercase">{state.result.artist}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <a href={state.result.spotifyUrl} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-3 py-5 bg-[#1DB954] text-black text-[10px] font-black rounded-2xl hover:brightness-110 transition-all uppercase tracking-widest">
                  <i className="fa-brands fa-spotify text-lg"></i> Spotify
                </a>
                <a href={state.result.youtubeUrl} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-3 py-5 bg-white text-black text-[10px] font-black rounded-2xl hover:bg-zinc-200 transition-all uppercase tracking-widest">
                  <i className="fa-brands fa-youtube text-lg"></i> YouTube
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-white/[0.02] backdrop-blur-3xl p-10 md:p-14 rounded-[2.5rem] border border-white/5 flex flex-col shadow-2xl flex-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <i className="fa-solid fa-quote-right text-8xl"></i>
                </div>
                
                <div className="flex items-center gap-3 text-blue-400 font-black text-[11px] uppercase tracking-[0.25em] mb-12">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Lyric Interpretation
                </div>
                
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-3xl md:text-4xl font-serif leading-snug text-zinc-100 italic mb-8">
                    "{state.result.lyrics}"
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                      Vibe: {state.result.mood}
                    </span>
                  </div>
                </div>

                <div className="mt-12 pt-10 border-t border-white/5">
                  <button onClick={startListening} className="w-full py-6 bg-white/5 hover:bg-white text-white hover:text-black rounded-2xl flex items-center justify-center gap-4 transition-all border border-white/10 font-black text-xs uppercase tracking-[0.3em]">
                    <i className="fa-solid fa-rotate"></i> New Exploration
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 text-zinc-800 text-[10px] font-black uppercase tracking-[0.5em] text-center mt-auto w-full border-t border-white/[0.02]">
        Powered by Gemini 3 Pro & 2.5 Flash &bull; Est. 2025
      </footer>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;