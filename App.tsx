
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VisionaryState, MusicAnalysis } from './types';
import { analyzeAudio, generateVisual } from './services/geminiService';
import Visualizer from './components/Visualizer';

const RECORDING_DURATION = 8000; 

const App: React.FC = () => {
  const [mounted, setMounted] = useState(false);
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

  // Effect om te bevestigen dat de app geladen is (voorkomt zwart scherm op iPhone)
  useEffect(() => {
    setMounted(true);
    console.log("App component mounted successfully");
  }, []);

  const startListening = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microfoon toegang niet ondersteund of geblokkeerd. Gebruik HTTPS en controleer je instellingen.");
      }

      setState(prev => ({ 
        ...prev, 
        error: null, 
        result: null, 
        imageUrl: null, 
        isRecording: true, 
        countdown: RECORDING_DURATION / 1000 
      }));
      
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      setStream(audioStream);

      // Compatibiliteit check voor MediaRecorder MIME types
      let mimeType = '';
      const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const finalMimeType = mediaRecorder.mimeType || 'audio/mp4';
        const audioBlob = new Blob(chunksRef.current, { type: finalMimeType });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          processAudio(base64Data, finalMimeType);
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
        error: err.message || "Microfoon toegang geweigerd.", 
        isRecording: false 
      }));
    }
  }, []);

  const processAudio = async (base64Audio: string, mimeType: string) => {
    try {
      const analysis = await analyzeAudio(base64Audio, mimeType);
      setState(prev => ({ ...prev, result: analysis }));
      
      const imageUrl = await generateVisual(analysis.visualPrompt);
      setState(prev => ({ ...prev, imageUrl, isAnalyzing: false }));
    } catch (err: any) {
      console.error("Process Error:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Kon het nummer niet analyseren. Probeer het opnieuw.", 
        isAnalyzing: false 
      }));
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-start p-4 md:p-8 font-sans selection:bg-blue-500/30">
      {/* Achtergrond Decoratie */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>

      <header className="w-full max-w-5xl z-10 flex justify-between items-center mb-8 md:mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-compact-disc text-blue-500 text-xl animate-[spin_4s_linear_infinite]"></i>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none">Music Visionary</h1>
            <p className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] uppercase mt-1">Cross-Platform Sync</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl z-10 flex flex-col items-center flex-1">
        {!state.result && !state.isAnalyzing && !state.isRecording && (
          <div className="text-center py-20 md:py-32 animate-in fade-in zoom-in duration-700">
            <h2 className="text-4xl md:text-7xl font-black mb-6 tracking-tight leading-[0.9]">
              Luister.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-purple-400">Visualiseer.</span>
            </h2>
            <p className="text-zinc-500 text-base md:text-lg mb-10 max-w-md mx-auto font-medium">
              Ontdek de artiest en zie de muziek tot leven komen met AI.
            </p>
            <button 
              onClick={startListening}
              className="group relative px-10 py-5 bg-white text-black font-black rounded-2xl text-lg hover:scale-105 transition-all shadow-xl active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center gap-3">
                <i className="fa-solid fa-microphone-lines"></i>
                START HERKENNING
              </span>
            </button>
          </div>
        )}

        {state.isRecording && (
          <div className="w-full max-w-md flex flex-col items-center gap-8 py-12">
            <div className="relative">
              <div className="w-36 h-36 bg-blue-600/20 rounded-full flex items-center justify-center animate-pulse border-2 border-blue-500/30">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)]">
                   <i className="fa-solid fa-bolt-lightning text-3xl"></i>
                </div>
              </div>
              <div className="absolute -top-1 -right-1 bg-white text-black text-base font-black w-10 h-10 rounded-full flex items-center justify-center border-4 border-[#0a0a0c]">
                {state.countdown}
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black mb-1">Ik luister...</h3>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Houd je microfoon bij de bron</p>
            </div>
            <Visualizer stream={stream} isActive={state.isRecording} />
          </div>
        )}

        {state.isAnalyzing && (
          <div className="w-full max-w-md flex flex-col items-center gap-6 py-12">
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 via-white to-purple-600 animate-[loading_1.5s_linear_infinite]" style={{ width: '40%' }}></div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black mb-1">Analyse bezig...</h3>
              <p className="text-zinc-500 text-xs">Gemini zoekt de juiste sfeer en beelden.</p>
            </div>
          </div>
        )}

        {state.error && (
          <div className="w-full max-w-md p-6 bg-red-500/5 border border-red-500/20 rounded-3xl flex flex-col items-center gap-4 text-center shadow-xl">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
              <i className="fa-solid fa-triangle-exclamation text-xl"></i>
            </div>
            <div>
              <p className="font-black text-base mb-1">Oeps!</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{state.error}</p>
            </div>
            <button 
              onClick={startListening} 
              className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-black transition-all border border-white/10 text-xs"
            >
              OPNIEUW
            </button>
          </div>
        )}

        {state.result && state.imageUrl && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="lg:col-span-5 flex flex-col gap-5">
               <div className="relative group rounded-[1.5rem] overflow-hidden shadow-2xl border border-white/5 aspect-square">
                <img 
                  src={state.imageUrl} 
                  alt="AI Art" 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.2em] mb-1">{state.result.genre}</p>
                  <h3 className="text-2xl font-black leading-none mb-1 tracking-tighter uppercase">{state.result.title}</h3>
                  <p className="text-white/70 font-bold text-sm">{state.result.artist}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a href={state.result.spotifyUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-4 bg-[#1DB954] text-black text-xs font-black rounded-xl transition-all hover:brightness-110">
                  <i className="fa-brands fa-spotify"></i> SPOTIFY
                </a>
                <a href={state.result.youtubeUrl || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-4 bg-white text-black text-xs font-black rounded-xl transition-all hover:brightness-90">
                  <i className="fa-brands fa-youtube"></i> YOUTUBE
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-white/[0.02] backdrop-blur-xl p-6 md:p-8 rounded-[1.5rem] border border-white/5 flex flex-col shadow-xl flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    Lyrics & Sfeer
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[300px] md:max-h-[400px] pr-2 custom-scrollbar">
                  <p className="text-lg md:text-xl font-serif leading-relaxed text-zinc-300 italic whitespace-pre-wrap">
                    "{state.result.lyrics}"
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                   <button onClick={startListening} className="w-full py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-xl flex items-center justify-center gap-3 transition-all border border-white/10 font-black text-xs uppercase">
                    <i className="fa-solid fa-rotate-right"></i>
                    Nieuw nummer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 text-zinc-800 text-[8px] font-black uppercase tracking-[0.3em] text-center">
        Powered by Gemini &bull; 2025
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
