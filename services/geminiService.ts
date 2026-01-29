import { GoogleGenAI } from "@google/genai";
import { MusicAnalysis } from "../types";

const MUSIC_ANALYSIS_PROMPT_TEMPLATE = (input: string, isAudio: boolean) => `
  Act as an elite musicologist and identification specialist.
  ${isAudio ? 'Analyze the provided audio snippet.' : `Identify the song based on these lyrics: "${input}"`}
  
  1. Identify the Artist, Song Title, and Genre.
  2. Perform a Google Search to retrieve:
     - A meaningful snippet of the official lyrics that captures the song's theme.
     - The release year.
     - Direct links to Spotify and YouTube.
  3. Analyze the emotional tone (Mood).
  4. Generate a 'VisualPrompt': A descriptive, purely artistic prompt for an image generator. 
     - Focus on lighting, textures, colors, abstract shapes, or symbolic scenery. 
     - STRICTOR REQUIREMENT: The description MUST NOT contain instructions to include any text, letters, symbols, or words in the image. It must be a purely visual artistic concept (e.g., "swirling oil painting of oceanic waves at twilight" rather than "a poster with the name of the band").

  Return your response in this exact plain text format:
  Artist: [Name]
  Title: [Title]
  Lyrics: [Poetic Snippet]
  Mood: [Emotional State]
  Genre: [Genre]
  ReleaseDate: [Year]
  SpotifyUrl: [URL]
  YoutubeUrl: [URL]
  VisualPrompt: [Artistic Prompt]`;

const extractFieldsFromResponse = (text: string) => {
  const extractField = (field: string) => {
    const regex = new RegExp(`${field}:\\s*(.*)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim().replace(/\[|\]/g, '') : "";
  };

  return {
    artist: extractField("Artist"),
    title: extractField("Title"),
    lyrics: extractField("Lyrics"),
    mood: extractField("Mood"),
    genre: extractField("Genre"),
    releaseDate: extractField("ReleaseDate"),
    spotifyUrl: extractField("SpotifyUrl"),
    youtubeUrl: extractField("YoutubeUrl"),
    visualPrompt: extractField("VisualPrompt"),
  };
};

export async function analyzeAudio(base64Audio: string, mimeType: string): Promise<MusicAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          { text: MUSIC_ANALYSIS_PROMPT_TEMPLATE("", true) },
        ],
      },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const fields = extractFieldsFromResponse(response.text || "");
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter(chunk => chunk.web)
      ?.map(chunk => ({
        title: chunk.web?.title || "Search Result",
        uri: chunk.web?.uri || ""
      })) || [];

    return {
      ...fields,
      artist: fields.artist || "Unknown Artist",
      title: fields.title || "Unknown Track",
      lyrics: fields.lyrics || "Atmospheric resonance detected.",
      mood: fields.mood || "Atmospheric",
      genre: fields.genre || "Unknown Genre",
      visualPrompt: fields.visualPrompt || `Cinematic album art for a ${fields.genre} track by ${fields.artist}`,
      sources
    };
  } catch (error) {
    console.error("Gemini Audio Analysis Error:", error);
    throw error;
  }
}

export async function searchByLyrics(lyricsInput: string): Promise<MusicAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: MUSIC_ANALYSIS_PROMPT_TEMPLATE(lyricsInput, false),
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const fields = extractFieldsFromResponse(response.text || "");
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter(chunk => chunk.web)
      ?.map(chunk => ({
        title: chunk.web?.title || "Search Result",
        uri: chunk.web?.uri || ""
      })) || [];

    return {
      ...fields,
      artist: fields.artist || "Unknown Artist",
      title: fields.title || "Unknown Track",
      lyrics: fields.lyrics || lyricsInput,
      mood: fields.mood || "Evocative",
      genre: fields.genre || "Unknown Genre",
      visualPrompt: fields.visualPrompt || `Cinematic interpretation of ${fields.title}`,
      sources
    };
  } catch (error) {
    console.error("Gemini Lyrics Search Error:", error);
    throw error;
  }
}

export async function generateVisual(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: `High-quality cinematic album cover art, purely visual, no text, no letters, evocative, artistic masterpiece: ${prompt}` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let imageUrl = "";
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) throw new Error("Could not find image in model response.");
    return imageUrl;
  } catch (error) {
    console.error("Gemini Visual Generation Error:", error);
    throw error;
  }
}