import { GoogleGenAI } from "@google/genai";
import { MusicAnalysis } from "../types";

export async function analyzeAudio(base64Audio: string, mimeType: string): Promise<MusicAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  const prompt = `Act as an elite musicologist and identification specialist.
  Analyze the provided audio snippet.
  1. Identify the Artist, Song Title, and Genre.
  2. Perform a Google Search to retrieve:
     - A meaningful snippet of the official lyrics that captures the song's theme.
     - The release year.
     - Direct links to Spotify and YouTube.
  3. Analyze the emotional tone (Mood).
  4. Generate a 'VisualPrompt': A descriptive, artistic prompt for an image generator. Focus on lighting, texture, and mood. DO NOT include text in the image prompt.

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
          { text: prompt },
        ],
      },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    
    const extractField = (field: string) => {
      const regex = new RegExp(`${field}:\\s*(.*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim().replace(/\[|\]/g, '') : "";
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
        title: chunk.web?.title || "Search Result",
        uri: chunk.web?.uri || ""
      })) || [];

    return {
      artist: artist || "Unknown Artist",
      title: title || "Unknown Track",
      lyrics: lyrics || "The song resonates with an atmospheric energy.",
      mood: mood || "Atmospheric",
      genre: genre || "Unknown Genre",
      visualPrompt: visualPrompt || `Cinematic album art for a ${genre} track by ${artist}`,
      releaseDate,
      spotifyUrl,
      youtubeUrl,
      sources
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}

export async function generateVisual(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-2.5-flash-image for standard image generation as per guidelines
  const model = 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: `High-quality cinematic album cover, artistic style, evocative, no text: ${prompt}` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let imageUrl = "";
    // Image results can be in multiple parts, iterating to find the correct one
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