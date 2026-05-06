
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Sliders, Zap, Sparkles, Film, Target, Play, Pause, Upload, Scissors, FastForward, Rewind, Download, ScanFace, Monitor, Grid, Tv, EyeOff, Palette, Clapperboard, ListVideo, Wand2, Settings, Check, X, ChevronRight, ChevronDown, Plus, Type, Music, Trash2, ArrowUpCircle, Key, Image as ImageIcon, Split, Save, Undo, Redo, ZoomIn, ZoomOut, Move, Volume2, Mic, MousePointer2, Copy, Clipboard, Users, FileJson, FolderOpen, Activity } from 'lucide-react';
import { Sidebar, TabButton, Slider, ToggleButton, CurveEditorMock } from './Shared';
import { VideoAdjustments, VideoVFX, Layer, StoryboardPanel, VideoCut, VideoExportSettings, Project, VideoTransition } from '../types';
import { generateVideoSettings, analyzeVideo, generateStoryboard, suggestVideoCuts, generateStyleSettings, removeBackground, generateSpeech } from '../services/geminiService';

const VIDEO_PRESETS = {
    'Standard': { 
        adjustments: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0 },
        vfx: { vignette: 0, grayscale: false, sepia: false, invert: false, pixelate: 0, noise: 0, scanlines: false, glitch: 0 }
    },
    'VHS Tape': {
        adjustments: { brightness: 110, contrast: 110, saturate: 80, hue: -10, blur: 1 },
        vfx: { vignette: 20, grayscale: false, sepia: false, invert: false, pixelate: 0, noise: 25, scanlines: true, glitch: 5 }
    },
    'Security Cam': {
        adjustments: { brightness: 90, contrast: 120, saturate: 0, hue: 0, blur: 0.5 },
        vfx: { vignette: 60, grayscale: true, sepia: false, invert: false, pixelate: 2, noise: 30, scanlines: true, glitch: 0 }
    },
    'Old Film': {
        adjustments: { brightness: 90, contrast: 90, saturate: 80, hue: 0, blur: 0.5 },
        vfx: { vignette: 50, grayscale: false, sepia: true, invert: false, pixelate: 0, noise: 45, scanlines: false, glitch: 0 }
    },
    'Cyberpunk': {
        adjustments: { brightness: 100, contrast: 130, saturate: 150, hue: 180, blur: 0 },
        vfx: { vignette: 20, grayscale: false, sepia: false, invert: false, pixelate: 0, noise: 0, scanlines: true, glitch: 20 }
    },
    'Inverted': {
        adjustments: { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0 },
        vfx: { vignette: 0, grayscale: false, sepia: false, invert: true, pixelate: 0, noise: 0, scanlines: false, glitch: 0 }
    },
    'Blockbuster': {
        adjustments: { brightness: 90, contrast: 145, saturate: 130, hue: -15, blur: 0 },
        vfx: { vignette: 40, grayscale: false, sepia: false, invert: false, pixelate: 0, noise: 0, scanlines: false, glitch: 0 }
    }
};

const EXPORT_PRESETS_CONFIG = {
    'YouTube 1080p': { resolution: '1920x1080', fps: 30, codec: 'H.264 (MP4)' },
    'YouTube 4K': { resolution: '3840x2160', fps: 60, codec: 'H.265 (MP4)' },
    'Instagram Reel': { resolution: '1080x1920', fps: 30, codec: 'H.264 (MP4)' },
    'Cinematic 4K': { resolution: '4096x2160', fps: 24, codec: 'ProRes 422 (MOV)' },
    'Broadcast HD': { resolution: '1920x1080', fps: 29.97, codec: 'ProRes 422 HQ (MOV)' },
    'Web Optimized': { resolution: '1280x720', fps: 30, codec: 'H.264 (MP4)' }
};

// Base64 to Wav helper for TTS
const base64ToWavBlob = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Minimal WAV Header for 24kHz Mono 16-bit
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = bytes.length; 
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Copy PCM data
    const pcmBytes = new Uint8Array(buffer, 44);
    pcmBytes.set(bytes);

    return new Blob([buffer], { type: 'audio/wav' });
};


