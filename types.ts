export enum AppState {
  SETUP = 'SETUP',
  ANALYZING = 'ANALYZING',
  INTERVIEW = 'INTERVIEW',
  FINISHED = 'FINISHED'
}

export interface InterviewContext {
  resumeText: string;
  jobDescription: string;
  candidateName: string;
  avatarId: string;
}

export interface AudioVisualizerData {
  volume: number;
}

export interface AvatarOption {
  id: string;
  name: string;
  voiceId: string;
  thumbnailUrl: string;
  personaPreset?: string;
}

export interface AnamPersonaConfig {
  name: string;
  description?: string;
  systemPrompt: string;
  avatarId?: string;
  voiceId?: string;
  personaPreset?: string;
  llmId?: string;
}