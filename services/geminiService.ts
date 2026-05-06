import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

const DEFAULT_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateVideoSettings = async (prompt: string) => {
  const ai = getAiClient();
  if (!ai) return null;

  const model = "gemini-flash-latest";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `As a professional colorist, map this request "${prompt}" to video settings. Return JSON only.`,
      config: {
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brightness: { type: Type.NUMBER },
            contrast: { type: Type.NUMBER },
            saturate: { type: Type.NUMBER },
            hue: { type: Type.NUMBER },
            vignette: { type: Type.NUMBER },
            chromaKey: { type: Type.BOOLEAN },
          },
        },
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error("Gemini Video Error:", error);
    return null;
  }
};

export const generateStyleSettings = async (referenceImageBase64: string, mimeType: string) => {
    const ai = getAiClient();
    if (!ai) return null;
  
    const model = "gemini-flash-latest";
    
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                { inlineData: { data: referenceImageBase64, mimeType } },
                { text: "Analyze the visual style (lighting, color palette, contrast, mood) of this image. Generate a set of video adjustment settings (brightness, contrast, saturation, hue, blur, vignette, etc.) that would replicate this look. Return JSON only." }
            ]
        },
        config: {
          safetySettings: DEFAULT_SAFETY_SETTINGS,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brightness: { type: Type.NUMBER, description: "Percentage 0-200, 100 is normal" },
              contrast: { type: Type.NUMBER, description: "Percentage 0-200, 100 is normal" },
              saturate: { type: Type.NUMBER, description: "Percentage 0-200, 100 is normal" },
              hue: { type: Type.NUMBER, description: "Degrees -180 to 180" },
              blur: { type: Type.NUMBER, description: "Pixels 0-20" },
              vignette: { type: Type.NUMBER, description: "0-100" },
              grayscale: { type: Type.BOOLEAN },
              sepia: { type: Type.BOOLEAN },
            },
          },
        },
      });
      return response.text ? JSON.parse(response.text) : null;
    } catch (error) {
      console.error("Gemini Style Transfer Error:", error);
      return null;
    }
};

export const generateImageSettings = async (prompt: string) => {
  const ai = getAiClient();
  if (!ai) return null;

  const model = "gemini-flash-latest";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `As a photo editor, map this request "${prompt}" to image adjustments. Return JSON only.`,
      config: {
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                brightness: { type: Type.NUMBER },
                contrast: { type: Type.NUMBER },
                saturate: { type: Type.NUMBER },
                grayscale: { type: Type.NUMBER },
                sepia: { type: Type.NUMBER },
                blendMode: { type: Type.STRING, enum: ["normal", "multiply", "screen", "overlay"] }
            }
        }
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error("Gemini Image Error:", error);
    return null;
  }
};

export const generateAudioSettings = async (prompt: string) => {
  const ai = getAiClient();
  if (!ai) return null;

  const model = "gemini-flash-latest";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `As an audio engineer, map this request "${prompt}" to EQ and dynamics settings. Return JSON only.`,
      config: {
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                frequency: { type: Type.NUMBER },
                Q: { type: Type.NUMBER },
                threshold: { type: Type.NUMBER },
                ratio: { type: Type.NUMBER },
                reverb_wet: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ["lowpass", "highpass", "peaking"] }
            }
        }
      },
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) {
    console.error("Gemini Audio Error:", error);
    return null;
  }
};

// --- New Generative Features ---

