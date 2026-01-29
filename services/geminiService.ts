
import { GoogleGenAI } from "@google/genai";
import { MusicAnalysis } from "../types";

export async function analyzeAudio(base64Audio: string, mimeType: string): Promise<MusicAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  // We sturen het daadwerkelijke mimeType mee naar Gemini
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
            mimeType: mimeType, // Gebruik het dynamische mimeType (bijv. audio/mp4 of audio/webm)
            data: base64Audio,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "";
  if (!text) throw new Error("Kon geen tekst ophalen van de AI.");
  
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

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    ?.map(chunk => ({
      title: chunk.web?.title || "Bron",
      uri: chunk.web?.uri || ""
    })) || [];

  return {
    artist: artist || "Onbekende Artiest",
    title: title || "Onbekend Nummer",
    lyrics: lyrics || "Geen lyrics beschikbaar.",
    mood: mood || "Sfeervol",
    genre: genre || "Onbekend",
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
      parts: [{ text: `High-quality album cover art: ${prompt}. Cinematic, professional lighting.` }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      }
    }
  });

  let imageUrl = "";
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) throw new Error("Geen afbeelding gegenereerd.");
  return imageUrl;
}
