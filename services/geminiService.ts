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