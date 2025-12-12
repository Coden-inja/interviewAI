import React, { useState } from 'react';
import { SetupForm } from './components/SetupForm';
import { InterviewSession } from './components/InterviewSession';
import { AppState, InterviewContext } from './types';
import { analyzeContext } from './services/geminiService';
import { Brain, Sparkles, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [context, setContext] = useState<InterviewContext | null>(null);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [initialOpening, setInitialOpening] = useState('');

  const handleSetupSubmit = async (data: InterviewContext) => {
    setContext(data);
    setAppState(AppState.ANALYZING);

    try {
      const analysis = await analyzeContext(data.resumeText, data.jobDescription);
      
      // Construct the comprehensive system instruction for the Live model
      const instruction = `
        You are Ava, a highly intelligent and professional technical interviewer.
        Your voice should be professional yet warm (using the Kore voice).
        
        CONTEXT:
        The user is a candidate named ${analysis.candidateName || 'the candidate'}.
        They are applying for a job described as follows:
        ${data.jobDescription}

        RESUME HIGHLIGHTS:
        ${data.resumeText.slice(0, 2000)}... (truncated for brevity)
        
        INTERVIEW PLAN:
        Focus on these topics: ${analysis.topics?.join(', ') || 'General Technical Skills'}.

        INSTRUCTIONS:
        1. Start by introducing yourself briefly as Ava and setting the stage.
        2. Ask ONE question at a time.
        3. Listen to the user's answer thoroughly.
        4. If the answer is vague, ask follow-up questions.
        5. Be encouraging but rigorous.
        6. Keep your responses concise (under 30 seconds) to maintain a natural flow.
        7. Do not hallucinate qualifications not in the resume.
        
        GOAL:
        Assess if the candidate is a good fit for the role described.
      `;

      setSystemInstruction(instruction);
      setInitialOpening(analysis.openingLine || "Hello! I'm Ava. Let's start.");
      setAppState(AppState.INTERVIEW);

    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to analyze resume. Please check your API Key.");
      setAppState(AppState.SETUP);
    }
  };

  const handleEndInterview = () => {
    setAppState(AppState.FINISHED);
  };

  const handleReset = () => {
    setAppState(AppState.SETUP);
    setContext(null);
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
              Practice your next technical interview with <span className="text-emerald-400 font-semibold">Ava</span>, 
              an AI powered by Gemini Live that sees, hears, and remembers context.
            </p>
        </div>

        <div className="z-10 w-full">
          <SetupForm onSubmit={handleSetupSubmit} isLoading={appState === AppState.ANALYZING} />
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-zinc-500 text-sm max-w-4xl z-10">
           <div className="flex flex-col items-center gap-2">
              <Brain className="w-6 h-6 text-zinc-400" />
              <p>Context-Aware Memory</p>
           </div>
           <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6 text-zinc-400" />
              <p>Real-time Voice Interaction</p>
           </div>
           <div className="flex flex-col items-center gap-2">
              <MessageSquare className="w-6 h-6 text-zinc-400" />
              <p>Instant Feedback</p>
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
        onEnd={handleEndInterview}
        initialMessage={initialOpening}
      />
    );
  }

  // Finished Screen
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-4xl font-bold text-white mb-6">Interview Complete</h2>
      <p className="text-zinc-400 mb-8 max-w-md">
        Great job practicing! In a full version, this screen would show a detailed breakdown of your performance, sentiment analysis, and technical score.
      </p>
      <button 
        onClick={handleReset}
        className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
      >
        Start New Interview
      </button>
    </div>
  );
};

export default App;