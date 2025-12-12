import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, Loader2, Signal } from 'lucide-react';

interface InterviewSessionProps {
  systemInstruction: string;
  personaId: string;
  onEnd: () => void;
  initialMessage: string;
}

export const InterviewSession: React.FC<InterviewSessionProps> = ({ 
  systemInstruction, 
  personaId,
  onEnd,
  initialMessage
}) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs for Anam Video
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 1. Initialize User Camera (Self View)
    const startUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (selfVideoRef.current) {
          selfVideoRef.current.srcObject = stream;
          await selfVideoRef.current.play();
        }
      } catch (e) {
        console.error("Failed to access user media", e);
      }
    };
    startUserMedia();

    return () => {
      // Cleanup user media
      if (selfVideoRef.current && selfVideoRef.current.srcObject) {
        const tracks = (selfVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    // 2. Initialize Anam Connection
    let isMounted = true;

    const connectToAnam = async () => {
      try {
        console.log(`Connecting to Anam Persona: ${personaId}`);
        
        // Remove artificial delay to improve perceived speed
        // In a real implementation: await anamClient.connect(personaId)
        
        if (isMounted) {
          setIsConnected(true);
          if (videoRef.current) {
             videoRef.current.play().catch(() => {});
          }
        }
      } catch (err) {
        console.error("Failed to connect to Anam", err);
      }
    };

    connectToAnam();

    return () => {
      isMounted = false;
    };
  }, [personaId]);


  return (
    <div className="flex flex-col h-screen max-h-screen bg-black overflow-hidden relative">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center pointer-events-none">
        <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-full border border-zinc-700 flex items-center gap-2 pointer-events-auto">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`}></div>
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            {isConnected ? 'LIVE SESSION' : 'ESTABLISHING UPLINK...'}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row h-full">
        
        {/* Main Stage: Anam Avatar */}
        <div className="relative flex-1 bg-zinc-900 overflow-hidden flex items-center justify-center">
          
          {/* Anam Video Element */}
          <video 
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            poster="https://lab.anam.ai/persona_thumbnails/leo_windowsofacorner.png" // Use static poster for immediate feedback
          />

          {/* Fallback / Loading Overlay - Shows until fully connected */}
          {!isConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-50">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Signal className="w-6 h-6 text-emerald-500 animate-pulse" />
                </div>
              </div>
              <p className="text-emerald-400 font-mono text-sm tracking-widest font-bold">INITIALIZING AVATAR STREAM</p>
              <p className="text-zinc-500 text-xs mt-2">Connecting to Persona ID: {personaId.slice(0, 8)}...</p>
            </div>
          )}

          {/* Connected but waiting for stream visual placeholder */}
          {isConnected && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 animate-fade-in">
                 {/* This handles the split second gap if stream isn't ready immediately */}
            </div>
          )}
          
          {/* Avatar Name Tag */}
          <div className="absolute bottom-8 left-8 z-10">
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">Leo</h2>
            <p className="text-emerald-400 font-mono text-sm uppercase tracking-wider">HR Interviewer • AI Agent</p>
          </div>

        </div>

        {/* Sidebar: Self View & Controls */}
        <div className="md:w-96 bg-zinc-950 border-l border-zinc-800 flex flex-col p-4 gap-4 z-30 shadow-2xl">
          
          {/* Self View */}
          <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-inner group">
             <video 
               ref={selfVideoRef} 
               muted 
               playsInline 
               className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraOn ? 'opacity-0' : 'opacity-100'}`} 
             />
             {!isCameraOn && (
               <div className="absolute inset-0 flex items-center justify-center text-zinc-600 bg-zinc-900">
                 <VideoOff className="w-10 h-10" />
               </div>
             )}
             <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white font-medium backdrop-blur">
                YOU
             </div>
          </div>

          {/* Context Memory */}
          <div className="flex-1 bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 overflow-hidden flex flex-col relative">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                 <Volume2 className="w-3 h-3" />
                 Interview Plan
               </h3>
               <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {/* Initial Plan */}
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800/50">
                  <p className="text-xs text-emerald-500 font-bold mb-1">OBJECTIVE</p>
                  <p className="text-zinc-400 text-sm leading-relaxed">{systemInstruction ? systemInstruction.split("# Goal")[1]?.slice(0, 150) + "..." : "Loading plan..."}</p>
                </div>
                
                {/* Simulated Conversation Items */}
                <div className="p-3 bg-blue-950/20 rounded-lg border border-blue-900/30">
                  <p className="text-xs text-blue-400 font-bold mb-1">AI (Leo)</p>
                  <p className="text-zinc-300 text-sm">{initialMessage}</p>
                </div>
             </div>

             {/* Zep Gradient Overlay */}
             <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
          </div>

          {/* Control Bar */}
          <div className="bg-zinc-900 rounded-2xl p-4 flex justify-between items-center shadow-lg border border-zinc-800">
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-4 rounded-full transition-all duration-200 ${isMicOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
              title={isMicOn ? "Mute Microphone" : "Unmute"}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            <button 
              onClick={() => setIsCameraOn(!isCameraOn)}
              className={`p-4 rounded-full transition-all duration-200 ${isCameraOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
              title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            <button 
              onClick={onEnd}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20 transform hover:scale-105 transition-all duration-200"
              title="End Interview"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};