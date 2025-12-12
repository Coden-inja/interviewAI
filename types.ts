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
}

export interface AudioVisualizerData {
  volume: number;
}