import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AudioVisualizer } from './AudioVisualizer';
import { createPcmBlob, decode, decodeAudioData } from '../services/audioUtils';

interface InterviewSessionProps {
  systemInstruction: string;
  onEnd: () => void;
  initialMessage: string;
}

export const InterviewSession: React.FC<InterviewSessionProps> = ({ 
  systemInstruction, 
  onEnd,
  initialMessage
}) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Video Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cleanupFunc: () => void = () => {};

    const startSession = async () => {
      try {
        if (!process.env.API_KEY) throw new Error("API Key not found");
        
        // 1. Setup Audio Contexts
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        inputAudioContextRef.current = inputCtx;
        outputAudioContextRef.current = outputCtx;

        // 2. Setup Analysers for Visualizers
        const inputAnalyser = inputCtx.createAnalyser();
        inputAnalyser.fftSize = 256;
        inputAnalyserRef.current = inputAnalyser;

        const outputAnalyser = outputCtx.createAnalyser();
        outputAnalyser.fftSize = 256;
        outputAnalyserRef.current = outputAnalyser;

        // 3. Connect to Gemini Live
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: systemInstruction,
          },
          callbacks: {
            onopen: async () => {
              setIsConnected(true);
              
              // Get User Media
              const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: { width: 320, height: 240 } // Low res is fine for analysis
              });
              streamRef.current = stream;

              // Setup Audio Input Stream
              const source = inputCtx.createMediaStreamSource(stream);
              const gainNode = inputCtx.createGain();
              inputGainRef.current = gainNode;
              
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              source.connect(gainNode);
              gainNode.connect(inputAnalyser); // For visualizer
              gainNode.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);

              scriptProcessor.onaudioprocess = (e) => {
                if (!isMicOn) return; // Software mute
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              // Setup Video Input Stream (Simulated via frames)
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                
                // Send video frames periodically
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 320;
                canvas.height = 240;

                videoIntervalRef.current = window.setInterval(() => {
                  if (!isCameraOn || !videoRef.current || !ctx) return;
                  ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                  const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                  
                  sessionPromise.then(session => {
                    session.sendRealtimeInput({ 
                      media: { mimeType: 'image/jpeg', data: base64 } 
                    });
                  });
                }, 1000); // 1 FPS to save bandwidth/tokens
              }
            },
            onmessage: async (msg: LiveServerMessage) => {
              const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData) {
                // Audio Output Handling
                const outputCtx = outputAudioContextRef.current;
                if (!outputCtx) return;

                const audioBuffer = await decodeAudioData(
                  decode(audioData),
                  outputCtx,
                  24000,
                  1
                );

                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                // Connect to analyser for AI visualizer
                if (outputAnalyserRef.current) {
                  source.connect(outputAnalyserRef.current);
                  outputAnalyserRef.current.connect(outputCtx.destination);
                } else {
                  source.connect(outputCtx.destination);
                }

                // Schedule playback
                const now = outputCtx.currentTime;
                // If nextStartTime is in the past, reset it to now
                if (nextStartTimeRef.current < now) {
                  nextStartTimeRef.current = now;
                }
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }

              // Handle Interruptions
              if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => {
                  try { s.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onclose: () => {
              setIsConnected(false);
              onEnd();
            },
            onerror: (err) => {
              console.error(err);
              setError("Connection error");
            }
          }
        });

        cleanupFunc = () => {
            sessionPromise.then(s => s.close()); // Close session
            // Stop tracks
            streamRef.current?.getTracks().forEach(t => t.stop());
            // Clear intervals
            if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
            // Close contexts
            inputCtx.close();
            outputCtx.close();
        };

      } catch (err) {
        console.error(err);
        setError("Failed to initialize session. Make sure API Key is set.");
      }
    };

    startSession();

    return () => cleanupFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Toggle Mute
  useEffect(() => {
    if (inputGainRef.current) {
      inputGainRef.current.gain.value = isMicOn ? 1 : 0;
    }
  }, [isMicOn]);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-black overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        
        {/* Left: AI Avatar (Main Focus) */}
        <div className="flex-1 relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 flex flex-col items-center justify-center shadow-2xl">
          <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur px-3 py-1 rounded-full border border-zinc-700">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              AI Interviewer • Ava
            </span>
          </div>
          
          <div className="w-full h-full max-w-2xl max-h-2xl p-8">
             {/* This visualizer uses the output context (AI voice) */}
             <AudioVisualizer 
                isActive={isConnected} 
                isSpeaking={true} 
                analyser={outputAnalyserRef.current || undefined}
                color="#34D399" // Emerald
             />
          </div>

          {!isConnected && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
               <div className="flex flex-col items-center animate-pulse">
                 <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-emerald-400 font-mono text-sm">ESTABLISHING UPLINK...</p>
               </div>
            </div>
          )}
        </div>

        {/* Right: User Feed & Controls */}
        <div className="md:w-80 flex flex-col gap-4">
          
          {/* User Video Feed */}
          <div className="h-48 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative shadow-lg">
             <video 
               ref={videoRef} 
               muted 
               playsInline 
               className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraOn ? 'hidden' : ''}`} 
             />
             {!isCameraOn && (
               <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                 <VideoOff className="w-8 h-8" />
               </div>
             )}
             
             {/* Audio Visualizer Overlay for User */}
             <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent p-2">
                <div className="h-full w-full opacity-70">
                  <AudioVisualizer 
                    isActive={isMicOn} 
                    isSpeaking={isMicOn} 
                    analyser={inputAnalyserRef.current || undefined}
                    color="#60A5FA" // Blue
                  />
                </div>
             </div>
          </div>

          {/* Transcript / Context Placeholder */}
          <div className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800 p-4 overflow-y-auto">
             <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3">Live Transcript</h3>
             <p className="text-zinc-400 text-sm italic">
               (Real-time transcript not available in this preview mode - rely on audio)
             </p>
             <div className="mt-4 p-3 bg-zinc-950/50 rounded border border-zinc-800/50">
                <p className="text-xs text-blue-400 font-mono mb-1">SYSTEM:</p>
                <p className="text-zinc-300 text-sm">{initialMessage}</p>
             </div>
          </div>

          {/* Controls */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex justify-between items-center shadow-lg">
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-3 rounded-full transition-all ${isMicOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
            >
              {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button 
              onClick={() => setIsCameraOn(!isCameraOn)}
              className={`p-3 rounded-full transition-all ${isCameraOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
            >
              {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button 
              onClick={onEnd}
              className="p-3 rounded-full bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-xl text-sm font-medium backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
};