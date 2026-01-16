
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
            description: "A single, short line of transcribed text. It should not exceed 23 characters, unless a single word is longer than 23 characters.",
          },
          timing_explanation: {
            type: Type.STRING,
            description: "A brief justification for the chosen start and end times, explaining how it syncs with the audio (e.g., 'Starts as speaker begins the word')."
          },
          confidence: {
            type: Type.NUMBER,
            description: "Your confidence in the transcription's accuracy, from 0.0 (total guess) to 1.0 (perfectly certain). Base this on audio clarity, background noise, and accent.",
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

export const generateSubtitles = async (base64Data: string, mimeType: string): Promise<SubtitleEntry[]> => {
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
            text: `You are a professional subtitling expert, acting as both a transcriptionist and a timing specialist. Your primary goal is to create subtitles that are exceptionally accurate and perfectly synchronized. The transcription must be a literal, verbatim record of the speech. The timing must be frame-perfect to enhance viewer immersion.

Your output must be a JSON object adhering to the schema. For each subtitle entry, follow these rules with extreme prejudice:

1.  **Accuracy (Highest Priority):** Transcribe the speech literally and verbatim. You MUST include filler words ('um', 'uh'), stutters, and grammatical errors exactly as they are spoken. Do not correct, paraphrase, or summarize the speaker's words. The text must be an exact representation of the audio.
2.  **Timing (Extreme Precision Required):** Human perception of audio-visual sync is sensitive to millisecond-level errors. Your timing must be flawless. Analyze the audio waveform with extreme care. The \`startTime\` must mark the *absolute beginning* of the audible speech for that line, and the \`endTime\` must mark the *absolute end* of the final word's sound. Do not include silence or breaths at the beginning or end of a clip. Timestamps MUST be in the strict \`HH:MM:SS,mmm\` format. Double-check your timings before finalizing.
3.  **Text Formatting:** Keep lines short, ideally under 23 characters. Do not split words across lines. A single word longer than 23 characters is acceptable on its own line. Break lines at natural pauses in speech to improve readability.
4.  **Confidence Score (Mandatory):** For each line, provide a \`confidence\` score from 0.0 to 1.0. This is your honest assessment of the transcription's accuracy. A score of 1.0 means you are absolutely certain. A score below 0.7 indicates ambiguity. Be critical: lower the score for unclear words, background noise, or heavy accents.
5.  **Explanation (Crucial):** For each line, you MUST provide a \`timing_explanation\`. This is a brief justification for your chosen start and end times, proving you have analyzed the audio. Examples: 'Starts precisely on the attack of the first word', 'Ends as the speaker's voice fades on the last syllable', 'Timed to match the rapid pace of this phrase'.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema,
        temperature: 0.2, // Lower temperature for more deterministic, accurate output
        thinkingConfig: { thinkingBudget: 16384 }, // Allocate more processing for complex analysis
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
          // Provide a fallback or skip the line
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
