import { AnamPersonaConfig } from '../types';

// Service to interact with Anam AI API

// Attempt to retrieve key from various environment variable patterns
export const getApiKey = () => {
  // Check process.env if it exists
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.ANAM_API_KEY) return process.env.ANAM_API_KEY;
    if (process.env.VITE_ANAM_API_KEY) return process.env.VITE_ANAM_API_KEY;
    if (process.env.REACT_APP_ANAM_API_KEY) return process.env.REACT_APP_ANAM_API_KEY;
  }
  // Check import.meta.env if available (Vite standard)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_ANAM_API_KEY) return import.meta.env.VITE_ANAM_API_KEY;
    // @ts-ignore
    if (import.meta.env.ANAM_API_KEY) return import.meta.env.ANAM_API_KEY;
  }
  
  // Fallback if environment variables are not loaded by the runner
  return "OTA5NTMzMWEtNDNiZS00M2RjLTg3NDktY2RlYWU4ZDAzOTQ0OjhRclRDd3MwUGNSQUdicmxweEZVVzN4SFhGM0FhTXRWR1NvMzh1NzZiQ0E9";
};

const ANAM_API_KEY = getApiKey();
const API_BASE_URL = "https://api.anam.ai/v1";

export const createSessionToken = async (config: AnamPersonaConfig): Promise<string> => {
  if (!ANAM_API_KEY) throw new Error("Missing API Key");

  // Validate required fields for inline configuration
  if (!config.avatarId) throw new Error("Session Config Error: avatarId is missing");
  if (!config.voiceId) throw new Error("Session Config Error: voiceId is missing");

  // Construct payload adhering to new API standards for inline persona config
  // We use inline config to support dynamic system prompts based on resume analysis
  const body = {
    personaConfig: {
      name: config.name || "Interviewer",
      avatarId: config.avatarId,
      voiceId: config.voiceId,
      llmId: config.llmId || "CUSTOMER_CLIENT_V1", // Use llmId instead of brainType
      systemPrompt: config.systemPrompt || "You are a helpful interviewer."
    }
  };

  console.log("Requesting Session Token with:", JSON.stringify(body, null, 2));

  const response = await fetch(`${API_BASE_URL}/auth/session-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANAM_API_KEY}`
    },
    body: JSON.stringify(body) 
  });

  if (!response.ok) {
     const text = await response.text();
     console.error("Session token fetch failed:", text);
     throw new Error(`Failed to get session token: ${text}`);
  }

  const data = await response.json();
  return data.sessionToken;
};