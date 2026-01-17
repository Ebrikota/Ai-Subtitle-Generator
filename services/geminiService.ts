
import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleEntry } from "../types";
import { timeStringToSeconds } from "../utils/srtParser";

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
      description: "An array of subtitle objects, each with a start time, end time, text, a timing explanation, and a confidence score.",
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: {
            type: Type.STRING,
            description: "Start time of the subtitle, precisely synced to the beginning of the spoken word(s). Must be in strict HH:MM:SS,mmm format, always including the HH component.",
          },
          endTime: {
            type: Type.STRING,
            description: "End time of the subtitle, precisely synced to the end of the spoken word(s). Must be in strict HH:MM:SS,mmm format, always including the HH component.",
          },
          text: {
            type: Type.STRING,
            description: "A single, short line of transcribed text. It should not exceed 23 characters.",
          },
          timing_explanation: {
            type: Type.STRING,
            description: "A brief justification for the chosen start and end times, explaining how it syncs with the audio (e.g., 'Starts as speaker begins the word')."
          },
          confidence: {
            type: Type.NUMBER,
            description: "Your confidence in the TIMING's accuracy for this specific text segment, from 0.0 (total guess) to 1.0 (perfectly certain). Base this on how clearly you can match the text to the audio.",
          }
        },
        required: ["startTime", "endTime", "text", "timing_explanation", "confidence"],
      },
    },
  },
  required: ["subtitles"],
};

interface SubtitleLine {
    startTime: string;
    endTime: string;
    text: string;
    confidence: number;
}

export const synchronizeSubtitles = async (base64Data: string, mimeType: string): Promise<SubtitleEntry[]> => {
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
            text: `You are a professional subtitle transcription and timing specialist. You will be given an audio/video file.

**YOUR TASK IS TO:**
1.  **TRANSCRIBE:** Listen carefully to the audio and transcribe the spoken words verbatim.
2.  **SEGMENT:** Break the full transcription into short, rhythmic lines suitable for subtitles. Lines should ideally be under 23 characters and break at natural pauses.
3.  **TIMING (EXTREME PRECISION):** This is your main purpose. Analyze the audio waveform with extreme care. The \`startTime\` must mark the *absolute beginning* of the audible speech for that line, and the \`endTime\` must mark the *absolute end* of the final word's sound. Timestamps MUST be in the strict \`HH:MM:SS,mmm\` format.
4.  **CONFIDENCE SCORE:** For each line, provide a \`confidence\` score from 0.0 to 1.0 based on how accurately you believe you timed the segment.
5.  **EXPLANATION:** Provide a brief \`timing_explanation\` for each line.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema,
        temperature: 0.1, 
        thinkingConfig: { thinkingBudget: 24576 },
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Request blocked for safety reasons (${blockReason}). Please use different media.`);
      }
      throw new Error('The model returned an empty response. The content may be unsupported or invalid.');
    }

    const jsonString = response.text?.trim();
    if (!jsonString) {
        throw new Error('The model returned a valid structure but with empty content. Please try again.');
    }

    const parsed = JSON.parse(jsonString);

    if (parsed && Array.isArray(parsed.subtitles)) {
      return parsed.subtitles.map((line: SubtitleLine): SubtitleEntry => {
        const startTime = timeStringToSeconds(line.startTime);
        const endTime = timeStringToSeconds(line.endTime);

        if (isNaN(startTime) || isNaN(endTime)) {
          console.warn('Invalid timestamp received from model:', line);
          return { startTime: 0, endTime: 0, text: line.text, confidence: line.confidence };
        }
        
        return {
          startTime,
          endTime,
          text: line.text,
          confidence: line.confidence,
        };
      });
    } else {
      throw new Error('The model returned an unexpected data structure. Please try again.');
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (
            message.startsWith('request blocked') || 
            message.startsWith('the model returned an empty response') ||
            message.startsWith('the model returned a valid structure') ||
            message.startsWith('the model returned an unexpected data structure')
        ) {
            throw error;
        }

        if (message.includes('api key not valid')) {
            throw new Error('The API key is invalid. Please check the application configuration.');
        }
        if (message.includes('429')) {
            throw new Error('The service is experiencing high traffic. Please wait a few moments and try again.');
        }
        if (message.includes('500') || message.includes('503') || message.includes('unavailable')) {
            throw new Error('The AI service is temporarily down. Please try again later.');
        }
        if (error instanceof SyntaxError) {
             throw new Error('The model returned a malformed response. This is often a temporary issue, please try again.');
        }
        
        throw new Error('An unexpected API error occurred. Please try again.');
    }

    throw new Error("An unknown error occurred. Please try again.");
  }
};
