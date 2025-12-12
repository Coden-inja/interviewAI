import React, { useState, useEffect } from 'react';
import { Upload, Briefcase, ArrowRight, Loader2, FileType, Trash2, Database, UserCircle2 } from 'lucide-react';
import { InterviewContext, AvatarOption } from '../types';
import { extractResumeText } from '../services/geminiService';

interface SetupFormProps {
  onSubmit: (data: InterviewContext) => void;
  isLoading: boolean;
}

const AVATARS: AvatarOption[] = [
  {
    id: "30fa96d0-26c4-4e55-94a0-517025942e18",
    name: "Cara",
    voiceId: "6bfbe25a-979d-40f3-a92b-5394170af54b", // Female voice
    thumbnailUrl: "https://lab.anam.ai/persona_thumbnails/cara_windowsofacorner.png" // Placeholder or known URL
  },
  {
    id: "121d5df1-3f3e-4a48-a237-8ff488e9eed8",
    name: "Leo",
    voiceId: "b7274f87-8b72-4c5b-bf52-954768b28c75", // Male voice
    thumbnailUrl: "https://lab.anam.ai/persona_thumbnails/leo_windowsofacorner.png"
  },
  {
    id: "a49abb10-9a29-4099-b950-e68534742fb2",
    name: "Maya",
    voiceId: "6bfbe25a-979d-40f3-a92b-5394170af54b", // Using same female voice as Cara for now
    thumbnailUrl: "https://lab.anam.ai/persona_thumbnails/maya_windowsofacorner.png" // Placeholder
  }
];

export const SetupForm: React.FC<SetupFormProps> = ({ onSubmit, isLoading }) => {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(AVATARS[1].id); // Default to Leo

  // Load from Local Storage on mount
  useEffect(() => {
    const savedResume = localStorage.getItem('interview_resume_text');
    const savedJob = localStorage.getItem('interview_job_desc');
    const savedFileName = localStorage.getItem('interview_file_name');
    const savedAvatar = localStorage.getItem('interview_avatar_id');

    if (savedResume || savedJob) {
      if (savedResume) setResumeText(savedResume);
      if (savedJob) setJobDescription(savedJob);
      if (savedFileName) setFileName(savedFileName);
      if (savedAvatar) setSelectedAvatarId(savedAvatar);
      setIsRestored(true);
      
      // Clear the "Restored" badge after 3 seconds
      setTimeout(() => setIsRestored(false), 3000);
    }
  }, []);

  // Save to Local Storage whenever values change
  useEffect(() => {
    localStorage.setItem('interview_resume_text', resumeText);
  }, [resumeText]);

  useEffect(() => {
    localStorage.setItem('interview_job_desc', jobDescription);
  }, [jobDescription]);

  useEffect(() => {
    localStorage.setItem('interview_file_name', fileName);
  }, [fileName]);
  
  useEffect(() => {
    localStorage.setItem('interview_avatar_id', selectedAvatarId);
  }, [selectedAvatarId]);

  const clearStorage = () => {
    if (confirm("Are you sure you want to clear your saved resume and job details?")) {
      localStorage.removeItem('interview_resume_text');
      localStorage.removeItem('interview_job_desc');
      localStorage.removeItem('interview_file_name');
      localStorage.removeItem('anam_persona_id');
      localStorage.removeItem('interview_avatar_id');
      setResumeText('');
      setJobDescription('');
      setFileName('');
      setSelectedAvatarId(AVATARS[1].id);
      setIsRestored(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setIsExtracting(true);

    try {
      let text = '';
      if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        text = await extractResumeText(file);
      }
      setResumeText(text);
    } catch (error) {
      console.error("Extraction failed", error);
      alert("Failed to read file. Please try pasting the text manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText || !jobDescription) return;
    onSubmit({
      resumeText,
      jobDescription,
      candidateName: "Candidate",
      avatarId: selectedAvatarId
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl relative">
      {/* Restore Indicator */}
      {isRestored && (
        <div className="absolute -top-12 left-0 right-0 flex justify-center animate-fade-in-down">
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-md">
            <Database className="w-4 h-4" />
            Restored previous session data
          </div>
        </div>
      )}

      <button 
        onClick={clearStorage}
        className="absolute top-6 right-6 p-2 text-zinc-600 hover:text-red-400 transition-colors"
        title="Clear saved data"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Configure Your Interview
        </h2>
        <p className="text-zinc-400 mt-2">Upload your resume and select your interviewer.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Avatar Selection */}
        <div className="space-y-2">
           <label className="block text-sm font-medium text-zinc-300">
             Choose Interviewer
           </label>
           <div className="grid grid-cols-3 gap-4">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatarId(avatar.id)}
                  className={`relative p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 group ${selectedAvatarId === avatar.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}
                >
                  <div className={`w-16 h-16 rounded-full overflow-hidden bg-zinc-800 ${selectedAvatarId === avatar.id ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black' : 'group-hover:ring-2 group-hover:ring-zinc-600'}`}>
                    {/* Placeholder colored circles if images fail */}
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        <UserCircle2 className="w-10 h-10 text-zinc-600" />
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${selectedAvatarId === avatar.id ? 'text-white' : 'text-zinc-400'}`}>
                    {avatar.name}
                  </span>
                  {selectedAvatarId === avatar.id && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  )}
                </button>
              ))}
           </div>
        </div>

        {/* Resume Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Resume / CV
          </label>
          <div className="relative group">
            <input 
              type="file" 
              accept=".txt,.md,.json,.csv,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              disabled={isExtracting || isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className={`p-6 border-2 border-dashed rounded-xl transition-colors ${fileName ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800'}`}>
              <div className="flex flex-col items-center justify-center text-zinc-400">
                {isExtracting ? (
                  <>
                    <Loader2 className="w-8 h-8 text-emerald-400 mb-2 animate-spin" />
                    <span className="text-emerald-300 font-medium animate-pulse">Extracting text...</span>
                  </>
                ) : fileName ? (
                  <>
                    <FileType className="w-8 h-8 text-emerald-400 mb-2" />
                    <span className="text-emerald-300 font-medium">{fileName}</span>
                    <span className="text-xs text-emerald-500/70 mt-1">Click to replace</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 group-hover:text-blue-400 transition-colors" />
                    <span className="text-sm">Click to upload (PDF, Image, Text)</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-center text-xs text-zinc-500 my-2">- OR -</div>

          <textarea 
            className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:opacity-50 font-mono"
            placeholder={isExtracting ? "Extracting text from your file..." : "Paste your resume text here..."}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            disabled={isExtracting}
          />
        </div>

        {/* Job Description Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Job Description
          </label>
          <div className="relative">
            <Briefcase className="absolute top-3 left-3 w-5 h-5 text-zinc-500" />
            <textarea 
              className="w-full h-32 pl-10 bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="Paste the job requirements here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!resumeText || !jobDescription || isLoading || isExtracting}
          className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center space-x-2 transition-all
            ${(!resumeText || !jobDescription || isLoading || isExtracting) 
              ? 'bg-zinc-800 cursor-not-allowed text-zinc-500' 
              : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}`}
        >
          {isLoading ? (
            <span className="animate-pulse">Starting Session...</span>
          ) : (
            <>
              <span>Start Interview</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};