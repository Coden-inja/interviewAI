// Service to interact with Anam AI API

// Attempt to retrieve key from various environment variable patterns
const getApiKey = () => {
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

interface AnamPersonaConfig {
  name: string;
  description?: string;
  systemPrompt: string;
  avatarId?: string;
  voiceId?: string;
}

export const getOrCreatePersona = async (config: AnamPersonaConfig): Promise<string> => {
  if (!ANAM_API_KEY) {
    throw new Error("Missing ANAM_API_KEY. Please ensure it is set in your .env file.");
  }

  try {
    // 1. Check if we have a stored persona ID to update instead of creating new ones constantly
    const storedPersonaId = localStorage.getItem('anam_persona_id');
    
    if (storedPersonaId) {
      console.log("Updating existing persona:", storedPersonaId);
      const updateResponse = await fetch(`${API_BASE_URL}/personas/${storedPersonaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANAM_API_KEY}`
        },
        body: JSON.stringify({
          brain: {
            systemPrompt: config.systemPrompt
          }
        })
      });

      if (updateResponse.ok) {
        return storedPersonaId;
      } else {
        console.warn("Failed to update persona (404/400), creating new one.");
        localStorage.removeItem('anam_persona_id');
      }
    }

    // 2. Create new Persona
    console.log("Creating new persona...");
    
    // API requires systemPrompt to be nested inside a 'brain' object
    const body = {
      name: config.name,
      avatarId: config.avatarId || "121d5df1-3f3e-4a48-a237-8ff488e9eed8", 
      voiceId: config.voiceId || "b7274f87-8b72-4c5b-bf52-954768b28c75",
      llmId: "ANAM_LLAMA_v3_3_70B_V1", 
      brain: {
        systemPrompt: config.systemPrompt
      }
    };

    const response = await fetch(`${API_BASE_URL}/personas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANAM_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anam API Error: ${errorText}`);
    }

    const data = await response.json();
    localStorage.setItem('anam_persona_id', data.id);
    return data.id;

  } catch (error) {
    console.error("Error in getOrCreatePersona:", error);
    throw error;
  }
};