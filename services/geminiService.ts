
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const subtitleSchema = {
  type: Type.OBJECT,
  properties: {
    subtitles: {
      type: Type.ARRAY,
      description: "An array of subtitle objects, each with a start time, end time, and text.",
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: {
            type: Type.STRING,
            description: "Start time of the subtitle in HH:MM:SS,mmm format.",
          },
          endTime: {
            type: Type.STRING,
            description: "End time of the subtitle in HH:MM:SS,mmm format.",
          },
          text: {
            type: Type.STRING,
            description: "A single, short line of transcribed text. It should not exceed 15 characters, unless a single word is longer than 15 characters.",
          },
        },
        required: ["startTime", "endTime", "text"],
      },
    },
  },
  required: ["subtitles"],
};

interface SubtitleLine {
    startTime: string;
    endTime: string;
    text: string;
}

export const generateSubtitles = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "You are an expert subtitle creator. Transcribe the audio from the provided file with the highest accuracy. Pay close attention to the entire audio, including any words at the very beginning. Your output must be a JSON object that adheres to the provided schema. For each subtitle entry, provide a precise 'startTime' and 'endTime' in HH:MM:SS,mmm format. The 'text' for each subtitle line must not exceed 15 characters. However, if a single word is longer than 15 characters, place that word on its own line. Do not split words. Break down long sentences into smaller, digestible chunks that respect this character limit rule.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema,
      },
    });

    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);

    if (parsed && Array.isArray(parsed.subtitles)) {
      return parsed.subtitles
        .map((line: SubtitleLine, index: number) => {
          return `${index + 1}\n${line.startTime} --> ${line.endTime}\n${line.text}`;
        })
        .join('\n\n');
    } else {
      throw new Error('Invalid response format from API. Expected a JSON object with a "subtitles" array.');
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        if (error.message.includes('JSON')) {
             throw new Error('The model returned an invalid JSON response. Please try again.');
        }
        throw new Error(`API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the API.");
  }
};
