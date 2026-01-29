
import { GoogleGenAI, Type } from "@google/genai";
import { MusicAnalysis } from "../types";

export async function analyzeAudio(base64Audio: string): Promise<MusicAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  // Prompt modified to request a clear, tag-based format for manual extraction.
  // This avoids JSON parsing issues which can occur when using the googleSearch tool due to citations.
  const prompt = `Act as a world-class music identification engine. 
  1. Identify the song title, artist, and genre from this audio snippet.
  2. Use Google Search to find:
     - The official lyrics (snippet).
     - The release year.
     - A direct Spotify or YouTube link if possible.
  3. Create a highly detailed visual prompt for an image generator that captures the specific aesthetic and vibe of the song.

  Respond in this exact format:
  Artist: [Artist Name]
  Title: [Song Title]
  Lyrics: [Snippet]
  Mood: [Mood]
  Genre: [Genre]
  ReleaseDate: [Year]
  SpotifyUrl: [URL]
  YoutubeUrl: [URL]
  VisualPrompt: [Prompt]`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      tools: [{ googleSearch: {} }],
      // Per Search Grounding rules: "The output response.text may not be in JSON format; do not attempt to parse it as JSON."
      // Therefore, we do not set responseMimeType or responseSchema here.
    },
  });

  const text = response.text || "";
  if (!text) throw new Error("Could not identify the song.");
  
  // Manual extraction of fields from the text response as parsing JSON is prohibited with googleSearch.
  const extractField = (field: string) => {
    const lines = text.split('\n');
    const line = lines.find(l => l.toLowerCase().startsWith(field.toLowerCase()));
    if (!line) return "";
    return line.split(':').slice(1).join(':').trim().replace(/\[|\]/g, '');
  };

  const artist = extractField("Artist");
  const title = extractField("Title");
  const lyrics = extractField("Lyrics");
  const mood = extractField("Mood");
  const genre = extractField("Genre");
  const releaseDate = extractField("ReleaseDate");
  const spotifyUrl = extractField("SpotifyUrl");
  const youtubeUrl = extractField("YoutubeUrl");
  const visualPrompt = extractField("VisualPrompt");

  // Extract grounding URLs for credits as required by Search Grounding rules
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    ?.map(chunk => ({
      title: chunk.web?.title || "Source",
      uri: chunk.web?.uri || ""
    })) || [];

  return {
    artist: artist || "Unknown Artist",
    title: title || "Unknown Title",
    lyrics: lyrics || "Lyrics snippet unavailable.",
    mood: mood || "Mysterious",
    genre: genre || "Unknown",
    visualPrompt: visualPrompt || `Artistic visualization of a song by ${artist}`,
    releaseDate,
    spotifyUrl,
    youtubeUrl,
    sources
  };
}

export async function generateVisual(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash-image';
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [{ text: `High-quality, artistic interpretation of the song vibe: ${prompt}. Professional album cover style, vibrant, high-fidelity.` }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      }
    }
  });

  let imageUrl = "";
  // Iterating through all parts to find the image part, as per Gemini image generation guidelines.
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) throw new Error("Failed to generate image");
  return imageUrl;
}
