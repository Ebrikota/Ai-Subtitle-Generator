
export const transcribeWithWhisper = async (file: File): Promise<string> => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable not set. This feature is unavailable.");
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        throw new Error(`OpenAI API responded with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.text;

  } catch (error) {
    console.error("Error calling OpenAI Whisper API:", error);
    if (error instanceof Error) {
        if (error.message.includes('401')) {
             throw new Error('Invalid OpenAI API key.');
        }
         if (error.message.includes('429')) {
            throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
    throw new Error("An unknown error occurred during transcription.");
  }
};
