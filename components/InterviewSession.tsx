import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, Loader2, Signal, Play } from 'lucide-react';
import { createSessionToken } from '../services/anamService';
import { AnamPersonaConfig } from '../types';
import { streamGeminiResponse, ChatMessage } from '../services/geminiService';

interface InterviewSessionProps {
  personaConfig: AnamPersonaConfig;
  onEnd: () => void;
  initialMessage: string;
}

export const InterviewSession: React.FC<InterviewSessionProps> = ({ 
  personaConfig,
  onEnd,
  initialMessage
}) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("Initializing...");
  const [showStartButton, setShowStartButton] = useState(false);
  
  // Refs
  const videoId = "anam-video-element"; 
  const audioId = "anam-audio-element"; // Added audio element ID
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null); // Ref for audio
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const anamClientRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  // 1. Initialize User Camera (Self View)
  useEffect(() => {
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
      if (selfVideoRef.current && selfVideoRef.current.srcObject) {
        const tracks = (selfVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    };
  }, []);

  // 2. Initialize Anam Connection with Client-Side LLM Logic
  useEffect(() => {
    let isMounted = true;
    let initTimer: any;

    const connectToAnam = async () => {
      try {
        setDebugStatus("Acquiring Token...");
        console.log(`Initializing Session for: ${personaConfig.name}`);
        
        const sessionToken = await createSessionToken(personaConfig);
        
        if (!isMounted) return;

        setDebugStatus("Loading SDK...");
        // Dynamic import to use the module from index.html importmap
        const module = await import('@anam-ai/js-sdk');
        
        const createClient = module.createClient || module.default?.createClient;
        // Try to get AnamEvent enum, or fallback to strings
        const AnamEvent = module.AnamEvent || module.default?.AnamEvent || {
          VIDEO_PLAY_STARTED: 'video_play_started',
          MESSAGE_HISTORY_UPDATED: 'message_history_updated',
          CONNECTION_CLOSED: 'connection_closed'
        };

        if (!createClient) throw new Error("Could not find createClient in SDK");

        // 3. Create Client
        const client = createClient(sessionToken);
        anamClientRef.current = client;

        // --- CORE LOGIC: Client-Side LLM Handler ---
        const handleMessageUpdate = async (messageHistory: any[]) => {
            // Only process if the last message is from the user
            if (messageHistory.length === 0) return;
            const lastMessage = messageHistory[messageHistory.length - 1];
            
            if (lastMessage.role === 'user' && !isProcessingRef.current) {
                isProcessingRef.current = true;
                console.log("User spoke:", lastMessage.content);

                try {
                    // Create talk stream to make avatar speak
                    const talkStream = client.createTalkMessageStream();
                    
                    // Convert history for Gemini
                    const chatHistory: ChatMessage[] = messageHistory.map(m => ({
                        role: m.role,
                        content: m.content
                    }));

                    // Stream response from Gemini
                    const stream = streamGeminiResponse(chatHistory, personaConfig.systemPrompt);
                    
                    for await (const chunk of stream) {
                        if (talkStream.isActive()) {
                            talkStream.streamMessageChunk(chunk);
                        }
                    }
                    
                    if (talkStream.isActive()) {
                        talkStream.endMessage();
                    }

                } catch (error) {
                    console.error("LLM Generation Error:", error);
                    try {
                      client.talk("I'm sorry, I'm having trouble thinking right now.");
                    } catch(e) {}
                } finally {
                    isProcessingRef.current = false;
                }
            }
        };

        // 4. Register Event Listeners
        client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleMessageUpdate);

        // Wait for VIDEO_PLAY_STARTED to confirm the stream is actually working
        client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
          console.log("Anam Event: VIDEO_PLAY_STARTED");
          if (isMounted) {
            setIsConnected(true);
            setDebugStatus("Live");
            
            // Initial Greeting
            if (initialMessage) {
               // Small delay to ensure audio context is ready
               setTimeout(() => {
                 try {
                   console.log("Triggering greeting:", initialMessage);
                   client.talk(initialMessage);
                 } catch (e) {
                   console.warn("Greeting failed:", e);
                 }
               }, 1000);
            }
          }
        });

        client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
           if (isMounted) {
             console.log("Session ended remotely");
             // Only show error if we were connected, otherwise it might be a clean teardown
             if (isConnected) setConnectionError("Session ended");
             setIsConnected(false);
           }
        });

        // 5. Start Streaming
        setDebugStatus("Establishing Stream...");
        const videoEl = document.getElementById(videoId) as HTMLVideoElement;
        const audioEl = document.getElementById(audioId) as HTMLAudioElement;
        
        if (videoEl && audioEl) {
             videoEl.muted = true; // Video element should be muted to prevent echo if using separate audio, or just standard practice if audio is handled separately
             videoEl.playsInline = true;
             
             // Unlock Audio Context
             try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioContext();
                ctx.resume();
             } catch(e) { console.warn("AudioContext resume failed", e); }

             // Try to stream to both if SDK supports it, or just video if that covers both
             if (client.streamToVideoAndAudioElements) {
                 await client.streamToVideoAndAudioElements(videoId, audioId);
             } else {
                 await client.streamToVideoElement(videoId);
                 videoEl.muted = false; // Unmute if single element
             }
             
             // Robust Play Attempt
             try {
                 await videoEl.play();
                 if (audioEl) await audioEl.play();
             } catch (e: any) {
                 if (e.name !== 'AbortError') {
                    console.warn("Autoplay blocked, showing manual start", e);
                    setShowStartButton(true);
                    setDebugStatus("Waiting for user...");
                 }
             }
        }

      } catch (err: any) {
        console.error("Failed to connect to Anam", err);
        if (isMounted) {
          setConnectionError(err.message || "Connection failed");
          setDebugStatus("Error");
        }
      }
    };

    initTimer = setTimeout(() => {
        if (personaConfig) {
            connectToAnam();
        }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      isMounted = false;
      if (anamClientRef.current) {
        try {
          console.log("Stopping Anam Client...");
          anamClientRef.current.stopStreaming();
          // DO NOT CALL removeAllListeners - it does not exist on the client
        } catch (e) { console.error("Error stopping client:", e); }
      }
    };
  }, [personaConfig]);

  const handleManualStart = async () => {
     setShowStartButton(false);
     const videoEl = document.getElementById(videoId) as HTMLVideoElement;
     const audioEl = document.getElementById(audioId) as HTMLAudioElement;
     
     if (videoEl) {
       try {
         await videoEl.play();
         if (audioEl) await audioEl.play();
         
         if (anamClientRef.current && initialMessage) {
             anamClientRef.current.talk(initialMessage);
         }
       } catch (e) {
         console.error("Manual start failed", e);
       }
     }
  };

  const handleEndSession = () => {
    if (anamClientRef.current) {
      try { anamClientRef.current.stopStreaming(); } catch (e) {}
    }
    onEnd();
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-black overflow-hidden relative">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center pointer-events-none">
        <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-full border border-zinc-700 flex items-center gap-2 pointer-events-auto">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`}></div>
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            {isConnected ? 'LIVE SESSION' : debugStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row h-full">
        
        {/* Main Stage: Anam Avatar */}
        <div className="relative flex-1 bg-zinc-900 overflow-hidden flex items-center justify-center">
          
          <video 
            id={videoId}
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            poster={personaConfig.avatarId === "30fa96d0-26c4-4e55-94a0-517025942e18" ? 
              "https://lab.anam.ai/persona_thumbnails/cara_windowsofacorner.png" : 
              "https://lab.anam.ai/persona_thumbnails/leo_windowsofacorner.png"
            }
          />
          <audio id={audioId} ref={audioRef} className="hidden" />

          {/* Manual Start Overlay */}
          {(!isConnected || showStartButton) && debugStatus !== "Error" && (
             <div className={`absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-50 backdrop-blur-sm transition-opacity duration-500 ${isConnected && !showStartButton ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                
                {!isConnected && !showStartButton && (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                    <p className="text-emerald-400 font-mono text-sm tracking-widest font-bold">INITIALIZING AVATAR STREAM</p>
                    <p className="text-zinc-500 text-xs mt-2">{debugStatus}</p>
                  </div>
                )}

                {showStartButton && (
                  <button 
                    onClick={handleManualStart}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-lg shadow-2xl flex items-center gap-2 transform transition hover:scale-105 animate-bounce"
                  >
                     <Play fill="currentColor" />
                     Start Interview
                  </button>
                )}
             </div>
          )}

          {/* Error Overlay */}
          {connectionError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-50 text-center p-6">
              <Signal className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
              <p className="text-red-400 font-mono text-sm mb-6">{connectionError}</p>
              <button onClick={handleEndSession} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-medium">
                Return to Setup
              </button>
            </div>
          )}
          
          {/* Avatar Name Tag */}
          <div className="absolute bottom-8 left-8 z-10 pointer-events-none">
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">{personaConfig.name}</h2>
            <p className="text-emerald-400 font-mono text-sm uppercase tracking-wider">HR Interviewer • AI Agent</p>
          </div>

        </div>

        {/* Sidebar */}
        <div className="md:w-96 bg-zinc-950 border-l border-zinc-800 flex flex-col p-4 gap-4 z-30 shadow-2xl">
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

          <div className="flex-1 bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 overflow-hidden flex flex-col relative">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                 <Volume2 className="w-3 h-3" />
                 Interview Plan
               </h3>
               <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800/50">
                  <p className="text-xs text-emerald-500 font-bold mb-1">OBJECTIVE</p>
                  <p className="text-zinc-400 text-sm leading-relaxed">{personaConfig.systemPrompt ? personaConfig.systemPrompt.split("# Goal")[1]?.slice(0, 150) + "..." : "Loading plan..."}</p>
                </div>
                <div className="p-3 bg-blue-950/20 rounded-lg border border-blue-900/30">
                  <p className="text-xs text-blue-400 font-bold mb-1">AI ({personaConfig.name})</p>
                  <p className="text-zinc-300 text-sm">{initialMessage}</p>
                </div>
             </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 flex justify-between items-center shadow-lg border border-zinc-800">
            <button 
              onClick={() => {
                setIsMicOn(!isMicOn);
                if (anamClientRef.current?.setMicMuted) anamClientRef.current.setMicMuted(isMicOn);
              }}
              className={`p-4 rounded-full transition-all duration-200 ${isMicOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button 
              onClick={() => setIsCameraOn(!isCameraOn)}
              className={`p-4 rounded-full transition-all duration-200 ${isCameraOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
            >
              {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button 
              onClick={handleEndSession}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20 transform hover:scale-105"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};