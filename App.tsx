import React, { useState } from 'react';
import { SetupForm } from './components/SetupForm';
import { InterviewSession } from './components/InterviewSession';
import { AppState, InterviewContext } from './types';
import { analyzeContext } from './services/geminiService';
import { getOrCreatePersona } from './services/anamService';
import { Brain, Sparkles, MessageSquare, Loader2, CheckCircle2, Database } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [context, setContext] = useState<InterviewContext | null>(null);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [initialOpening, setInitialOpening] = useState('');
  const [personaId, setPersonaId] = useState<string>('');
  
  // Loading States
  const [loadingStep, setLoadingStep] = useState(0); // 0: Idle, 1: Analyzing, 2: Configuring Persona, 3: Done

  const handleSetupSubmit = async (data: InterviewContext) => {
    setContext(data);
    setAppState(AppState.ANALYZING);
    setLoadingStep(1);

    try {
      // 1. Analyze Context with Gemini
      const analysis = await analyzeContext(data.resumeText, data.jobDescription);
      
      setLoadingStep(2);
      
      const prompt = `
# Personality

You are Leo, a professional technical recruiter.
You are inquisitive, fair, and professional, but also encouraging and warm.
You have analyzed the candidate's resume and the job description to conduct a targeted interview.

# Environment

You are conducting a video interview with a candidate named ${analysis.candidateName || 'Candidate'}.
You are the first screener for the role.

# Tone

Your responses are clear, concise, and spoken naturally.
You ask one question at a time.
You keep responses brief (under 3 sentences) to allow for natural back-and-forth conversation.
You do not use markdown or bullet points in your speech, as it is being spoken.

# Goal

Your goal is to assess the candidate's fit for the following Job Description:
"${data.jobDescription.slice(0, 300)}..."

Based on their Resume Summary:
"${data.resumeText.slice(0, 300)}..."

Specific Topics to Cover:
${analysis.topics?.join(', ') || 'Experience, Skills, Cultural Fit'}

Protocol:
1. Start by welcoming the candidate and introducing yourself as Leo.
2. Ask questions about the topics listed above.
3. Dig deeper if the answer is vague.
4. If the candidate struggles, offer a small hint or move to the next topic.
      `;

      setSystemInstruction(prompt);
      setInitialOpening(analysis.openingLine || "Hello! I'm Leo. Shall we begin?");

      // 2. Setup Anam Persona
      const id = await getOrCreatePersona({
        name: "Leo",
        systemPrompt: prompt,
        avatarId: "121d5df1-3f3e-4a48-a237-8ff488e9eed8",
        voiceId: "b7274f87-8b72-4c5b-bf52-954768b28c75" 
      });
      
      setPersonaId(id);
      setLoadingStep(3);
      
      // Slight delay to let user see "Ready"
      setTimeout(() => {
        setAppState(AppState.INTERVIEW);
      }, 800);

    } catch (error) {
      console.error("Setup failed", error);
      alert("Failed to initialize interview session. Please try again.");
      setAppState(AppState.SETUP);
      setLoadingStep(0);
    }
  };

  const handleEndInterview = () => {
    setAppState(AppState.FINISHED);
  };

  const handleReset = () => {
    setAppState(AppState.SETUP);
    setContext(null);
    setLoadingStep(0);
  };

  // Setup Screen (Background)
  if (appState === AppState.SETUP || appState === AppState.ANALYZING) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 relative overflow-hidden flex flex-col items-center justify-center p-4">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),rgba(0,0,0,0))]" />
        
        <div className="z-10 w-full max-w-4xl mb-12 text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
              Hyperion Interviewer
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
              Practice your next technical interview with <span className="text-emerald-400 font-semibold">Leo</span>, 
              an AI powered by Anam that sees, hears, and remembers context.
            </p>
        </div>

        {appState === AppState.ANALYZING && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
             <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6">
                <h3 className="text-xl font-bold text-center text-white mb-6">Preparing Session</h3>
                
                <div className="space-y-4">
                  {/* Step 1: Gemini Analysis */}
                  <div className="flex items-center gap-4">
                     {loadingStep > 1 ? (
                       <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                     ) : loadingStep === 1 ? (
                       <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                     ) : (
                       <div className="w-6 h-6 rounded-full border-2 border-zinc-700" />
                     )}
                     <div className={loadingStep === 1 ? "text-white" : "text-zinc-500"}>
                        <p className="font-medium">Analyzing Resume & Job</p>
                        <p className="text-xs">Extracting topics via Gemini Flash 2.5</p>
                     </div>
                  </div>

                  {/* Step 2: Anam Persona */}
                  <div className="flex items-center gap-4">
                     {loadingStep > 2 ? (
                       <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                     ) : loadingStep === 2 ? (
                       <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                     ) : (
                       <div className="w-6 h-6 rounded-full border-2 border-zinc-700" />
                     )}
                     <div className={loadingStep === 2 ? "text-white" : "text-zinc-500"}>
                        <p className="font-medium">Configuring Avatar</p>
                        <p className="text-xs">Generating Persona & Voice Model</p>
                     </div>
                  </div>

                  {/* Step 3: Ready */}
                  <div className="flex items-center gap-4">
                     {loadingStep === 3 ? (
                       <CheckCircle2 className="w-6 h-6 text-emerald-500 animate-bounce" />
                     ) : (
                       <div className="w-6 h-6 rounded-full border-2 border-zinc-700" />
                     )}
                     <div className={loadingStep === 3 ? "text-emerald-400" : "text-zinc-500"}>
                        <p className="font-medium">Ready to Interview</p>
                     </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        <div className="z-10 w-full">
          <SetupForm onSubmit={handleSetupSubmit} isLoading={appState === AppState.ANALYZING} />
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-zinc-500 text-sm max-w-4xl z-10">
           <div className="flex flex-col items-center gap-2">
              <Brain className="w-6 h-6 text-zinc-400" />
              <p>Gemini Analysis</p>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-zinc-400" />
              <p>Anam Live Avatar</p>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Database className="w-6 h-6 text-zinc-400" />
              <p>Persistent Context</p>
           </div>
        </div>
      </div>
    );
  }

  // Interview Screen
  if (appState === AppState.INTERVIEW) {
    return (
      <InterviewSession 
        systemInstruction={systemInstruction} 
        personaId={personaId}
        onEnd={handleEndInterview}
        initialMessage={initialOpening}
      />
    );
  }

  // Finished Screen
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1),rgba(0,0,0,0))]" />
      
      <div className="relative z-10 bg-zinc-900/50 backdrop-blur border border-zinc-800 p-8 rounded-2xl max-w-lg w-full">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-white mb-2">Interview Complete</h2>
        <p className="text-zinc-400 mb-8">
          Great job practicing! Leo has logged your session notes. You can restart to practice a different scenario or refine your answers.
        </p>
        <button 
          onClick={handleReset}
          className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
        >
          Start New Interview
        </button>
      </div>
    </div>
  );
};

export default App;