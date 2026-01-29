
import React, { useState, useRef, useCallback } from 'react';
import { VisionaryState, MusicAnalysis } from './types';
import { analyzeAudio, generateVisual } from './services/geminiService';
import Visualizer from './components/Visualizer';

const RECORDING_DURATION = 8000; 

const App: React.FC = () => {
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

  const startListening = useCallback(async () => {
    try {
      // Check of browser ondersteuning heeft voor mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Je browser ondersteunt geen audio-opnames. Gebruik een moderne browser.");
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
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      setStream(audioStream);

      // iOS Safari compatibiliteit: probeer mp4/aac eerst, dan webm
      let mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Laat browser beslissen als fallback
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
        error: "Geen match gevonden. Probeer het nummer iets dichter bij de microfoon te houden.", 
        isAnalyzing: false 
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-start p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>

      <header className="w-full max-w-5xl z-10 flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
            <i className="fa-solid fa-compact-disc text-blue-500 text-2xl animate-[spin_4s_linear_infinite]"></i>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase">Music Visionary</h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase">iPhone & PC Optimized</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl z-10 flex flex-col items-center">
        {!state.result && !state.isAnalyzing && !state.isRecording && (
          <div className="text-center py-24 animate-in fade-in zoom-in duration-1000">
            <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tight leading-[0.9]">
              Luister. Ontdek.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-purple-400">Visualiseer.</span>
            </h2>
            <p className="text-zinc-500 text-lg mb-12 max-w-md mx-auto font-medium">
              Werkt nu overal: op je iPhone en op je PC.
            </p>
            <button 
              onClick={startListening}
              className="group relative px-12 py-6 bg-white text-black font-black rounded-3xl text-xl hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center gap-4">
                <i className="fa-solid fa-microphone-lines text-2xl"></i>
                NU STARTEN
              </span>
            </button>
          </div>
        )}

        {state.isRecording && (
          <div className="w-full max-w-md flex flex-col items-center gap-12 py-12">
            <div className="relative">
              <div className="w-48 h-48 bg-blue-600/20 rounded-full flex items-center justify-center animate-pulse-custom border-4 border-blue-500/30">
                <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(37,99,235,0.6)]">
                   <i className="fa-solid fa-bolt-lightning text-5xl"></i>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white text-black text-xl font-black w-14 h-14 rounded-full flex items-center justify-center border-8 border-[#0a0a0c]">
                {state.countdown}
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black mb-3">Ik luister...</h3>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Houd je telefoon bij de muziek</p>
            </div>
            <Visualizer stream={stream} isActive={state.isRecording} />
          </div>
        )}

        {state.isAnalyzing && (
          <div className="w-full max-w-md flex flex-col items-center gap-10 py-12">
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 via-white to-purple-600 animate-[loading_1.2s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black mb-3">Even geduld...</h3>
              <p className="text-zinc-500 animate-pulse font-medium italic">Ik analyseer de audio op de Gemini servers...</p>
            </div>
          </div>
        )}

        {state.error && (
          <div className="w-full max-w-md p-8 bg-red-500/5 border border-red-500/20 rounded-[2rem] flex flex-col items-center gap-6 text-center shadow-2xl backdrop-blur-sm">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
              <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
            </div>
            <div>
              <p className="font-black text-xl mb-2 tracking-tight">Oeps!</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{state.error}</p>
            </div>
            <button 
              onClick={startListening} 
              className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black transition-all border border-white/10"
            >
              PROBEER OPNIEUW
            </button>
          </div>
        )}

        {state.result && state.imageUrl && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-12 duration-1000">
            <div className="lg:col-span-5 flex flex-col gap-6">
               <div className="relative group rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-white/5 aspect-square">
                <img 
                  src={state.imageUrl} 
                  alt="AI Artwork" 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                <div className="absolute bottom-10 left-10 right-10">
                  <p className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-3">{state.result.genre}</p>
                  <h3 className="text-4xl font-black leading-none mb-2 tracking-tighter uppercase">{state.result.title}</h3>
                  <p className="text-white/60 font-bold text-lg">{state.result.artist}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {state.result.spotifyUrl && (
                  <a href={state.result.spotifyUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 py-5 bg-[#1DB954] text-black font-black rounded-3xl transition-all">
                    <i className="fa-brands fa-spotify text-2xl"></i> SPOTIFY
                  </a>
                )}
                <a href={state.result.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(state.result.artist + ' ' + state.result.title)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 py-5 bg-white text-black font-black rounded-3xl transition-all">
                  <i className="fa-brands fa-youtube text-2xl"></i> YOUTUBE
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-8">
              <div className="bg-white/[0.03] backdrop-blur-3xl p-10 rounded-[2.5rem] border border-white/5 flex flex-col shadow-2xl h-full">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3 text-white font-black text-sm uppercase tracking-widest">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    Liedtekst
                  </div>
                  {state.result.releaseDate && (
                    <span className="text-[10px] font-black text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5 uppercase">
                      {state.result.releaseDate}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[400px] pr-4 custom-scrollbar">
                  <p className="text-2xl font-serif leading-relaxed text-zinc-300 italic whitespace-pre-wrap">
                    "{state.result.lyrics}"
                  </p>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center">
                   <div className="flex flex-wrap gap-2">
                    {state.result.sources.slice(0, 1).map((source, idx) => (
                      <a key={idx} href={source.uri} target="_blank" rel="noreferrer" className="text-[10px] px-3 py-1.5 bg-white/5 text-zinc-400 rounded-lg border border-white/5 font-bold">
                        BRON: {source.title.split(' - ')[0]}
                      </a>
                    ))}
                  </div>
                  <button onClick={startListening} className="w-14 h-14 bg-white/5 hover:bg-white text-zinc-400 hover:text-black rounded-2xl flex items-center justify-center transition-all border border-white/10">
                    <i className="fa-solid fa-rotate-right text-xl"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-12 text-zinc-700 text-[10px] font-black uppercase tracking-[0.4em] text-center opacity-50">
        AI Music Discovery &bull; 2024 &bull; Cross-Platform Fix
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