export const generateImage = async (prompt: string, aspectRatio: string) => {
    // Paid Key Check for gemini-3-pro-image-preview
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            safetySettings: DEFAULT_SAFETY_SETTINGS,
            imageConfig: { aspectRatio: aspectRatio as any }
        }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return part.inlineData.data;
      }
      return null;
    } catch (e: any) { 
      console.error(e); 
      if (window.aistudio && e.message && (e.message.includes("Requested entity was not found") || e.message.includes("403"))) {
         await window.aistudio.openSelectKey();
      }
      return null; 
    }
  };
  
  export const editImage = async (base64Image: string, mimeType: string, prompt: string) => {
      const ai = getAiClient();
      if (!ai) return null;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                  parts: [
                      { inlineData: { data: base64Image, mimeType } },
                      { text: prompt }
                  ]
              },
              config: {
                safetySettings: DEFAULT_SAFETY_SETTINGS
              }
          });
          for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) return part.inlineData.data;
          }
          return null;
      } catch (e) { console.error(e); return null; }
  };

  export const removeBackground = async (base64Image: string, mimeType: string, hint: string = "") => {
    const ai = getAiClient();
    if (!ai) return null;
    
    const prompt = `Remove the background from this image. Ensure the subject is isolated perfectly. ${hint ? `Additional requirement: ${hint}` : ''}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType } },
                    { text: prompt }
                ]
            },
            config: {
                safetySettings: DEFAULT_SAFETY_SETTINGS
            }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return part.inlineData.data;
        }
        return null;
    } catch (e) { console.error(e); return null; }
  };

  export const upscaleImage = async (base64Image: string, mimeType: string, resolution: '2K' | '4K', aspectRatio: string, scaleFactor: string = '2x') => {
    // Upscale requires paid key check
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType } },
                    { text: `Upscale this image by ${scaleFactor} to high resolution (${resolution}), maintaining fidelity and details.` }
                ]
            },
            config: {
                safetySettings: DEFAULT_SAFETY_SETTINGS,
                imageConfig: {
                    imageSize: resolution,
                    aspectRatio: aspectRatio as any
                }
            }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return part.inlineData.data;
        }
        return null;
    } catch (e: any) { 
        console.error("Upscale Error:", e); 
        if (window.aistudio && e.message && (e.message.includes("Requested entity was not found") || e.message.includes("403"))) {
            await window.aistudio.openSelectKey();
        }
        return null; 
    }
  };
  
  export const analyzeImage = async (base64Image: string, mimeType: string, prompt: string = "Analyze this image.") => {
      const ai = getAiClient();
      if (!ai) return null;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3.1-pro-preview',
              contents: {
                  parts: [
                      { inlineData: { data: base64Image, mimeType } },
                      { text: prompt }
                  ]
              },
              config: {
                safetySettings: DEFAULT_SAFETY_SETTINGS
              }
          });
          return response.text;
      } catch (e) { console.error(e); return "Error analyzing image."; }
  };
  
  export const analyzeVideo = async (base64Video: string, mimeType: string, prompt: string = "Analyze this video.") => {
      const ai = getAiClient();
      if (!ai) return null;
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-3.1-pro-preview',
              contents: {
                  parts: [
                      { inlineData: { data: base64Video, mimeType } },
                      { text: prompt }
                  ]
              },
              config: {
                safetySettings: DEFAULT_SAFETY_SETTINGS
              }
          });
          return response.text;
      } catch (e) { console.error(e); return "Error analyzing video. It might be too large for this demo."; }
  };

  export const generateStoryboard = async (base64Video: string, mimeType: string) => {
    const ai = getAiClient();
    if (!ai) return null;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Video, mimeType } },
            { text: "Analyze this video and create a storyboard. Identify 3-5 key scenes. For each scene, provide a timestamp, a short description, and visual notes. Return JSON only in this format: [{ timestamp: 'MM:SS', description: '...', visual_notes: '...' }]" }
          ]
        },
        config: {
           safetySettings: DEFAULT_SAFETY_SETTINGS,
           responseMimeType: "application/json",
           responseSchema: {
               type: Type.ARRAY,
               items: {
                   type: Type.OBJECT,
                   properties: {
                       timestamp: { type: Type.STRING },
                       description: { type: Type.STRING },
                       visual_notes: { type: Type.STRING }
                   }
               }
           }
        }
      });
      return response.text ? JSON.parse(response.text) : [];
    } catch (e) { console.error(e); return null; }
  };

  export const suggestVideoCuts = async (base64Video: string, mimeType: string) => {
      const ai = getAiClient();
      if (!ai) return null;
      
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Video, mimeType } },
              { text: "Analyze this video and suggest timestamps for cuts where the scene changes significantly or the action shifts. Provide the timestamp in seconds (number) and a string format, and a reason. Return JSON only: [{ timestamp: 'MM:SS', seconds: 10, reason: 'Scene change' }]" }
            ]
          },
          config: {
             safetySettings: DEFAULT_SAFETY_SETTINGS,
             responseMimeType: "application/json",
             responseSchema: {
                 type: Type.ARRAY,
                 items: {
                     type: Type.OBJECT,
                     properties: {
                         timestamp: { type: Type.STRING },
                         seconds: { type: Type.NUMBER },
                         reason: { type: Type.STRING }
                     }
                 }
             }
          }
        });
        return response.text ? JSON.parse(response.text) : [];
      } catch (e) { console.error(e); return null; }
    };
  
  export const animateImage = async (base64Image: string, mimeType: string, aspectRatio: string) => {
      // Veo Key Check
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
              await window.aistudio.openSelectKey();
          }
      }
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey! }); 
  
      try {
          let operation = await ai.models.generateVideos({
              model: 'veo-3.1-lite-generate-preview',
              image: { imageBytes: base64Image, mimeType },
              config: {
                  safetySettings: DEFAULT_SAFETY_SETTINGS,
                  numberOfVideos: 1,
                  resolution: '720p',
                  aspectRatio: aspectRatio as any
              }
          });
          
          while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 5000));
              operation = await ai.operations.getVideosOperation({operation});
          }
          
          const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
              const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
              const vidRes = await fetch(`${uri}&key=${apiKey}`);
              const blob = await vidRes.blob();
              return URL.createObjectURL(blob);
          }
          return null;
  
      } catch (e: any) { 
        console.error(e); 
        if (window.aistudio && e.message && (e.message.includes("Requested entity was not found") || e.message.includes("403"))) {
             await window.aistudio.openSelectKey();
        }
        return null; 
      }
  };

  export const generateSpeech = async (text: string, voiceName: string = 'Kore') => {
    const ai = getAiClient();
    if (!ai) return null;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: { parts: [{ text }] },
        config: {
          safetySettings: DEFAULT_SAFETY_SETTINGS,
          responseModalities: ['AUDIO' as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            },
          },
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return part.inlineData.data;
      }
      return null;
    } catch (e) { console.error("TTS Error:", e); return null; }
  };

  export const checkSafety = async (prompt: string): Promise<{ safe: boolean, reason?: string }> => {
    const ai = getAiClient();
    if (!ai) return { safe: true };
    try {
        const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: `Analyze this prompt for safety. JSON: { "safe": boolean, "reason": string }. Prompt: "${prompt}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        safe: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING }
                    },
                    required: ["safe"]
                }
            }
        });
        return response.text ? JSON.parse(response.text) : { safe: true };
    } catch (e) { return { safe: true }; }
  };