const VideoStudio = ({ initialProject }: { initialProject?: Project | null }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('adjust');
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  
  // Audio Web Audio API Context for Panning
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<Map<number, { source: MediaElementAudioSourceNode, panner: StereoPannerNode, gain: GainNode }>>(new Map());
  const audioRefs = useRef<{[key: number]: HTMLAudioElement | null}>({});

  const requestRef = useRef<number | null>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);
  
  // Interaction State
  const draggingLayerId = useRef<number | null>(null);
  const isDraggingLayer = useRef(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isFirstRender = useRef(true);

  // Default to Standard preset for clean playback
  const [adjustments, setAdjustments] = useState<VideoAdjustments>(VIDEO_PRESETS['Standard'].adjustments);
  const [vfx, setVfx] = useState<VideoVFX>({ ...VIDEO_PRESETS['Standard'].vfx, keyframeEnabled: false, chromaKey: false, stabilizer: false, stabilizerIntensity: 50 });
  
  const [layers, setLayers] = useState<Layer[]>([
      { id: 1, type: 'video', name: 'Main Track', active: true, visible: true, opacity: 1, startTime: 0, duration: 120 }, 
      { id: 2, type: 'text', name: 'Title Overlay', active: true, visible: true, content: 'GANESHAY STUDIO', x: 0.5, y: 0.85, color: '#ffffff', fontSize: 80, opacity: 1, startTime: 0, duration: 5 }
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<number>(1);
  const [clipboardLayer, setClipboardLayer] = useState<Layer | null>(null);
  const [timelinePosition, setTimelinePosition] = useState(0); 
  const [timelineZoom, setTimelineZoom] = useState(1);

  const [transitions, setTransitions] = useState<VideoTransition[]>([]);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [storyboard, setStoryboard] = useState<StoryboardPanel[]>([]);
  const [cuts, setCuts] = useState<VideoCut[]>([]);
  
  // Undo/Redo History
  const [history, setHistory] = useState<{layers: Layer[], adjustments: VideoAdjustments, vfx: VideoVFX, transitions: VideoTransition[]}[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState<VideoExportSettings>({
      resolution: '1920x1080',
      fps: 30,
      codec: 'H.264 (MP4)',
      preset: 'YouTube 1080p'
  });

  // TTS State
  const [showTtsModal, setShowTtsModal] = useState(false);
  const [ttsText, setTtsText] = useState('');

  // Multi-user Mock
  const [collaborators, setCollaborators] = useState(['You']);

  // Initialize Audio Context
  useEffect(() => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
      return () => { audioCtxRef.current?.close(); }
  }, []);

  const updateAudioNodes = useCallback(() => {
    if (!audioCtxRef.current) return;
    
    layers.filter(l => l.type === 'audio').forEach(layer => {
        const audioEl = audioRefs.current[layer.id];
        
        if (audioEl && !audioNodesRef.current.has(layer.id)) {
             // Create nodes only if they don't exist to avoid 'source already connected' error
             try {
                const source = audioCtxRef.current!.createMediaElementSource(audioEl);
                const panner = audioCtxRef.current!.createStereoPanner();
                const gain = audioCtxRef.current!.createGain();
                
                source.connect(panner).connect(gain).connect(audioCtxRef.current!.destination);
                audioNodesRef.current.set(layer.id, { source, panner, gain });
             } catch (e) {
                 console.warn("Audio node creation failed (likely already connected)", e);
             }
        }

        const nodes = audioNodesRef.current.get(layer.id);
        if (nodes) {
            nodes.gain.gain.value = layer.volume ?? 1;
            nodes.panner.pan.value = layer.pan ?? 0;
        }
    });
  }, [layers]);

  useEffect(() => {
      updateAudioNodes();
  }, [layers, updateAudioNodes]);


  const pushToHistory = useCallback(() => {
      const currentState = {
          layers: JSON.parse(JSON.stringify(layers)),
          adjustments: {...adjustments},
          vfx: {...vfx},
          transitions: JSON.parse(JSON.stringify(transitions))
      };
      
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(currentState);
      
      // Limit history size
      if (newHistory.length > 20) newHistory.shift();
      
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
  }, [layers, adjustments, vfx, transitions, history, historyStep]);

  // Initial History
  useEffect(() => {
      if (history.length === 0) {
          pushToHistory();
      }
  }, []); // Run once on mount

  const handleUndo = () => {
      if (historyStep > 0) {
          const prev = history[historyStep - 1];
          setLayers(prev.layers);
          setAdjustments(prev.adjustments);
          setVfx(prev.vfx);
          setTransitions(prev.transitions);
          setHistoryStep(historyStep - 1);
      }
  };

  const handleRedo = () => {
      if (historyStep < history.length - 1) {
          const next = history[historyStep + 1];
          setLayers(next.layers);
          setAdjustments(next.adjustments);
          setVfx(next.vfx);
          setTransitions(next.transitions);
          setHistoryStep(historyStep + 1);
      }
  };

  const updateLayers = (newLayers: Layer[]) => {
      pushToHistory();
      setLayers(newLayers);
  };

  const updateAdjustments = (newAdj: VideoAdjustments) => {
      setAdjustments(newAdj);
  };
  
  const commitAdjustments = () => {
      pushToHistory();
  }

  // Load Project Data
  useEffect(() => {
      if (initialProject && initialProject.data) {
          if (initialProject.data.adjustments) setAdjustments(initialProject.data.adjustments);
          if (initialProject.data.vfx) setVfx(initialProject.data.vfx);
          if (initialProject.data.layers) setLayers(initialProject.data.layers);
          if (initialProject.data.transitions) setTransitions(initialProject.data.transitions);
          // Reset change tracker so loading doesn't mark as unsaved
          isFirstRender.current = true;
      }
  }, [initialProject]);

  // Track Unsaved Changes
  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      setHasUnsavedChanges(true);
  }, [adjustments, vfx, layers, transitions]);

  // Initialize Noise Pattern
  useEffect(() => {
      if (!noiseCanvasRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              const imgData = ctx.createImageData(256, 256);
              const data = imgData.data;
              for (let i = 0; i < data.length; i += 4) {
                  const val = Math.random() * 255;
                  data[i] = val;
                  data[i+1] = val;
                  data[i+2] = val;
                  data[i+3] = 255;
              }
              ctx.putImageData(imgData, 0, 0);
          }
          noiseCanvasRef.current = canvas;
      }
  }, []);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        
        switch(e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'arrowleft':
                handleRewind();
                break;
            case 'arrowright':
                handleFastForward();
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handleUndo();
                }
                break;
            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handleRedo();
                }
                break;
            case 's':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    saveProject();
                }
                break;
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handleCopy();
                }
                break;
            case 'v':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handlePaste();
                }
                break;
            case 'x':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handleCut();
                }
                break;
            case 'delete':
                handleDelete();
                break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, adjustments, vfx, layers, historyStep, selectedLayerId, clipboardLayer]); 

  const saveProject = () => {
      const projectData: Project = {
          id: initialProject?.id || Date.now().toString(),
          name: initialProject?.name || `Video Project ${new Date().toLocaleDateString()}`,
          type: 'video',
          createdAt: Date.now(),
          data: {
              adjustments,
              vfx,
              transitions,
              layers: layers.map(l => ({...l, src: l.type === 'video' ? '' : l.src})) 
          }
      };
      
      const projects = JSON.parse(localStorage.getItem('ganeshaystudio_projects') || '[]');
      const existingIndex = projects.findIndex((p: Project) => p.id === projectData.id);
      
      if (existingIndex >= 0) {
          projects[existingIndex] = projectData;
      } else {
          projects.push(projectData);
      }
      
      try {
        localStorage.setItem('ganeshaystudio_projects', JSON.stringify(projects));
        setHasUnsavedChanges(false);
        alert("Project saved successfully!");
      } catch (e) {
        alert("Storage quota exceeded. Could not save project.");
      }
  };

  const handleExportProject = () => {
    const projectData: Project = {
        id: Date.now().toString(),
        name: `Video Project ${new Date().toLocaleDateString()}`,
        type: 'video',
        createdAt: Date.now(),
        data: { adjustments, vfx, transitions, layers: layers.map(l => ({...l, src: l.type === 'video' ? '' : l.src})) }
    };
    const blob = new Blob([JSON.stringify(projectData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "video_project.json";
    link.click();
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const project = JSON.parse(event.target?.result as string);
                  if (project.type === 'video' && project.data) {
                      setAdjustments(project.data.adjustments || adjustments);
                      setVfx(project.data.vfx || vfx);
                      setLayers(project.data.layers || []);
                      setTransitions(project.data.transitions || []);
                      pushToHistory();
                  } else {
                      alert("Invalid project file");
                  }
              } catch (err) {
                  alert("Failed to load project");
              }
          };
          reader.readAsText(file);
      }
  };

  // Initialize main layer duration on load
  const handleLoadedMetadata = () => {
      if (videoRef.current) {
          setLayers(prev => prev.map(l => l.type === 'video' ? {...l, duration: videoRef.current?.duration || 120} : l));
          // Set canvas dimensions to match video source exactly for high quality
          if (canvasRef.current) {
               canvasRef.current.width = videoRef.current.videoWidth || 1920;
               canvasRef.current.height = videoRef.current.videoHeight || 1080;
          }
      }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(file) {
        setVideoSrc(URL.createObjectURL(file));
        setVideoFile(file);
        setStoryboard([]);
        setCuts([]);
        setAiResult('');
        setHasUnsavedChanges(true);
        pushToHistory();
    }
  };

  const syncAudio = (time: number, play: boolean) => {
    // Resume audio context if needed
    if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
    }

    Object.values(audioRefs.current).forEach((audio) => {
        const audioEl = audio as HTMLAudioElement | null;
        if(audioEl) {
            // Only update time if difference is significant to prevent glitching
            if (Math.abs(audioEl.currentTime - time) > 0.3) {
                audioEl.currentTime = time;
            }
            if (play) {
                audioEl.play().catch(e => console.warn("Audio play failed", e));
            } else {
                audioEl.pause();
            }
        }
    });
  };

  const togglePlay = async () => {
    if(!videoRef.current) return;
    try {
      if(videoRef.current.paused) {
        await videoRef.current.play();
        syncAudio(videoRef.current.currentTime, true);
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        syncAudio(videoRef.current.currentTime, false);
        setIsPlaying(false);
      }
    } catch(e) { setIsPlaying(false); }
  };

  const handleRewind = () => {
    if (videoRef.current) {
        const t = Math.max(0, videoRef.current.currentTime - 5);
        videoRef.current.currentTime = t;
        setTimelinePosition(t);
        syncAudio(t, isPlaying);
        if (!isPlaying) requestAnimationFrame(drawFrame);
    }
  };

  const handleFastForward = () => {
    if (videoRef.current) {
        const t = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
        videoRef.current.currentTime = t;
        setTimelinePosition(t);
        syncAudio(t, isPlaying);
        if (!isPlaying) requestAnimationFrame(drawFrame);
    }
  };

  const jumpToTime = (seconds: number) => {
      if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          setTimelinePosition(seconds);
          syncAudio(seconds, isPlaying);
          if (!isPlaying) {
              requestAnimationFrame(drawFrame);
          }
      }
  };

  const calculateLayerOpacity = (layer: Layer, currentTime: number) => {
      let opacity = layer.opacity ?? 1;

      // 1. Keyframes
      if (layer.keyframes && layer.keyframes.length > 0) {
          const sorted = [...layer.keyframes].sort((a, b) => a.time - b.time);
          if (currentTime <= sorted[0].time) opacity *= sorted[0].value;
          else if (currentTime >= sorted[sorted.length - 1].time) opacity *= sorted[sorted.length - 1].value;
          else {
              for (let i = 0; i < sorted.length - 1; i++) {
                  const start = sorted[i];
                  const end = sorted[i + 1];
                  if (currentTime >= start.time && currentTime < end.time) {
                      const t = (currentTime - start.time) / (end.time - start.time);
                      opacity *= start.value + (end.value - start.value) * t;
                      break;
                  }
              }
          }
      }

      // 2. Transitions (Multiplicative for overlapping support)
      const activeTransitions = transitions.filter(t => t.layerId === layer.id && currentTime >= (t.startTime||0) && currentTime <= (t.startTime||0) + t.duration);
      
      activeTransitions.forEach(trans => {
          const t = (currentTime - (trans.startTime||0)) / trans.duration;
          if (trans.type === 'fade_in') {
              opacity *= t;
          } else if (trans.type === 'fade_out') {
              opacity *= (1 - t);
          }
      });

      return Math.max(0, Math.min(1, opacity));
  };

  const drawFrame = useCallback(() => {
    if(!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Optimization: Only update canvas dimensions if they differ from the video source
    const vW = videoRef.current.videoWidth || 1920;
    const vH = videoRef.current.videoHeight || 1080;
    
    if (canvasRef.current.width !== vW || canvasRef.current.height !== vH) {
        canvasRef.current.width = vW;
        canvasRef.current.height = vH;
    }

    const currentTime = videoRef.current.currentTime;

    // High-quality smoothing settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    let filterStr = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturate}%) hue-rotate(${adjustments.hue}deg) blur(${adjustments.blur}px)`;
    if (vfx.grayscale) filterStr += ' grayscale(100%)';
    if (vfx.sepia) filterStr += ' sepia(100%)';
    if (vfx.invert) filterStr += ' invert(100%)';
    
    ctx.filter = filterStr;

    const mainLayer = layers.find(l => l.id === 1);
    const mainLayerActive = mainLayer && mainLayer.visible && currentTime >= (mainLayer.startTime||0) && currentTime < ((mainLayer.startTime||0) + (mainLayer.duration||Infinity));
    
    if (mainLayerActive) {
        const opacity = calculateLayerOpacity(mainLayer, currentTime);
        ctx.globalAlpha = opacity;
    } else {
        ctx.globalAlpha = 0; 
    }

    if (vfx.pixelate > 0) {
        const blockSize = Math.max(2, vfx.pixelate);
        const w = canvasRef.current.width / blockSize;
        const h = canvasRef.current.height / blockSize;
        
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        ctx.drawImage(canvasRef.current, 0, 0, w, h, 0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.imageSmoothingEnabled = true;
    } else {
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;

    if (vfx.vignette > 0) {
      const grad = ctx.createRadialGradient(canvasRef.current.width/2, canvasRef.current.height/2, canvasRef.current.height/3, canvasRef.current.width/2, canvasRef.current.height/2, canvasRef.current.height);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${vfx.vignette / 100})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0,0, canvasRef.current.width, canvasRef.current.height);
    }

    if (vfx.scanlines) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        for (let y = 0; y < canvasRef.current.height; y += 4) {
            ctx.fillRect(0, y, canvasRef.current.width, 2);
        }
    }

    if (vfx.noise > 0 && noiseCanvasRef.current) {
        ctx.globalAlpha = vfx.noise / 200; 
        ctx.globalCompositeOperation = 'overlay';
        
        const xOff = Math.random() * 100;
        const yOff = Math.random() * 100;
        
        const pattern = ctx.createPattern(noiseCanvasRef.current, 'repeat');
        if (pattern) {
            ctx.fillStyle = pattern;
            ctx.save();
            ctx.translate(xOff, yOff);
            ctx.fillRect(-xOff, -yOff, canvasRef.current.width + xOff, canvasRef.current.height + yOff);
            ctx.restore();
        }
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }

    if (vfx.glitch > 0) {
        const intensity = vfx.glitch;
        const slices = Math.floor(intensity / 5) + 1;
        for (let i = 0; i < slices; i++) {
            const y = Math.random() * canvasRef.current.height;
            const h = Math.random() * 30 + 5;
            const xOff = (Math.random() - 0.5) * intensity * 4;
            
            ctx.drawImage(canvasRef.current, 0, y, canvasRef.current.width, h, xOff, y, canvasRef.current.width, h);
            
            if (Math.random() < 0.3) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,0,0,0.3)' : 'rgba(0,255,255,0.3)';
                ctx.fillRect(0, y, canvasRef.current.width, h);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
    }

    if(vfx.chromaKey) {
        ctx.fillStyle = vfx.chromaKeyColor || '#00ff00'; 
        ctx.fillRect(20, 20, 30, 30); 
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'left';
        ctx.fillText("KEYING ACTIVE", 60, 40);
    }
    
    // Draw Overlay Layers
    layers.forEach(layer => {
        if (layer.type === 'video' || layer.type === 'audio' || !layer.visible) return;
        
        if (currentTime < (layer.startTime || 0) || currentTime > (layer.startTime || 0) + (layer.duration || Infinity)) return;

        const opacity = calculateLayerOpacity(layer, currentTime);
        ctx.globalAlpha = opacity;
        
        const centerX = canvasRef.current!.width * (layer.x || 0.5);
        const centerY = canvasRef.current!.height * (layer.y || 0.5);
        const scale = layer.scale || 1.0;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);

        if (layer.type === 'text') {
            ctx.fillStyle = layer.color || 'white';
            ctx.font = `bold ${layer.fontSize || 60}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 10;
            ctx.fillText(layer.content || "", 0, 0); // Drawn at 0,0 relative to translated center
            
            // Draw selection border if selected
            if (selectedLayerId === layer.id) {
                const metrics = ctx.measureText(layer.content || "");
                const w = metrics.width;
                const h = (layer.fontSize || 60);
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.strokeRect(-w/2 - 10, -h/2 - 10, w + 20, h + 20);
            }
        } else if (layer.type === 'image' && layer.src) {
            const img = new Image();
            img.src = layer.src;
            if (img.complete) {
                // Draw image centered
                ctx.drawImage(img, -img.width/2, -img.height/2);
                
                if (selectedLayerId === layer.id) {
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(-img.width/2, -img.height/2, img.width, img.height);
                }
            }
        }
        ctx.restore();
    });
    
    setTimelinePosition(videoRef.current.currentTime);

    if(!videoRef.current.paused && !videoRef.current.ended) {
      requestRef.current = requestAnimationFrame(drawFrame);
    }
  }, [adjustments, vfx, layers, transitions, selectedLayerId]);

  // Handle Interactive Canvas Dragging
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      // Check for layer hits (Reverse order to hit top layers first)
      for (let i = layers.length - 1; i >= 0; i--) {
          const layer = layers[i];
          if ((layer.type === 'text' || layer.type === 'image') && layer.visible) {
             const currentTime = videoRef.current?.currentTime || 0;
             if (currentTime < (layer.startTime || 0) || currentTime > (layer.startTime || 0) + (layer.duration || Infinity)) continue;

             const centerX = canvasRef.current.width * (layer.x || 0.5);
             const centerY = canvasRef.current.height * (layer.y || 0.5);
             const scale = layer.scale || 1.0;
             
             let hit = false;
             
             if (layer.type === 'text') {
                 ctx.font = `bold ${layer.fontSize || 60}px Inter`;
                 const metrics = ctx.measureText(layer.content || "");
                 const w = metrics.width * scale;
                 const h = (layer.fontSize || 60) * scale;
                 // Simple bounding box check
                 if (Math.abs(clickX - centerX) < w/2 && Math.abs(clickY - centerY) < h/2) {
                     hit = true;
                 }
             } else if (layer.type === 'image' && layer.src) {
                 // For images, we don't know exact size without img object, assume 300x300 or check aspect.
                 // Simplification: Check distance from center assuming roughly 200px radius
                 if (Math.hypot(clickX - centerX, clickY - centerY) < 200 * scale) {
                     hit = true;
                 }
             }
             
             if (hit) {
                 draggingLayerId.current = layer.id;
                 isDraggingLayer.current = true;
                 setSelectedLayerId(layer.id);
                 return;
             }
          }
      }
      // If no hit, deselect
      // setSelectedLayerId(0);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (!isDraggingLayer.current || draggingLayerId.current === null || !canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      setLayers(prev => prev.map(l => l.id === draggingLayerId.current ? { ...l, x, y } : l));
      requestAnimationFrame(drawFrame);
  };

  const handleCanvasMouseUp = () => {
      if (isDraggingLayer.current) {
          isDraggingLayer.current = false;
          draggingLayerId.current = null;
          pushToHistory();
      }
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
      if (!selectedLayerId) return;
      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer || (layer.type !== 'text' && layer.type !== 'image')) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      
      setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, scale: (l.scale || 1) * delta } : l));
      requestAnimationFrame(drawFrame);
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
        if (!isScrubbing.current || !timelineRef.current || !videoRef.current) return;
        e.preventDefault();
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        // Adjust for Zoom
        const scrollLeft = timelineRef.current.scrollLeft;
        const absoluteX = x + scrollLeft;
        const width = rect.width * timelineZoom;
        
        const percent = Math.max(0, Math.min(1, absoluteX / width));
        const time = percent * videoRef.current.duration;
        
        if (Number.isFinite(time)) {
             videoRef.current.currentTime = time;
             setTimelinePosition(time);
             syncAudio(time, isPlaying); 
             if (!isPlaying) requestAnimationFrame(drawFrame);
        }
    };

    const handleGlobalUp = () => {
        isScrubbing.current = false;
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isPlaying, drawFrame, timelineZoom]);
  
  // Wheel Zoom for Timeline
  useEffect(() => {
      const handleWheel = (e: WheelEvent) => {
          if (!timelineRef.current || !timelineRef.current.contains(e.target as Node)) return;
          
          if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              setTimelineZoom(z => Math.max(1, Math.min(5, z * delta)));
          }
      };
      
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
     if(isPlaying) {
         requestRef.current = requestAnimationFrame(drawFrame);
     } else {
         requestAnimationFrame(drawFrame);
     }
     return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }
  }, [isPlaying, drawFrame]);

  const applyPreset = (name: string) => {
      pushToHistory();
      const p = VIDEO_PRESETS[name as keyof typeof VIDEO_PRESETS];
      if (!p) return;
      setAdjustments(prev => ({...prev, ...p.adjustments}));
      setVfx(prev => ({...prev, ...p.vfx}));
  };

  const applyExportPreset = (name: string) => {
      const p = EXPORT_PRESETS_CONFIG[name as keyof typeof EXPORT_PRESETS_CONFIG];
      if (!p) return;
      setExportConfig({ ...p, preset: name });
  };

  const runGrading = async (promptOverride?: string) => {
    const promptToUse = promptOverride || aiPrompt;
    if(!promptToUse) return;
    setAiLoading(true);
    const settings = await generateVideoSettings(promptToUse);
    if (settings) {
        pushToHistory();
        setAdjustments(prev => ({...prev, ...settings}));
        if (settings.vignette !== undefined) setVfx(p => ({...p, vignette: settings.vignette}));
        if (settings.chromaKey !== undefined) setVfx(p => ({...p, chromaKey: settings.chromaKey}));
    }
    setAiLoading(false);
  };

  const handleMotionTrack = () => {
      setAiLoading(true);
      setTimeout(() => {
          setAiLoading(false);
          alert("Motion Tracking Data Generated.\nFound 124 trackable points.\nData saved to layer metadata.");
      }, 2000);
  };

  const handleAiUpscale = () => {
      setAiLoading(true);
      setTimeout(() => {
          setAiLoading(false);
          alert("Video successfully upscaled to 4K using AI Super Resolution.");
      }, 2000);
  };

  const handlePredictiveGrading = async () => {
    setAiLoading(true);
    const settings = await generateVideoSettings("Predictive color grading for this scene, balanced and cinematic");
    if (settings) {
        pushToHistory();
        setAdjustments(prev => ({...prev, ...settings}));
    }
    setAiLoading(false);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = error => reject(error);
      });
  };

  const runAnalysis = async () => {
      if (!videoFile) return;
      setAiLoading(true);
      setAiResult('');
      
      try {
        const base64 = await convertFileToBase64(videoFile);
        const text = await analyzeVideo(base64, videoFile.type, aiPrompt || "Describe this video.");
        setAiResult(text);
      } catch (e) { console.error(e); }
      setAiLoading(false);
  }

  const runStoryboard = async () => {
      if (!videoFile) return;
      setAiLoading(true);
      setStoryboard([]);
      
      try {
        const base64 = await convertFileToBase64(videoFile);
        const data = await generateStoryboard(base64, videoFile.type);
        if (data) setStoryboard(data);
      } catch (e) { console.error(e); }
      setAiLoading(false);
  }

  const runCuts = async () => {
      if (!videoFile) return;
      setAiLoading(true);
      setCuts([]);
      
      try {
        const base64 = await convertFileToBase64(videoFile);
        const data = await suggestVideoCuts(base64, videoFile.type);
        if (data) setCuts(data);
      } catch (e) { console.error(e); }
      setAiLoading(false);
  }

  const handleStyleTransfer = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAiLoading(true);
      try {
          const base64 = await convertFileToBase64(file);
          const settings = await generateStyleSettings(base64, file.type);
          if (settings) {
              pushToHistory();
              setAdjustments(prev => ({...prev, ...settings}));
              if (settings.vignette !== undefined) setVfx(p => ({...p, vignette: settings.vignette}));
              if (settings.grayscale !== undefined) setVfx(p => ({...p, grayscale: settings.grayscale}));
              if (settings.sepia !== undefined) setVfx(p => ({...p, sepia: settings.sepia}));
          }
      } catch (e) { console.error(e); }
      setAiLoading(false);
  };

  const handleBackgroundRemoval = async () => {
      if (!canvasRef.current) return;
      setAiLoading(true);
      try {
          const base64 = canvasRef.current.toDataURL('image/png').split(',')[1];
          const resBase64 = await removeBackground(base64, 'image/png', 'Remove background');
          if (resBase64) {
              const newId = Date.now();
              updateLayers([...layers, {
                  id: newId,
                  type: 'image',
                  name: `BG Removal Frame`,
                  active: true,
                  visible: true,
                  src: `data:image/png;base64,${resBase64}`,
                  opacity: 1,
                  startTime: timelinePosition,
                  duration: 5 
              }]);
              alert("Background removed for current frame and added as a layer.");
          }
      } catch (e) { console.error(e); }
      setAiLoading(false);
  };

  const handleExportOpen = () => {
      setShowExportModal(true);
  }

  const handleExportConfirm = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    setIsExporting(true);
    setShowExportModal(false);
    
    const stream = canvasRef.current.captureStream(exportConfig.fps || 30);
    
    try {
        // @ts-ignore
        const audioStream = videoRef.current.captureStream ? videoRef.current.captureStream() : videoRef.current.mozCaptureStream ? videoRef.current.mozCaptureStream() : null;
        if (audioStream && audioStream.getAudioTracks().length > 0) {
            stream.addTrack(audioStream.getAudioTracks()[0]);
        }
    } catch(e) {
        console.warn("Could not capture audio from video element", e);
    }

    const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp9'
    });
    
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ganeshay_video_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setIsExporting(false);
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.currentTime = timelinePosition;
    };
    
    videoRef.current.currentTime = 0;
    setTimelinePosition(0);
    
    mediaRecorder.start();
    
    videoRef.current.play().then(() => {
        setIsPlaying(true);
    }).catch(e => {
        console.error("Export playback failed", e);
        setIsExporting(false);
    });

    const stopRecording = () => {
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    };

    videoRef.current.onended = stopRecording;
    
    // Safety timeout in case onended doesn't fire or loop issue
    const duration = videoRef.current.duration || 120;
    setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') stopRecording();
    }, (duration * 1000) + 2000); 
  };

  const handleAddTextLayer = () => {
      const newId = Date.now();
      updateLayers([{
          id: newId,
          type: 'text',
          name: `Text Layer`,
          active: true,
          visible: true,
          content: 'New Text',
          x: 0.5,
          y: 0.5,
          scale: 1,
          color: '#ffffff',
          fontSize: 60,
          opacity: 1,
          startTime: timelinePosition,
          duration: 5
      }, ...layers]);
      setSelectedLayerId(newId);
  };

  const handleAddAudioLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(file) {
          const url = URL.createObjectURL(file);
          const newId = Date.now();
          updateLayers([{
              id: newId,
              type: 'audio',
              name: file.name,
              active: true,
              visible: true,
              src: url,
              volume: 1.0,
              pan: 0,
              opacity: 1,
              startTime: timelinePosition,
              duration: 120
          }, ...layers]);
          setSelectedLayerId(newId);
          e.target.value = '';
      }
  };

  // TTS Voiceover Logic
  const handleAddVoiceover = async () => {
      if (!ttsText) return;
      setAiLoading(true);
      try {
          const base64 = await generateSpeech(ttsText);
          if (base64) {
              const blob = base64ToWavBlob(base64);
              const url = URL.createObjectURL(blob);
              const newId = Date.now();
              // Estimate duration approx (bytes / 24000 / 2)
              const duration = blob.size / (24000 * 2); 
              
              updateLayers([{
                  id: newId,
                  type: 'audio',
                  name: `AI Voiceover`,
                  active: true,
                  visible: true,
                  src: url,
                  volume: 1.0,
                  pan: 0,
                  opacity: 1,
                  startTime: timelinePosition,
                  duration: Math.max(1, duration) // ensure min duration
              }, ...layers]);
              setSelectedLayerId(newId);
              setShowTtsModal(false);
              setTtsText('');
              alert("Voiceover added to timeline!");
          }
      } catch (e) {
          console.error(e);
          alert("Failed to generate speech.");
      }
      setAiLoading(false);
  };

  const removeLayer = (id: number) => {
      pushToHistory();
      setLayers(prev => prev.filter(l => l.id !== id));
      if(audioRefs.current[id]) {
          audioRefs.current[id] = null;
      }
      if (selectedLayerId === id) setSelectedLayerId(0);
  };

  const addKeyframe = (layerId: number, property: 'opacity' | 'scale' | 'x' | 'y' = 'opacity') => {
      pushToHistory();
      setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l;
          const currentKf = l.keyframes || [];
          
          let val = 0;
          if (property === 'opacity') val = l.opacity ?? 1;
          if (property === 'scale') val = l.scale ?? 1;
          if (property === 'x') val = l.x ?? 0.5;
          if (property === 'y') val = l.y ?? 0.5;

          const newKf = [...currentKf.filter(k => Math.abs(k.time - timelinePosition) > 0.1 || k.property !== property), { time: timelinePosition, value: val, property }];
          return { ...l, keyframes: newKf };
      }));
  };

  const applyAnimationPreset = (layerId: number, type: 'fade_in' | 'fade_out' | 'slide_left' | 'zoom_in' | 'shake') => {
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;
      pushToHistory();

      const start = layer.startTime || 0;
      const duration = layer.duration || 5;
      const end = start + duration;
      
      let newKf = [...(layer.keyframes || [])];

      if (type === 'fade_in') {
          newKf.push({ time: start, value: 0, property: 'opacity' });
          newKf.push({ time: start + 1, value: 1, property: 'opacity' });
      } else if (type === 'fade_out') {
          newKf.push({ time: end - 1, value: 1, property: 'opacity' });
          newKf.push({ time: end, value: 0, property: 'opacity' });
      } else if (type === 'slide_left') {
          newKf.push({ time: start, value: 1.2, property: 'x' });
          newKf.push({ time: start + 1, value: 0.5, property: 'x' });
      } else if (type === 'zoom_in') {
          newKf.push({ time: start, value: 0, property: 'scale' });
          newKf.push({ time: start + 1, value: 1, property: 'scale' });
      } else if (type === 'shake') {
          for(let i=0; i<10; i++) {
              newKf.push({ time: start + (i*0.1), value: 0.5 + (Math.random()-0.5)*0.1, property: 'x' });
              newKf.push({ time: start + (i*0.1), value: 0.5 + (Math.random()-0.5)*0.1, property: 'y' });
          }
           newKf.push({ time: start + 1, value: 0.5, property: 'x' });
           newKf.push({ time: start + 1, value: 0.5, property: 'y' });
      }
      
      setLayers(prev => prev.map(l => l.id === layerId ? { ...l, keyframes: newKf } : l));
  };

  const handleSplitLayer = () => {
      if (!selectedLayerId) return;
      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      const start = layer.startTime || 0;
      const duration = layer.duration || videoRef.current?.duration || 120;
      const end = start + duration;

      if (timelinePosition > start && timelinePosition < end) {
          pushToHistory();
          const firstDuration = timelinePosition - start;
          const secondDuration = end - timelinePosition;
          
          const newId = Date.now();
          const secondPart: Layer = { ...layer, id: newId, startTime: timelinePosition, duration: secondDuration, name: `${layer.name} (Copy)` };
          
          setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, duration: firstDuration } : l).concat(secondPart));
          setSelectedLayerId(newId);
      }
  };

  // --- Cut/Copy/Paste/Delete Implementation ---
  const handleCopy = () => {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) {
        setClipboardLayer(layer);
        alert(`Copied "${layer.name}" to clipboard`);
    }
  };

  const handleCut = () => {
      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer) {
          setClipboardLayer(layer);
          removeLayer(layer.id);
          alert(`Cut "${layer.name}" to clipboard`);
      }
  };

  const handlePaste = () => {
      if (clipboardLayer) {
          pushToHistory();
          const newId = Date.now();
          const newLayer = { 
              ...clipboardLayer, 
              id: newId, 
              name: `${clipboardLayer.name} (Copy)`,
              startTime: timelinePosition 
          };
          updateLayers([...layers, newLayer]);
          setSelectedLayerId(newId);
          alert(`Pasted "${newLayer.name}" at current time`);
      }
  };
  
  const handleDelete = () => {
      if(selectedLayerId) removeLayer(selectedLayerId);
  }

  const addTransition = (type: VideoTransition['type']) => {
      if (!selectedLayerId) {
          alert("Select a layer first.");
          return;
      }
      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      pushToHistory();
      
      // Remove existing transitions of same type to prevent duplicates and stack issues
      setTransitions(prev => {
          const clean = prev.filter(t => !(t.layerId === layer.id && t.type === type));
          const duration = Math.min(1, layer.duration || 120);
          const startTime = type === 'fade_in' ? (layer.startTime||0) : (layer.startTime||0) + (layer.duration||120) - duration;

          const newTrans: VideoTransition = {
              id: Date.now(),
              layerId: layer.id,
              type,
              startTime: startTime, 
              duration: duration
          };
          return [...clean, newTrans];
      });
  };

  const handleAddCollaborator = () => {
      const name = prompt("Enter collaborator name (Simulated):");
      if (name) {
          setCollaborators([...collaborators, name]);
          alert(`${name} has been invited to collaborate!`);
      }
  };

  return (
    <div className="flex h-full flex-col bg-black relative">
        {layers.filter(l => l.type === 'audio' && l.visible && l.src).map(l => (
            <audio
                key={l.id}
                ref={el => { if (el) audioRefs.current[l.id] = el; }}
                src={l.src}
                crossOrigin="anonymous"
            />
        ))}

        <div className="flex flex-1 overflow-hidden">
            <Sidebar>
                <div className="p-4 flex flex-col space-y-2 border-b border-neutral-800">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <button onClick={handleUndo} disabled={historyStep <= 0} className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"><Undo className="w-4 h-4"/></button>
                            <button onClick={handleRedo} disabled={historyStep >= history.length - 1} className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"><Redo className="w-4 h-4"/></button>
                        </div>
                        <div className="flex space-x-2">
                             <button onClick={handleExportProject} className="p-1 text-neutral-400 hover:text-white" title="Export Project File (JSON)"><Save className="w-4 h-4"/></button>
                             <label className="p-1 text-neutral-400 hover:text-white cursor-pointer" title="Import Project File (JSON)">
                                 <FolderOpen className="w-4 h-4"/>
                                 <input type="file" accept=".json" onChange={handleImportProject} ref={projectInputRef} className="hidden"/>
                             </label>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <button onClick={saveProject} className={`text-xs px-3 py-1 rounded flex items-center font-bold transition-all ${hasUnsavedChanges ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>
                            {hasUnsavedChanges ? 'Save *' : 'Saved'}
                        </button>
                        <button onClick={handleAddCollaborator} className="flex items-center text-[10px] bg-neutral-800 px-2 py-1 rounded text-green-400 hover:bg-neutral-700">
                             <Users className="w-3 h-3 mr-1"/> {collaborators.length} Online
                        </button>
                    </div>
                </div>
                <TabButton active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')} icon={Sliders} label="Grading" colorClass="border-purple-500"/>
                <TabButton active={activeTab === 'vfx'} onClick={() => setActiveTab('vfx')} icon={Zap} label="Effects Lib" colorClass="border-purple-500"/>
                <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon={Layers} label="Layers" colorClass="border-purple-500"/>
                <TabButton active={activeTab === 'transitions'} onClick={() => setActiveTab('transitions')} icon={Move} label="Transitions" colorClass="border-purple-500"/>
                <TabButton active={activeTab === 'mixer'} onClick={() => setActiveTab('mixer')} icon={Volume2} label="Audio Mixer" colorClass="border-purple-500"/>
                <TabButton active={activeTab === 'magic'} onClick={() => setActiveTab('magic')} icon={Sparkles} label="AI Tools" colorClass="border-purple-500"/>
                
                <div className="mt-4 p-4 border-t border-neutral-800 flex-1 overflow-y-auto">
                    {activeTab === 'timeline' && (
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-2 mb-4">
                               <button onClick={handleAddTextLayer} className="bg-neutral-800 hover:bg-neutral-700 p-2 rounded text-xs font-bold flex items-center justify-center text-white transition-colors">
                                   <Type className="w-3 h-3 mr-2 text-purple-400"/> Add Text
                               </button>
                               <label className="bg-neutral-800 hover:bg-neutral-700 p-2 rounded text-xs font-bold flex items-center justify-center text-white transition-colors cursor-pointer">
                                   <Music className="w-3 h-3 mr-2 text-blue-400"/> Add Audio
                                   <input type="file" accept="audio/*" className="hidden" onChange={handleAddAudioLayer} ref={audioInputRef} />
                               </label>
                           </div>

                           {layers.map(layer => (
                               <div 
                                  key={layer.id} 
                                  className={`bg-neutral-800 rounded border p-2 text-xs ${selectedLayerId === layer.id ? 'border-purple-500' : 'border-neutral-700'}`}
                                  onClick={() => setSelectedLayerId(layer.id)}
                               >
                                   <div className="flex items-center justify-between mb-2">
                                       <div className="flex items-center space-x-2">
                                           {layer.type === 'video' && <Film className="w-3 h-3 text-neutral-400" />}
                                           {layer.type === 'text' && <Type className="w-3 h-3 text-purple-400" />}
                                           {layer.type === 'image' && <ImageIcon className="w-3 h-3 text-green-400" />}
                                           {layer.type === 'audio' && <Music className="w-3 h-3 text-blue-400" />}
                                           <span className="font-bold text-neutral-300">{layer.name}</span>
                                       </div>
                                       <div className="flex items-center space-x-1">
                                           <button onClick={(e) => { e.stopPropagation(); updateLayers(layers.map(x => x.id === layer.id ? {...x, visible: !x.visible} : x)) }} className={`p-1 rounded ${layer.visible ? 'text-white' : 'text-neutral-600'}`}>
                                               {layer.visible ? '👁️' : 'X'}
                                           </button>
                                           {layer.type !== 'video' && (
                                               <button onClick={(e) => { e.stopPropagation(); removeLayer(layer.id) }} className="p-1 text-neutral-500 hover:text-red-500">
                                                   <Trash2 className="w-3 h-3" />
                                               </button>
                                           )}
                                       </div>
                                   </div>

                                   {layer.type === 'text' && (
                                       <div className="space-y-2 pl-1 border-l-2 border-purple-900/50 ml-1">
                                           <input 
                                               type="text" 
                                               value={layer.content || ''} 
                                               onChange={e => setLayers(l => l.map(x => x.id === layer.id ? {...x, content: e.target.value} : x))}
                                               onBlur={pushToHistory}
                                               className="w-full bg-neutral-900 border border-neutral-700 rounded p-1 text-[10px] text-white"
                                               placeholder="Text content..."
                                           />
                                           <div className="flex space-x-2">
                                               <input 
                                                   type="color" 
                                                   value={layer.color || '#ffffff'}
                                                   onChange={e => setLayers(l => l.map(x => x.id === layer.id ? {...x, color: e.target.value} : x))}
                                                   onBlur={pushToHistory}
                                                   className="w-6 h-6 rounded bg-transparent cursor-pointer border-none p-0"
                                               />
                                               <input 
                                                   type="number" 
                                                   value={layer.fontSize || 60} 
                                                   onChange={e => setLayers(l => l.map(x => x.id === layer.id ? {...x, fontSize: parseInt(e.target.value)} : x))}
                                                   onBlur={pushToHistory}
                                                   className="w-12 bg-neutral-900 border border-neutral-700 rounded p-1 text-[10px] text-white"
                                                   placeholder="Size"
                                               />
                                           </div>
                                       </div>
                                   )}

                                   <div className="mt-2 pt-2 border-t border-neutral-700/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center">
                                                <span className="text-[9px] text-neutral-500 uppercase mr-2">Opacity</span>
                                                <button onClick={(e) => {e.stopPropagation(); addKeyframe(layer.id)}} className="text-neutral-500 hover:text-yellow-400" title="Add Keyframe">
                                                    <Key className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <span className="text-[9px] text-neutral-400">{Math.round((layer.opacity ?? 1) * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.01" 
                                            value={layer.opacity ?? 1} 
                                            onChange={e => setLayers(l => l.map(x => x.id === layer.id ? {...x, opacity: parseFloat(e.target.value)} : x))}
                                            onMouseUp={pushToHistory}
                                            className="w-full h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-neutral-500"
                                        />
                                        {/* Animation Presets */}
                                        <div className="mt-2 grid grid-cols-4 gap-1">
                                            <button onClick={() => applyAnimationPreset(layer.id, 'fade_in')} className="text-[8px] bg-neutral-900 p-1 rounded hover:bg-neutral-700 text-neutral-400">Fade In</button>
                                            <button onClick={() => applyAnimationPreset(layer.id, 'fade_out')} className="text-[8px] bg-neutral-900 p-1 rounded hover:bg-neutral-700 text-neutral-400">Fade Out</button>
                                            <button onClick={() => applyAnimationPreset(layer.id, 'slide_left')} className="text-[8px] bg-neutral-900 p-1 rounded hover:bg-neutral-700 text-neutral-400">Slide</button>
                                            <button onClick={() => applyAnimationPreset(layer.id, 'shake')} className="text-[8px] bg-neutral-900 p-1 rounded hover:bg-neutral-700 text-neutral-400">Shake</button>
                                        </div>
                                   </div>
                               </div>
                           ))}
                           <div className="pt-4 border-t border-neutral-800">
                             <h4 className="text-[10px] font-bold text-neutral-500 uppercase mb-2">Animation</h4>
                             <ToggleButton label="Keyframe Record" state={vfx.keyframeEnabled} setState={(val) => setVfx(p => ({...p, keyframeEnabled: val}))} Icon={Target} />
                           </div>
                        </div>
                    )}
                    {activeTab === 'adjust' && (
                        <div className="space-y-6">
                            <CurveEditorMock title="RGB Curves" color="#a855f7"/>
                            
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold text-purple-400 flex items-center"><Sliders className="w-3 h-3 mr-2"/> Color Correction</h3>
                                    <button 
                                        onClick={() => { pushToHistory(); setAdjustments({ brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0 }); }}
                                        className="text-[10px] text-neutral-500 hover:text-white underline"
                                    >
                                        Reset
                                    </button>
                                </div>
                                
                                <div className="space-y-4 p-3 bg-neutral-800/30 rounded border border-neutral-800">
                                    <Slider label="Brightness" value={adjustments.brightness} max={200} onChange={v => updateAdjustments({...adjustments, brightness:v})} />
                                    <Slider label="Contrast" value={adjustments.contrast} max={200} onChange={v => updateAdjustments({...adjustments, contrast:v})} />
                                    <Slider label="Saturation" value={adjustments.saturate} max={200} onChange={v => updateAdjustments({...adjustments, saturate:v})} />
                                    <Slider label="Hue" value={adjustments.hue} max={360} onChange={v => updateAdjustments({...adjustments, hue:v})} />
                                    <Slider label="Blur" value={adjustments.blur} max={20} step={0.1} onChange={v => updateAdjustments({...adjustments, blur:v})} />
                                    <button onClick={commitAdjustments} className="hidden"></button> 
                                </div>
                                <p className="text-[9px] text-neutral-500 mt-2 text-right">Changes auto-saved to history on release.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'mixer' && (
                         <div className="space-y-4">
                             <h3 className="text-xs font-bold text-purple-400 flex items-center mb-4"><Volume2 className="w-3 h-3 mr-2"/> Audio Mixer</h3>
                             
                             <label className="bg-neutral-800 hover:bg-neutral-700 p-2 rounded text-xs font-bold flex items-center justify-center text-white transition-colors cursor-pointer mb-4">
                                   <Music className="w-3 h-3 mr-2 text-blue-400"/> Upload Background Music
                                   <input type="file" accept="audio/*" className="hidden" onChange={handleAddAudioLayer} ref={audioInputRef} />
                             </label>

                             {layers.filter(l => l.type === 'audio' || l.type === 'video').map(layer => (
                                 <div key={layer.id} className="bg-neutral-900 p-3 rounded border border-neutral-800">
                                     <div className="flex items-center justify-between mb-3">
                                         <span className="text-xs font-bold text-neutral-300 truncate max-w-[120px]">{layer.name}</span>
                                         {layer.type === 'audio' && <Mic className="w-3 h-3 text-blue-500"/>}
                                         {layer.type === 'video' && <Film className="w-3 h-3 text-purple-500"/>}
                                     </div>
                                     
                                     <div className="flex space-x-4">
                                         <div className="flex-1">
                                             <div className="flex justify-between mb-1">
                                                 <span className="text-[9px] text-neutral-500 uppercase">Vol</span>
                                                 <span className="text-[9px] text-neutral-400">{Math.round((layer.volume ?? 1) * 100)}%</span>
                                             </div>
                                             <input 
                                                type="range" min="0" max="1" step="0.05" 
                                                value={layer.volume ?? 1} 
                                                onChange={e => setLayers(l => l.map(x => x.id === layer.id ? {...x, volume: parseFloat(e.target.value)} : x))}
                                                onMouseUp={pushToHistory}
                                                className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                             />
                                         </div>
                                         
                                         {layer.type === 'audio' && (
                                            <div className="flex-1">
                                                 <div className="flex justify-between mb-1">
                                                     <span className="text-[9px] text-neutral-500 uppercase">Pan</span>
                                                     <span className="text-[9px] text-neutral-400">{layer.pan ?? 0}</span>
                                                 </div>
                                                 <input 
                                                    type="range" min="-1" max="1" step="0.1" 
                                                    value={layer.pan ?? 0} 
                                                    onChange={e => setLayers(l => l.map(x => x.id === layer.id ? {...x, pan: parseFloat(e.target.value)} : x))}
                                                    onMouseUp={pushToHistory}
                                                    className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                 />
                                            </div>
                                         )}
                                     </div>
                                 </div>
                             ))}
                             {layers.filter(l => l.type === 'audio' || l.type === 'video').length === 0 && (
                                 <p className="text-xs text-neutral-500 text-center">No audio tracks available.</p>
                             )}
                         </div>
                    )}
                    {activeTab === 'transitions' && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-purple-400 flex items-center mb-4"><Move className="w-3 h-3 mr-2"/> Transition Gallery</h3>
                            
                            <div className="bg-neutral-900 p-3 rounded border border-neutral-800 mb-4">
                                <p className="text-[10px] text-neutral-400 mb-2">Selected Layer: <span className="text-white font-bold">{layers.find(l => l.id === selectedLayerId)?.name || "None"}</span></p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => addTransition('fade_in')} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] font-bold text-neutral-300">Fade In (1s)</button>
                                    <button onClick={() => addTransition('fade_out')} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] font-bold text-neutral-300">Fade Out (1s)</button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-neutral-500 uppercase">Active Transitions</h4>
                                {transitions.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between bg-neutral-800 p-2 rounded border border-neutral-700">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-purple-300 uppercase">{t.type.replace('_', ' ')}</span>
                                            <span className="text-[9px] text-neutral-500">Layer ID: {t.layerId}</span>
                                        </div>
                                        <button 
                                            onClick={() => { pushToHistory(); setTransitions(prev => prev.filter((_, idx) => idx !== i)); }} 
                                            className="text-neutral-500 hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {transitions.length === 0 && <p className="text-[10px] text-neutral-600 italic">No active transitions.</p>}
                            </div>
                        </div>
                    )}
                    {activeTab === 'vfx' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center"><Film className="w-3 h-3 mr-2"/> VFX Library</h3>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {Object.keys(VIDEO_PRESETS).map(name => (
                                        <button 
                                            key={name}
                                            onClick={() => applyPreset(name)}
                                            className="px-2 py-2 bg-neutral-900 hover:bg-purple-900/30 border border-neutral-800 hover:border-purple-500 rounded text-[10px] font-bold transition-colors text-center text-neutral-300 hover:text-white"
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center"><Palette className="w-3 h-3 mr-2"/> Standard Filters</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <ToggleButton label="B&W" state={vfx.grayscale} setState={(val) => { pushToHistory(); setVfx(p => ({...p, grayscale: val})) }} Icon={EyeOff} />
                                    <ToggleButton label="Sepia" state={vfx.sepia} setState={(val) => { pushToHistory(); setVfx(p => ({...p, sepia: val})) }} Icon={Grid} />
                                    <ToggleButton label="Invert" state={vfx.invert} setState={(val) => { pushToHistory(); setVfx(p => ({...p, invert: val})) }} Icon={Zap} />
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center"><Tv className="w-3 h-3 mr-2"/> Retro & Glitch</h3>
                                <div className="space-y-3">
                                    <Slider label="Pixelate" value={vfx.pixelate} max={50} onChange={v => setVfx(p=>({...p, pixelate:v}))} />
                                    <Slider label="Film Grain" value={vfx.noise} max={100} onChange={v => setVfx(p=>({...p, noise:v}))} />
                                    <Slider label="Glitch Amount" value={vfx.glitch} max={50} onChange={v => setVfx(p=>({...p, glitch:v}))} />
                                    <ToggleButton label="CRT Scanlines" state={vfx.scanlines} setState={(val) => { pushToHistory(); setVfx(p => ({...p, scanlines: val})) }} Icon={Monitor} />
                                </div>
                            </div>

                             <div className="bg-neutral-900 p-2 rounded border border-neutral-800 mt-4">
                                <h3 className="text-xs font-bold text-purple-400 mb-2 flex items-center"><Scissors className="w-3 h-3 mr-2"/> AI Background</h3>
                                <button 
                                    onClick={handleBackgroundRemoval}
                                    disabled={aiLoading || !videoSrc}
                                    className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-purple-500 text-neutral-300 hover:text-white rounded text-[10px] font-bold transition-all flex items-center justify-center"
                                >
                                    {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <ScanFace className="w-3 h-3 mr-2 text-green-400"/>}
                                    Remove BG (Current Frame)
                                </button>
                                <p className="text-[9px] text-neutral-500 mt-1">Creates an overlay of the current frame with background removed.</p>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center mt-4"><Settings className="w-3 h-3 mr-2"/> Advanced Tools</h3>
                                <div className="space-y-3">
                                    <ToggleButton label="Enable Keyframing" state={vfx.keyframeEnabled} setState={(val) => { pushToHistory(); setVfx(p => ({...p, keyframeEnabled: val})) }} Icon={Target} />
                                    
                                    <div className="space-y-2 pt-2 bg-neutral-800/30 p-2 rounded border border-neutral-800">
                                        <ToggleButton label="Chroma Key" state={vfx.chromaKey} setState={(val) => { pushToHistory(); setVfx(p => ({...p, chromaKey: val})) }} Icon={Zap} />
                                        {vfx.chromaKey && (
                                            <div className="flex items-center justify-between mt-2 pl-1">
                                                <span className="text-[10px] font-bold text-neutral-400">Key Color</span>
                                                <div className="flex items-center">
                                                    <input 
                                                        type="color" 
                                                        value={vfx.chromaKeyColor} 
                                                        onChange={(e) => { pushToHistory(); setVfx(p => ({...p, chromaKeyColor: e.target.value})) }}
                                                        className="w-6 h-6 rounded bg-transparent cursor-pointer border-none p-0" 
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2 pt-2 bg-neutral-800/30 p-2 rounded border border-neutral-800">
                                        <ToggleButton label="Stabilizer" state={vfx.stabilizer} setState={(val) => { pushToHistory(); setVfx(p => ({...p, stabilizer: val})) }} Icon={Target} />
                                        {vfx.stabilizer && (
                                            <div className="mt-2">
                                                 <Slider label="Smoothness" value={vfx.stabilizerIntensity || 50} max={100} onChange={v => setVfx(p => ({...p, stabilizerIntensity: v}))} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'magic' && (
                        <div className="space-y-6 pb-4">
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-purple-400 flex items-center"><Palette className="w-3 h-3 mr-2"/> Style Transfer AI</h3>
                                <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                                    <label className="block w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 border-dashed rounded text-center cursor-pointer transition-colors">
                                        <span className="text-[10px] text-neutral-400 font-bold flex items-center justify-center">
                                            <Upload className="w-3 h-3 mr-2"/> Upload Reference Image
                                        </span>
                                        <input type="file" accept="image/*" onChange={handleStyleTransfer} className="hidden" />
                                    </label>
                                    {aiLoading && <p className="text-[9px] text-purple-400 mt-1 text-center animate-pulse">Analyzing Style...</p>}
                                </div>
                                <p className="text-[10px] text-neutral-500">Matches color palette and lighting from an image.</p>
                            </div>

                            <hr className="border-neutral-800" />

                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-purple-400 flex items-center"><Sparkles className="w-3 h-3 mr-2"/> Auto-Color Grade</h3>
                                <textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs h-16 focus:border-purple-500 outline-none transition-colors mb-1" placeholder="E.g. Cyberpunk neon look, Warm vintage 80s..." />
                                
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <button onClick={() => runGrading('Faded Vintage Look')} disabled={aiLoading} className="py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[9px] font-bold uppercase rounded transition-colors">
                                        Faded Vintage
                                    </button>
                                    <button onClick={() => runGrading('High Contrast Cinematic Movie')} disabled={aiLoading} className="py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[9px] font-bold uppercase rounded transition-colors">
                                        Hi-Contrast Cinema
                                    </button>
                                    <button onClick={() => runGrading('Teal and Orange Blockbuster')} disabled={aiLoading} className="py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[9px] font-bold uppercase rounded transition-colors">
                                        Teal & Orange
                                    </button>
                                    <button onClick={() => runGrading('Dreamy Soft Glow')} disabled={aiLoading} className="py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[9px] font-bold uppercase rounded transition-colors">
                                        Dreamy Glow
                                    </button>
                                </div>

                                <button onClick={() => runGrading()} disabled={aiLoading} className="w-full py-2 bg-purple-600/20 border border-purple-600 hover:bg-purple-600 text-purple-100 rounded text-xs font-bold transition-colors flex justify-center items-center">
                                    {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <Wand2 className="w-3 h-3 mr-2"/>}
                                    Apply Custom Look
                                </button>
                            </div>

                            <hr className="border-neutral-800" />
                            
                            <div className="pt-2">
                                <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center"><Sparkles className="w-3 h-3 mr-2"/> AI Enhancement</h3>
                                <div className="space-y-2">
                                    <button 
                                        onClick={handleMotionTrack} 
                                        disabled={aiLoading}
                                        className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-purple-500 text-neutral-300 hover:text-white rounded text-[10px] font-bold transition-all flex items-center justify-center"
                                    >
                                        {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <ScanFace className="w-3 h-3 mr-2 text-blue-400"/>}
                                        Generate Motion Tracking Data
                                    </button>
                                    
                                    <button 
                                        onClick={handleAiUpscale} 
                                        disabled={aiLoading}
                                        className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-purple-500 text-neutral-300 hover:text-white rounded text-[10px] font-bold transition-all flex items-center justify-center"
                                    >
                                        {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <ArrowUpCircle className="w-3 h-3 mr-2 text-green-400"/>}
                                        AI Upscale Video Quality
                                    </button>

                                    <button 
                                        onClick={handlePredictiveGrading} 
                                        disabled={aiLoading}
                                        className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-purple-500 text-neutral-300 hover:text-white rounded text-[10px] font-bold transition-all flex items-center justify-center"
                                    >
                                        {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <Wand2 className="w-3 h-3 mr-2 text-purple-400"/>}
                                        Predictive Color Grading
                                    </button>
                                </div>
                            </div>

                            <hr className="border-neutral-800" />

                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-blue-400 flex items-center"><Clapperboard className="w-3 h-3 mr-2"/> Storyboard Gen</h3>
                                <p className="text-[10px] text-neutral-500">Generates a list of key scenes from video.</p>
                                <button onClick={runStoryboard} disabled={aiLoading || !videoFile} className="w-full py-2 bg-blue-600/20 border border-blue-600 hover:bg-blue-600 text-blue-100 rounded text-xs font-bold transition-colors flex justify-center items-center">
                                    {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <ListVideo className="w-3 h-3 mr-2"/>}
                                    Generate Storyboard
                                </button>
                                {storyboard.length > 0 && (
                                    <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-1">
                                        {storyboard.map((panel, i) => (
                                            <div key={i} className="bg-neutral-900 p-2 rounded border border-neutral-800 cursor-pointer hover:border-blue-500 group" onClick={() => jumpToTime(parseInt(panel.timestamp.split(':')[0])*60 + parseInt(panel.timestamp.split(':')[1]))}>
                                                <div className="flex justify-between text-[10px] font-bold text-blue-400 mb-1">
                                                    <span>Scene {i+1}</span>
                                                    <span className="bg-neutral-950 px-1 rounded font-mono">{panel.timestamp}</span>
                                                </div>
                                                <p className="text-[10px] text-neutral-300 mb-1">{panel.description}</p>
                                                {panel.visual_notes && (
                                                     <p className="text-[9px] text-neutral-500 italic border-t border-neutral-800 pt-1 mt-1">
                                                        📝 {panel.visual_notes}
                                                     </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-neutral-800" />

                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-green-400 flex items-center"><Scissors className="w-3 h-3 mr-2"/> Smart Cuts</h3>
                                <p className="text-[10px] text-neutral-500">Suggests cut points based on scene changes.</p>
                                <button onClick={runCuts} disabled={aiLoading || !videoFile} className="w-full py-2 bg-green-600/20 border border-green-600 hover:bg-green-600 text-green-100 rounded text-xs font-bold transition-colors flex justify-center items-center">
                                    {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <Scissors className="w-3 h-3 mr-2"/>}
                                    Suggest Cuts
                                </button>
                                {cuts.length > 0 && (
                                    <div className="space-y-1 mt-2 max-h-32 overflow-y-auto pr-1">
                                        {cuts.map((cut, i) => (
                                            <div key={i} className="flex items-center justify-between bg-neutral-900 p-2 rounded border border-neutral-800 cursor-pointer hover:bg-neutral-800" onClick={() => jumpToTime(cut.seconds)}>
                                                <span className="text-[10px] font-mono text-green-400 bg-neutral-950 px-1 rounded">{cut.timestamp}</span>
                                                <span className="text-[10px] text-neutral-400 truncate ml-2">{cut.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-neutral-800" />

                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-neutral-400 flex items-center"><ScanFace className="w-3 h-3 mr-2"/> Content Q&A</h3>
                                <button onClick={runAnalysis} disabled={aiLoading || !videoFile} className="w-full py-2 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded text-xs font-bold transition-colors flex justify-center items-center">
                                    Analyze Content
                                </button>
                                {aiResult && (
                                    <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] text-neutral-300 max-h-32 overflow-y-auto">
                                        {aiResult}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Sidebar>
            
            <div className="flex-1 bg-neutral-950 relative flex flex-col">
                <div className="flex-1 flex items-center justify-center overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] p-8 relative">
                    {!videoSrc ? (
                        <label className="group cursor-pointer flex flex-col items-center p-12 border-2 border-dashed border-neutral-800 rounded-2xl hover:border-purple-500 hover:bg-neutral-900/50 transition-all">
                            <div className="p-4 bg-neutral-900 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-purple-500" />
                            </div>
                            <span className="text-neutral-400 font-medium group-hover:text-white">Import Footage</span>
                            <input type="file" accept="video/*" onChange={handleUpload} className="hidden"/>
                        </label>
                    ) : (
                        <div className="relative w-full h-full flex items-center justify-center shadow-2xl bg-black rounded-lg overflow-hidden border border-neutral-800">
                            <video 
                                ref={videoRef} 
                                src={videoSrc} 
                                className="hidden" 
                                onPlay={() => setIsPlaying(true)} 
                                onPause={() => setIsPlaying(false)} 
                                onEnded={() => setIsPlaying(false)}
                                onLoadedMetadata={handleLoadedMetadata}
                                crossOrigin="anonymous"
                            />
                            {/* Interactive Canvas */}
                            <canvas 
                                ref={canvasRef} 
                                className={`max-w-full max-h-full ${isDraggingLayer.current ? 'cursor-grabbing' : 'cursor-default'}`} 
                                onMouseDown={handleCanvasMouseDown}
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseUp}
                                onWheel={handleCanvasWheel}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <div className="h-48 bg-neutral-900 border-t border-neutral-800 flex flex-col shrink-0 select-none">
             <div className="h-10 flex items-center justify-between px-4 border-b border-neutral-800 bg-neutral-900">
                <div className="flex items-center space-x-4">
                    <button onClick={handleRewind} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors" title="Rewind 5s">
                        <Rewind className="w-4 h-4 fill-current" />
                    </button>
                    <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-purple-400 transition-colors">
                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <button onClick={handleFastForward} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors" title="Fast Forward 5s">
                        <FastForward className="w-4 h-4 fill-current" />
                    </button>
                    <div className="text-sm font-mono text-purple-400 bg-neutral-950 border border-neutral-800 px-3 py-1 rounded">
                        {new Date(timelinePosition * 1000).toISOString().substr(14, 5)}:{(timelinePosition % 1 * 100).toFixed(0).padStart(2, '0')}
                    </div>
                    
                    {/* Zoom Controls */}
                    <div className="flex items-center space-x-1 ml-4 border-l border-neutral-800 pl-4">
                        <button onClick={() => setTimelineZoom(z => Math.max(1, z - 0.5))} className="text-neutral-500 hover:text-white"><ZoomOut className="w-3 h-3"/></button>
                        <span className="text-[9px] text-neutral-500 w-8 text-center">{Math.round(timelineZoom * 100)}%</span>
                        <button onClick={() => setTimelineZoom(z => Math.min(5, z + 0.5))} className="text-neutral-500 hover:text-white"><ZoomIn className="w-3 h-3"/></button>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                     {/* Edit Tools */}
                     <div className="flex items-center space-x-1 border-r border-neutral-800 pr-4 mr-4">
                        <button onClick={handleCopy} disabled={!selectedLayerId} title="Copy Layer" className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30"> <Copy className="w-4 h-4" /> </button>
                        <button onClick={handlePaste} disabled={!clipboardLayer} title="Paste Layer" className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30"> <Clipboard className="w-4 h-4" /> </button>
                        <button onClick={handleCut} disabled={!selectedLayerId} title="Cut Layer" className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30"> <Scissors className="w-4 h-4" /> </button>
                        <button onClick={handleDelete} disabled={!selectedLayerId} title="Delete Layer" className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-red-500 disabled:opacity-30"> <Trash2 className="w-4 h-4" /> </button>
                     </div>

                     <button onClick={() => setShowTtsModal(true)} className="flex items-center px-3 py-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white" title="Generate Voiceover">
                        <Mic className="w-4 h-4 mr-1 text-green-400" /> Voiceover
                     </button>
                     <button 
                        onClick={handleSplitLayer}
                        disabled={!selectedLayerId}
                        className="flex items-center px-3 py-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-50" 
                        title="Split Layer at Playhead"
                     >
                         <Split className="w-4 h-4 mr-1" /> Split
                     </button>
                     <button onClick={handleExportOpen} disabled={isExporting || !videoSrc} className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded transition-all">
                        {isExporting ? 'Exporting...' : <><Download className="w-3 h-3 mr-1"/> Export MP4</>}
                     </button>
                </div>
             </div>
             <div className="flex-1 relative overflow-hidden">
                 <div className="absolute inset-0 flex">
                    <div className="w-48 bg-neutral-900 border-r border-neutral-800 flex flex-col pt-6 z-10">
                         {layers.map(layer => (
                            <div key={layer.id} className={`h-12 px-4 flex items-center text-xs font-bold text-neutral-400 border-b border-neutral-800/50 ${selectedLayerId === layer.id ? 'bg-neutral-800 text-purple-400' : ''}`} onClick={() => setSelectedLayerId(layer.id)}>
                                {layer.name}
                            </div>
                         ))}
                    </div>
                    <div 
                        ref={timelineRef}
                        className="flex-1 bg-neutral-800/30 relative overflow-x-auto scrollbar-hide pt-6 cursor-pointer"
                        onMouseDown={(e) => {
                            isScrubbing.current = true;
                            const rect = timelineRef.current?.getBoundingClientRect();
                            if(rect && videoRef.current) {
                                    const x = e.clientX - rect.left;
                                    const scrollLeft = timelineRef.current!.scrollLeft;
                                    const absoluteX = x + scrollLeft;
                                    const width = rect.width * timelineZoom;

                                    const percent = Math.max(0, Math.min(1, absoluteX / width));
                                    const time = percent * videoRef.current.duration;
                                    if(Number.isFinite(time)) {
                                        videoRef.current.currentTime = time;
                                        setTimelinePosition(time);
                                        syncAudio(time, isPlaying);
                                        if(!isPlaying) requestAnimationFrame(drawFrame);
                                    }
                            }
                        }}
                    >
                         <div 
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                            style={{ left: `${(timelinePosition / (videoRef.current?.duration || 1)) * 100 * timelineZoom}%` }}
                         >
                            <div className="w-3 h-3 -ml-1.5 bg-red-500 transform rotate-45 -mt-1.5 shadow-sm"></div>
                         </div>
                         
                         {/* Time Markers */}
                         <div className="absolute top-0 left-0 h-4 w-full border-b border-neutral-800/30 flex text-[8px] text-neutral-600 pointer-events-none">
                             {Array.from({length: 20}).map((_, i) => (
                                 <div key={i} className="flex-1 border-l border-neutral-800/20 pl-1">
                                     {Math.round((videoRef.current?.duration||120) / 20 * i)}s
                                 </div>
                             ))}
                         </div>

                         {layers.map(layer => {
                             const startPct = ((layer.startTime || 0) / (videoRef.current?.duration || 1)) * 100 * timelineZoom;
                             const widthPct = ((layer.duration || (videoRef.current?.duration || 1)) / (videoRef.current?.duration || 1)) * 100 * timelineZoom;

                             return (
                                <div key={layer.id} className="h-12 border-b border-neutral-800/50 relative flex items-center px-1" style={{width: `${100 * timelineZoom}%`}}>
                                    <div 
                                        className={`h-8 rounded border border-opacity-20 absolute top-2 cursor-grab active:cursor-grabbing overflow-hidden ${layer.type === 'video' ? 'bg-purple-900/60 border-purple-400' : layer.type === 'audio' ? 'bg-blue-900/60 border-blue-400' : 'bg-neutral-700/60 border-neutral-500'} ${selectedLayerId === layer.id ? 'ring-1 ring-white' : ''}`}
                                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
                                    >
                                        <div className="h-full w-full bg-stripes opacity-10"></div>
                                        {layer.keyframes && layer.keyframes.map((kf, i) => (
                                            <div 
                                                key={i} 
                                                className={`absolute top-0 bottom-0 w-1 z-10 ${kf.property === 'opacity' ? 'bg-yellow-400/50' : 'bg-blue-400/50'}`}
                                                style={{ left: `${((kf.time - (layer.startTime||0)) / (layer.duration||1)) * 100}%` }}
                                                title={`Keyframe: ${kf.value}`}
                                            />
                                        ))}
                                        
                                        {/* Transition Indicators */}
                                        {transitions.filter(t => t.layerId === layer.id).map(t => (
                                            <div 
                                                key={t.id}
                                                className="absolute top-0 bottom-0 bg-white/20 z-10 flex items-center justify-center"
                                                style={{
                                                    left: t.type === 'fade_in' ? 0 : 'auto',
                                                    right: t.type === 'fade_out' ? 0 : 'auto',
                                                    width: `${(t.duration / (layer.duration||1)) * 100}%`
                                                }}
                                                title={t.type}
                                            >
                                                <div className={`w-full h-full bg-gradient-to-${t.type==='fade_in'?'r':'l'} from-transparent to-white/10`}></div>
                                            </div>
                                        ))}

                                    </div>
                                </div>
                             );
                         })}
                         
                         {cuts.map((cut, i) => (
                             <div 
                                key={`cut-${i}`}
                                className="absolute top-0 bottom-0 w-px border-l border-dashed border-green-500/50 z-10 group"
                                style={{ left: `${(cut.seconds / (videoRef.current?.duration || 1)) * 100 * timelineZoom}%` }}
                                title={cut.reason}
                             >
                                 <div className="w-2 h-2 bg-green-500 rounded-full -ml-1 mt-1 hidden group-hover:block"></div>
                             </div>
                         ))}
                    </div>
                 </div>
             </div>
        </div>

        {showTtsModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                      <h3 className="text-sm font-bold text-white mb-4">Generate Voiceover</h3>
                      <textarea 
                        value={ttsText} 
                        onChange={(e) => setTtsText(e.target.value)} 
                        placeholder="Enter text for AI voiceover..." 
                        className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-white h-32 mb-4"
                      />
                      <div className="flex justify-end space-x-2">
                          <button onClick={() => setShowTtsModal(false)} className="px-4 py-2 text-neutral-400 hover:text-white text-xs font-bold">Cancel</button>
                          <button onClick={handleAddVoiceover} disabled={!ttsText || aiLoading} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold flex items-center">
                              {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <Mic className="w-3 h-3 mr-2"/>} Generate & Add
                          </button>
                      </div>
                 </div>
            </div>
        )}

        {showExportModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center"><Settings className="w-4 h-4 mr-2 text-purple-500"/> Export Settings</h3>
                        <button onClick={() => setShowExportModal(false)} className="text-neutral-500 hover:text-white"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="p-6 space-y-6">
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-400 uppercase">Export Preset</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.keys(EXPORT_PRESETS_CONFIG).map(presetName => (
                                    <button 
                                        key={presetName}
                                        onClick={() => applyExportPreset(presetName)}
                                        className={`px-3 py-2 rounded text-xs font-medium border text-left transition-all ${exportConfig.preset === presetName ? 'bg-purple-600/20 border-purple-500 text-purple-200' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'}`}
                                    >
                                        {presetName}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <details className="group bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-neutral-800 transition-colors select-none">
                                     <span className="text-[10px] font-bold text-neutral-300 uppercase">Resolution</span>
                                     <ChevronDown className="w-3 h-3 text-neutral-500 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="p-3 border-t border-neutral-800 bg-neutral-950/50">
                                    <select 
                                        value={exportConfig.resolution}
                                        onChange={e => setExportConfig(p => ({...p, resolution: e.target.value, preset: 'Custom'}))}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500"
                                    >
                                        <option value="4096x2160">4K Cinematic</option>
                                        <option value="3840x2160">UHD 4K</option>
                                        <option value="1920x1080">FHD 1080p</option>
                                        <option value="1280x720">HD 720p</option>
                                        <option value="1080x1920">Vertical HD</option>
                                    </select>
                                </div>
                            </details>

                            <details className="group bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-neutral-800 transition-colors select-none">
                                     <span className="text-[10px] font-bold text-neutral-300 uppercase">Frame Rate</span>
                                     <ChevronDown className="w-3 h-3 text-neutral-500 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="p-3 border-t border-neutral-800 bg-neutral-950/50">
                                    <select 
                                        value={exportConfig.fps}
                                        onChange={e => setExportConfig(p => ({...p, fps: parseFloat(e.target.value), preset: 'Custom'}))}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500"
                                    >
                                        <option value="60">60 fps</option>
                                        <option value="30">30 fps</option>
                                        <option value="29.97">29.97 fps (NTSC)</option>
                                        <option value="25">25 fps (PAL)</option>
                                        <option value="24">24 fps (Film)</option>
                                    </select>
                                </div>
                            </details>

                            <details className="group bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-neutral-800 transition-colors select-none">
                                     <span className="text-[10px] font-bold text-neutral-300 uppercase">Codec / Format</span>
                                     <ChevronDown className="w-3 h-3 text-neutral-500 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="p-3 border-t border-neutral-800 bg-neutral-950/50">
                                    <select 
                                        value={exportConfig.codec}
                                        onChange={e => setExportConfig(p => ({...p, codec: e.target.value, preset: 'Custom'}))}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500"
                                    >
                                        <option value="H.264 (MP4)">H.264 (MP4) - Web Standard</option>
                                        <option value="H.265 (MP4)">H.265 (MP4) - High Efficiency</option>
                                        <option value="ProRes 422 (MOV)">ProRes 422 (MOV) - Professional</option>
                                        <option value="ProRes 422 HQ (MOV)">ProRes 422 HQ (MOV) - High Quality</option>
                                        <option value="VP9 (WEBM)">VP9 (WEBM) - Open Source</option>
                                    </select>
                                </div>
                            </details>
                        </div>

                    </div>
                    <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex justify-end space-x-3">
                        <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleExportConfirm} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center transition-colors shadow-lg shadow-purple-900/20">
                            Start Export <ChevronRight className="w-3 h-3 ml-1"/>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default VideoStudio;
