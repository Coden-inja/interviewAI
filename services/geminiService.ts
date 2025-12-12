import { GoogleGenAI } from "@google/genai";

// Helper to extract text from a file (PDF/Image) using Gemini
export const extractResumeText = async (file: File): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  // Convert file to base64
  const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
          const result = reader.result as string;
          // Remove data url prefix (e.g. "data:application/pdf;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
  });

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use Gemini 2.5 Flash for fast multimodal extraction
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data
          }
        },
        { text: "You are a data extraction engine. Extract the full text content from this resume document accurately. Output ONLY the raw text found in the document, no preamble or markdown formatting." }
      ]
    }
  });

  return response.text || "";
};

// Analyze resume and job description to create a plan
export const analyzeContext = async (resume: string, jobDesc: string) => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    You are an expert technical recruiter. 
    Analyze the following Candidate Resume and Job Description.
    
    RESUME:
    ${resume}
    
    JOB DESCRIPTION:
    ${jobDesc}
    
    Output a concise JSON object with the following structure:
    {
      "candidateName": "Extracted Name",
      "topics": ["List of 3-5 key technical topics to probe"],
      "openingLine": "A welcoming opening line introducing yourself as 'Ava', the AI interviewer."
    }
    Only output valid JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  return JSON.parse(response.text || "{}");
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Streaming chat handler for Anam integration
export const streamGeminiResponse = async function* (
  history: ChatMessage[], 
  systemPrompt: string
) {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Convert Anam/App history format to Gemini format
  // Gemini expects: { role: 'user'|'model', parts: [{ text: ... }] }
  const geminiHistory = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // Create chat with system instruction
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    },
    history: geminiHistory.slice(0, -1) // Exclude the very last message as it's the trigger
  });

  const lastMessage = history[history.length - 1];
  
  // Send the last message to get streaming response
  const result = await chat.sendMessageStream({ message: lastMessage.content });
  
  for await (const chunk of result) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
};