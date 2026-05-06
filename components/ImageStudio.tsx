
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layers, Sliders, Sparkles, Download, Brush, Eraser, Type, Image as ImageIcon, Undo, Redo, PenTool, ZoomIn, ZoomOut, Wand2, Film, ScanFace, Plus, Maximize, Palette, Box, Scissors, AlignLeft, AlignCenter, AlignRight, Save, Circle, Square, Star, Heart, Trash2, Move, Scale, Check, X, Settings, User, Shirt, Ruler, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Copy, Clipboard, MousePointer2, Users, FileJson, FolderOpen, PlayCircle, ChevronRight, Zap } from 'lucide-react';
import * as THREE from 'three';
import { Sidebar, TabButton, Slider, CurveEditorMock, ToggleButton } from './Shared';
import { ImageFilters, DrawSettings, Layer, Project } from '../types';
import { generateImageSettings, generateImage, editImage, analyzeImage, animateImage, upscaleImage, removeBackground } from '../services/geminiService';

const FILTER_PRESETS = {
    'Standard': { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, pixelate: 0, red: 100, green: 100, blue: 100 },
    'Vintage': { brightness: 110, contrast: 90, saturate: 85, grayscale: 0, sepia: 60, blur: 0, pixelate: 0, red: 100, green: 100, blue: 90 },
    'Noir': { brightness: 100, contrast: 140, saturate: 0, grayscale: 100, sepia: 0, blur: 0, pixelate: 0, red: 100, green: 100, blue: 100 },
    'Cinematic': { brightness: 110, contrast: 120, saturate: 125, grayscale: 0, sepia: 0, blur: 0, pixelate: 0, red: 100, green: 100, blue: 120 },
    'Dramatic': { brightness: 95, contrast: 150, saturate: 110, grayscale: 0, sepia: 0, blur: 0, pixelate: 0, red: 110, green: 100, blue: 100 },
    'Soft': { brightness: 115, contrast: 90, saturate: 90, grayscale: 0, sepia: 10, blur: 0.5, pixelate: 0, red: 105, green: 100, blue: 100 },
    '8-Bit': { brightness: 100, contrast: 120, saturate: 120, grayscale: 0, sepia: 0, blur: 0, pixelate: 5, red: 100, green: 100, blue: 100 },
};

const PASSPORT_TEMPLATES = {
    'US': { w: 600, h: 600, label: 'US Passport (2x2")', ratio: 1 },
    'UK_EU': { w: 413, h: 531, label: 'UK/EU/China (35x45mm)', ratio: 0.77 },
    'India': { w: 600, h: 600, label: 'India Passport (2x2")', ratio: 1 },
    'Japan': { w: 413, h: 531, label: 'Japan Visa (35x45mm)', ratio: 0.77 },
    'Schengen': { w: 413, h: 531, label: 'Schengen Visa (35x45mm)', ratio: 0.77 },
    'Canada': { w: 420, h: 540, label: 'Canada Visa (50x70mm)', ratio: 0.71 },
};

const FONT_OPTIONS = [
    { label: 'Inter (Sans)', value: 'Inter, sans-serif' },
    { label: 'Serif Classic', value: '"Times New Roman", serif' },
    { label: 'Monospace', value: '"Courier New", monospace' },
    { label: 'Impact Bold', value: 'Impact, sans-serif' },
    { label: 'Comic Marker', value: '"Comic Sans MS", cursive' },
];

const PRESET_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff', '#000000'];
const BLEND_MODES = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'];

interface SelectionRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const ImageStudio = ({ initialProject }: { initialProject?: Project | null }) => {
  const [imgSrc, setImgSrc] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState('layers');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isFirstRender = useRef(true);
  
  const [filters, setFilters] = useState<ImageFilters>({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, pixelate: 0, blendMode: 'normal', red: 100, green: 100, blue: 100 });
  
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({ 
      color: '#3b82f6', 
      size: 20, 
      tool: 'brush',
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
      textInput: 'Click to add text',
      textOutline: false,
      textOutlineColor: '#000000',
      textShadow: false,
      textShadowColor: '#000000',
      textShadowBlur: 5,
      textGlow: false,
      textGlowColor: '#3b82f6',
      textGlowBlur: 15,
      brushShape: 'circle',
      brushTexture: 'none',
      brushBlendMode: 'source-over',
      smoothing: 0,
      opacity: 1,
      jitter: 0
  });

  // Transform State (Resize/Crop)
  const [transform, setTransform] = useState({
    width: 0,
    height: 0,
    maintainAspect: true,
    unit: 'px' as 'px' | 'in' | 'mm' | 'cm',
    dpi: 72,
    cropX: 0,
    cropY: 0,
    cropW: 0,
    cropH: 0
  });

  // ID/Passport State
  const [passportOverlay, setPassportOverlay] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof PASSPORT_TEMPLATES | ''>('');

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSettings, setExportSettings] = useState({
      format: 'image/png',
      extension: 'png',
      quality: 1.0,
      name: 'ganeshaystudio_edit',
      targetSize: 0, // 0 means manual quality
      targetSizeUnit: 'KB' as 'KB' | 'MB' | 'GB'
  });
  const [estimatedSize, setEstimatedSize] = useState<string>('Calculating...');

  const [customBrushPattern, setCustomBrushPattern] = useState<CanvasPattern | null>(null);
  const [aiBrushPrompt, setAiBrushPrompt] = useState('');
  
  // Advanced: History State
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const MAX_HISTORY = 30;

  const [layers, setLayers] = useState<Layer[]>([
     { id: 1, name: 'Background', type: 'image', visible: true, active: true, blendMode: 'normal' }
  ]);

  // Editing State
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [clipboard, setClipboard] = useState<ImageData | null>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // AI States
  const [aiMode, setAiMode] = useState<'generate' | 'edit' | 'analyze' | 'animate' | 'retouch' | 'upscale' | 'remove-bg' | 'official'>('generate');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string>('');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [upscaleRes, setUpscaleRes] = useState<'2K' | '4K'>('2K');
  const [upscaleFactor, setUpscaleFactor] = useState('2x');
  const [zoom, setZoom] = useState(1);

  // Multi-user Mock
  const [collaborators, setCollaborators] = useState(['You']);

  // Animation Frame
  const animationRef = useRef<number | null>(null);

  // 3D Viewport State
  const mountRef = useRef<HTMLDivElement>(null);
  const [threeSettings, setThreeSettings] = useState({
      shape: 'cube',
      color: '#3b82f6',
      wireframe: false,
      autoRotate: true
  });
  
  const settingsRef = useRef(threeSettings);
  useEffect(() => {
      settingsRef.current = threeSettings;
  }, [threeSettings]);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const requestRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  // Drawing Refs
  const pointsRef = useRef<{x:number, y:number}[]>([]);
  const isDrawingRef = useRef(false);

  // Load Project Data
  useEffect(() => {
      if (initialProject && initialProject.data) {
          if (initialProject.data.filters) setFilters(initialProject.data.filters);
          if (initialProject.data.layers) setLayers(initialProject.data.layers);
          if (initialProject.data.base64Image) {
              updateCanvasImage(`data:image/png;base64,${initialProject.data.base64Image}`, true);
          }
          // Reset change tracker for initial load
          isFirstRender.current = true;
      }
  }, [initialProject]);

  // Update Transform State when Image loads
  useEffect(() => {
      if (imgSrc) {
          setTransform(prev => ({
              ...prev,
              width: imgSrc.width,
              height: imgSrc.height,
              cropW: imgSrc.width,
              cropH: imgSrc.height,
              cropX: 0,
              cropY: 0
          }));
      }
  }, [imgSrc]);

  // Track Unsaved Changes
  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      setHasUnsavedChanges(true);
  }, [filters, layers, historyStep]);

  // Load Auto-save
  useEffect(() => {
      if (!initialProject) {
          const saved = localStorage.getItem('ganeshaystudio_autosave');
          if (saved && !imgSrc) {
              updateCanvasImage(saved, true);
          }
      }
  }, []);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        
        switch(e.key.toLowerCase()) {
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
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStep, history, clipboard, selection]);

  const saveProject = () => {
      if (!canvasRef.current) return;
      const projectData: Project = {
          id: initialProject?.id || Date.now().toString(),
          name: initialProject?.name || `Image Project ${new Date().toLocaleDateString()}`,
          type: 'image',
          createdAt: Date.now(),
          data: {
              filters,
              layers,
              base64Image: canvasRef.current.toDataURL('image/png').split(',')[1]
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
        setAutoSaveStatus('saved');
        setHasUnsavedChanges(false);
        setTimeout(() => setAutoSaveStatus(null), 2000);
        alert("Project saved successfully!");
      } catch (e) {
        alert("Storage quota exceeded. Could not save project image data.");
      }
  };

  const handleExportProject = () => {
    if (!canvasRef.current) return;
    const projectData: Project = {
        id: Date.now().toString(),
        name: `Image Project ${new Date().toLocaleDateString()}`,
        type: 'image',
        createdAt: Date.now(),
        data: { filters, layers, base64Image: canvasRef.current.toDataURL('image/png').split(',')[1] }
    };
    const blob = new Blob([JSON.stringify(projectData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "image_project.json";
    link.click();
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const project = JSON.parse(event.target?.result as string);
                  if (project.type === 'image' && project.data) {
                      setFilters(project.data.filters || filters);
                      setLayers(project.data.layers || []);
                      if (project.data.base64Image) {
                          updateCanvasImage(`data:image/png;base64,${project.data.base64Image}`, true);
                      }
                      setHistory([]);
                      setHistoryStep(-1);
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

  // Auto-save Effect
  useEffect(() => {
      const save = () => {
          if (!canvasRef.current || !imgSrc) return;
          setAutoSaveStatus('saving');
          try {
              const dataUrl = canvasRef.current.toDataURL();
              localStorage.setItem('ganeshaystudio_autosave', dataUrl);
              setTimeout(() => setAutoSaveStatus('saved'), 500);
              setTimeout(() => setAutoSaveStatus(null), 2000);
          } catch (e) {
              console.warn("Auto-save failed (quota exceeded)");
          }
      };
      
      const timeout = setTimeout(save, 2000); 
      return () => clearTimeout(timeout);
  }, [historyStep, imgSrc]);

  const saveHistory = useCallback(() => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const data = ctx.getImageData(0,0, canvasRef.current.width, canvasRef.current.height);
      
      setHistory(prev => {
          // Slice history to current step (removes redo future)
          const newHistory = prev.slice(0, historyStep + 1);
          newHistory.push(data);
          // Limit history size to prevent memory crash
          if (newHistory.length > MAX_HISTORY) {
              newHistory.shift();
          }
          return newHistory;
      });
      
      setHistoryStep(prev => {
         const next = Math.min(prev + 1, MAX_HISTORY - 1);
         return next;
      });
  }, [historyStep]);

  const handleUndo = () => {
      if (historyStep > 0 && canvasRef.current) {
          const newStep = historyStep - 1;
          const ctx = canvasRef.current.getContext('2d');
          if (ctx && history[newStep]) {
              ctx.putImageData(history[newStep], 0, 0);
              setHistoryStep(newStep);
          }
      }
  };

  const handleRedo = () => {
      if (historyStep < history.length - 1 && canvasRef.current) {
          const newStep = historyStep + 1;
          const ctx = canvasRef.current.getContext('2d');
          if (ctx && history[newStep]) {
              ctx.putImageData(history[newStep], 0, 0);
              setHistoryStep(newStep);
          }
      }
  };

  const updateCanvasImage = (url: string, isNew: boolean = false) => {
    const img = new Image();
    img.src = url;
    img.crossOrigin = "Anonymous";
    img.onload = () => {
       setImgSrc(img);
       
       if (isNew) {
           setHistory([]);
           setHistoryStep(-1);
       }

       // Use requestAnimationFrame to ensure canvas is ready
       requestAnimationFrame(() => {
           draw(img);
           if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                    if (isNew) {
                        setHistory([data]);
                        setHistoryStep(0);
                    } else {
                        saveHistory();
                    }
                }
           }
       });
    };
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(file) {
       const url = URL.createObjectURL(file);
       updateCanvasImage(url, true);
       setHasUnsavedChanges(true);
       e.target.value = ''; // Clear input to allow selecting same file again
    }
  };

  const handleAddOverlay = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(file && canvasRef.current) {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.src = url;
          img.onload = () => {
              const ctx = canvasRef.current?.getContext('2d');
              if(ctx && canvasRef.current) {
                  // Draw centered, maintaining aspect ratio, max 80% of canvas
                  const cw = canvasRef.current.width;
                  const ch = canvasRef.current.height;
                  let iw = img.width;
                  let ih = img.height;
                  
                  const scale = Math.min((cw * 0.8) / iw, (ch * 0.8) / ih);
                  iw *= scale;
                  ih *= scale;
                  
                  const x = (cw - iw) / 2;
                  const y = (ch - ih) / 2;
                  
                  ctx.drawImage(img, x, y, iw, ih);
                  saveHistory();
                  setHasUnsavedChanges(true);
              }
          };
          e.target.value = ''; // Clear input
      }
  };

  // Unit Conversion Helpers
  const toPixels = (val: number, unit: string, dpi: number) => {
      if (unit === 'px') return val;
      if (unit === 'in') return val * dpi;
      if (unit === 'mm') return (val / 25.4) * dpi;
      if (unit === 'cm') return (val / 2.54) * dpi;
      return val;
  };

  // Resize Logic
  const handleResize = () => {
      if (!imgSrc || !canvasRef.current) return;
      
      const targetW = Math.round(toPixels(transform.width, transform.unit, transform.dpi));
      const targetH = Math.round(toPixels(transform.height, transform.unit, transform.dpi));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if(ctx) {
          ctx.drawImage(imgSrc, 0, 0, targetW, targetH);
          updateCanvasImage(canvas.toDataURL(), false);
          alert(`Resized to ${targetW}x${targetH}px (${transform.width}x${transform.height} ${transform.unit})`);
      }
  };

  // Crop Logic
  const handleCrop = () => {
      if (!imgSrc || !canvasRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = transform.cropW;
      canvas.height = transform.cropH;
      const ctx = canvas.getContext('2d');
      if(ctx) {
          ctx.drawImage(imgSrc, transform.cropX, transform.cropY, transform.cropW, transform.cropH, 0, 0, transform.cropW, transform.cropH);
          updateCanvasImage(canvas.toDataURL(), false);
          alert(`Cropped to ${transform.cropW}x${transform.cropH}px`);
      }
  };

  const handleRotate = (direction: 'cw' | 'ccw') => {
      if (!imgSrc) return;
      const canvas = document.createElement('canvas');
      canvas.width = imgSrc.height;
      canvas.height = imgSrc.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(direction === 'cw' ? Math.PI / 2 : -Math.PI / 2);
          ctx.drawImage(imgSrc, -imgSrc.width / 2, -imgSrc.height / 2);
          updateCanvasImage(canvas.toDataURL(), false);
      }
  };

  const handleFlip = (axis: 'horizontal' | 'vertical') => {
      if (!imgSrc) return;
      const canvas = document.createElement('canvas');
      canvas.width = imgSrc.width;
      canvas.height = imgSrc.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          if (axis === 'horizontal') {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
          } else {
              ctx.translate(0, canvas.height);
              ctx.scale(1, -1);
          }
          ctx.drawImage(imgSrc, 0, 0);
          updateCanvasImage(canvas.toDataURL(), false);
      }
  };

  // Apply Passport Template
  const applyPassportTemplate = (key: string) => {
      if (!key) return;
      const t = PASSPORT_TEMPLATES[key as keyof typeof PASSPORT_TEMPLATES];
      
      // Set Resize to correct dimensions
      setTransform(p => ({
          ...p,
          width: t.w,
          height: t.h,
          unit: 'px', // Templates are typically defined in pixels for exact canvas size
          maintainAspect: false // Override for exact dimensions
      }));
      
      // Calculate Center Crop based on aspect ratio of template
      if (imgSrc) {
          const imgRatio = imgSrc.width / imgSrc.height;
          const targetRatio = t.ratio;
          
          let cropW = imgSrc.width;
          let cropH = imgSrc.height;
          
          if (imgRatio > targetRatio) {
              // Image is wider than target, adjust width
              cropW = imgSrc.height * targetRatio;
          } else {
              // Image is taller, adjust height
              cropH = imgSrc.width / targetRatio;
          }
          
          setTransform(p => ({
              ...p,
              cropW: Math.round(cropW),
              cropH: Math.round(cropH),
              cropX: Math.round((imgSrc.width - cropW) / 2),
              cropY: Math.round((imgSrc.height - cropH) / 2)
          }));
      }
      setPassportOverlay(true);
  };

  const handleOfficialAI = async (action: 'white-bg' | 'suit') => {
      setAiLoading(true);
      const base64 = getCanvasBase64();
      if (!base64) return;

      try {
          if (action === 'white-bg') {
               const res = await editImage(base64, 'image/png', "Change the background to a solid clean white wall. Keep the person exactly the same.");
               if (res) updateCanvasImage(`data:image/png;base64,${res}`, false);
          } else if (action === 'suit') {
              const res = await editImage(base64, 'image/png', "Change the person's clothes to a professional dark business suit and tie. Keep the face and background unchanged.");
              if (res) updateCanvasImage(`data:image/png;base64,${res}`, false);
          }
          setHasUnsavedChanges(true);
      } catch (e) { console.error(e); }
      setAiLoading(false);
  }

  const draw = useCallback((sourceImg = imgSrc) => {
    if(!canvasRef.current || !sourceImg) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Only resize if it's a base image update/reset
    if (canvasRef.current.width !== sourceImg.width || canvasRef.current.height !== sourceImg.height) {
        canvasRef.current.width = sourceImg.width;
        canvasRef.current.height = sourceImg.height;
    }
    
    // Animation Effect Offset (Applied to whole canvas for "Motion" feature)
    const activeAnimation = layers.find(l => l.active && l.animation && l.animation !== 'none')?.animation;
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    let opacity = 1;
    let rotation = 0;

    if (activeAnimation) {
        const t = Date.now() / 1000;
        if (activeAnimation === 'shake') {
            offsetX = (Math.random() - 0.5) * 10;
            offsetY = (Math.random() - 0.5) * 10;
        } else if (activeAnimation === 'pulse') {
            scale = 1 + Math.sin(t * 5) * 0.05;
        } else if (activeAnimation === 'float') {
            offsetY = Math.sin(t * 2) * 10;
        } else if (activeAnimation === 'spin') {
            rotation = t % (Math.PI * 2);
        }
    }

    ctx.save();
    
    // Apply Transform for Animation
    ctx.translate(canvasRef.current.width/2 + offsetX, canvasRef.current.height/2 + offsetY);
    ctx.scale(scale, scale);
    ctx.rotate(rotation);
    ctx.translate(-canvasRef.current.width/2, -canvasRef.current.height/2);
    ctx.globalAlpha = opacity;

    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`;
    ctx.drawImage(sourceImg, 0, 0);
    ctx.filter = 'none';

    // RGB Channel Adjustment (Pixel Level)
    if (filters.red !== 100 || filters.green !== 100 || filters.blue !== 100) {
        const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const data = imageData.data;
        const rMult = filters.red / 100;
        const gMult = filters.green / 100;
        const bMult = filters.blue / 100;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] * rMult; // Red
            data[i+1] = data[i+1] * gMult; // Green
            data[i+2] = data[i+2] * bMult; // Blue
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Pixelate Effect
    if (filters.pixelate > 0) {
        const size = Math.max(1, filters.pixelate);
        const tempCanvas = document.createElement('canvas');
        const tw = Math.ceil(canvasRef.current.width / size);
        const th = Math.ceil(canvasRef.current.height / size);
        tempCanvas.width = tw;
        tempCanvas.height = th;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
            tctx.drawImage(canvasRef.current, 0, 0, tw, th);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tempCanvas, 0, 0, tw, th, 0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.imageSmoothingEnabled = true;
        }
    }

    ctx.restore();

    // Trigger next frame if animating
    if (activeAnimation) {
        animationRef.current = requestAnimationFrame(() => draw(sourceImg));
    }

  }, [imgSrc, filters, layers]); // Dependency on layers for animation state

  useEffect(() => {
    if(imgSrc) draw();
    return () => { if(animationRef.current) cancelAnimationFrame(animationRef.current); }
  }, [filters, draw, imgSrc]); // Removed specific animation loop here as it's handled in draw() recursion

  const getTexturePattern = (type: string, ctx: CanvasRenderingContext2D) => {
      if (type === 'custom' && customBrushPattern) return customBrushPattern;
      
      const tCanvas = document.createElement('canvas');
      tCanvas.width = 64; tCanvas.height = 64;
      const tCtx = tCanvas.getContext('2d');
      if (!tCtx) return null;

      if (type === 'canvas') {
          tCtx.fillStyle = '#e0e0e0';
          tCtx.fillRect(0,0,64,64);
          tCtx.fillStyle = 'rgba(0,0,0,0.1)';
          for(let i=0; i<64; i+=4) {
              tCtx.fillRect(i, 0, 1, 64);
              tCtx.fillRect(0, i, 64, 1);
          }
      } else if (type === 'wood') {
          tCtx.fillStyle = '#8B4513';
          tCtx.fillRect(0,0,64,64);
          tCtx.strokeStyle = '#654321';
          tCtx.beginPath();
          for(let i=0; i<10; i++) {
              tCtx.moveTo(0, i*6);
              tCtx.bezierCurveTo(20, i*6 + Math.random()*10, 40, i*6 - Math.random()*10, 64, i*6);
          }
          tCtx.stroke();
      } else if (type === 'paper') {
          tCtx.fillStyle = '#fffdf0';
          tCtx.fillRect(0,0,64,64);
          for(let i=0; i<100; i++) {
              tCtx.fillStyle = `rgba(0,0,0,${Math.random()*0.1})`;
              tCtx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
          }
      } else {
          return null;
      }
      
      return ctx.createPattern(tCanvas, 'repeat');
  };

  const drawShape = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shape: string, color: string | CanvasPattern) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.strokeStyle = color; 
      
      ctx.beginPath();
      if (shape === 'square') {
          ctx.fillRect(-size/2, -size/2, size, size);
      } else if (shape === 'circle') {
          ctx.arc(0, 0, size/2, 0, Math.PI * 2);
          ctx.fill();
      } else if (shape === 'star') {
          for (let i = 0; i < 5; i++) {
              ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * size, 
                         -Math.sin((18 + i * 72) * Math.PI / 180) * size);
              ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * size/2, 
                         -Math.sin((54 + i * 72) * Math.PI / 180) * size/2);
          }
          ctx.closePath();
          ctx.fill();
      } else if (shape === 'heart') {
         const topCurveHeight = size * 0.3;
         ctx.moveTo(0, topCurveHeight);
         ctx.bezierCurveTo(0, 0, -size/2, 0, -size/2, topCurveHeight);
         ctx.bezierCurveTo(-size/2, (size+topCurveHeight)/2, 0, size, 0, size);
         ctx.bezierCurveTo(0, size, size/2, (size+topCurveHeight)/2, size/2, topCurveHeight);
         ctx.bezierCurveTo(size/2, 0, 0, 0, 0, topCurveHeight);
         ctx.fill();
      }
      ctx.restore();
  };

  const startDrawing = useCallback((e: any) => {
    if (!imgSrc || (activeTab !== 'draw' && activeTab !== 'edit')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    if (activeTab === 'edit' && drawSettings.tool === 'select') {
       setIsSelecting(true);
       setSelection({x, y, w: 0, h: 0});
       return;
    }
    
    if (drawSettings.jitter && drawSettings.jitter > 0) {
        x += (Math.random() - 0.5) * drawSettings.jitter;
        y += (Math.random() - 0.5) * drawSettings.jitter;
    }

    pointsRef.current = [{x, y}];
    isDrawingRef.current = true;

    ctx.globalAlpha = drawSettings.opacity ?? 1;

    if (drawSettings.tool === 'text') {
        if (!drawSettings.textInput) return;
        
        ctx.font = `bold ${drawSettings.size}px ${drawSettings.fontFamily}`;
        ctx.textAlign = drawSettings.textAlign || 'left';
        ctx.textBaseline = 'middle';
        
        const lines = drawSettings.textInput.split('\n');
        const lineHeight = drawSettings.size * 1.2;
        
        lines.forEach((line, i) => {
            const lineY = y + (i * lineHeight);
            if (drawSettings.textGlow) {
                ctx.save();
                ctx.shadowBlur = drawSettings.textGlowBlur || 20;
                ctx.shadowColor = drawSettings.textGlowColor || drawSettings.color;
                ctx.fillStyle = drawSettings.textGlowColor || drawSettings.color;
                ctx.fillText(line, x, lineY);
                ctx.restore();
            }
            if (drawSettings.textShadow) {
                ctx.save();
                ctx.shadowColor = drawSettings.textShadowColor || 'black';
                ctx.shadowBlur = drawSettings.textShadowBlur || 5;
                ctx.shadowOffsetX = 4;
                ctx.shadowOffsetY = 4;
                ctx.fillStyle = 'black'; 
                ctx.fillText(line, x, lineY);
                ctx.restore();
            }
            ctx.fillStyle = drawSettings.color;
            ctx.fillText(line, x, lineY);
            if (drawSettings.textOutline) {
                ctx.lineWidth = Math.max(1, drawSettings.size / 20);
                ctx.strokeStyle = drawSettings.textOutlineColor || 'black';
                ctx.strokeText(line, x, lineY);
            }
        });

        ctx.globalAlpha = 1; 
        saveHistory();
        isDrawingRef.current = false;
        return; 
    }

    // Brush Setup
    ctx.lineCap = drawSettings.brushShape === 'square' ? 'square' : 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = drawSettings.size;
    ctx.globalCompositeOperation = drawSettings.tool === 'erase' ? 'destination-out' : (drawSettings.brushBlendMode || 'source-over') as any;
    
    let fillStyle: string | CanvasPattern = drawSettings.color;
    if (drawSettings.tool === 'brush' && drawSettings.brushTexture && drawSettings.brushTexture !== 'none') {
        const pat = getTexturePattern(drawSettings.brushTexture, ctx);
        if (pat) fillStyle = pat;
    }
    ctx.strokeStyle = fillStyle;
    ctx.fillStyle = fillStyle;

    // Initial dot/shape
    drawShape(ctx, x, y, drawSettings.size, drawSettings.brushShape || 'circle', fillStyle);
    
    ctx.beginPath();
    ctx.moveTo(x, y);

  }, [imgSrc, activeTab, drawSettings, saveHistory, customBrushPattern]);

  const drawMove = useCallback((e: any) => {
    if ((!isDrawingRef.current && !isSelecting) || !imgSrc || drawSettings.tool === 'text') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    if (isSelecting && selection) {
        setSelection(s => s ? ({...s, w: x - s.x, h: y - s.y}) : null);
        return;
    }

    if (drawSettings.jitter && drawSettings.jitter > 0) {
        x += (Math.random() - 0.5) * drawSettings.jitter;
        y += (Math.random() - 0.5) * drawSettings.jitter;
    }

    // Use interpolation to draw smooth shapes even when mouse moves fast
    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    if (lastPoint) {
        const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        const angle = Math.atan2(y - lastPoint.y, x - lastPoint.x);
        
        // Spacing: For smooth lines, use small step (0.1). For stamping shapes like stars, use larger step (0.5)
        const spacingMultiplier = ['star', 'heart'].includes(drawSettings.brushShape || '') ? 0.5 : 0.15;
        const step = Math.max(1, drawSettings.size * spacingMultiplier);
        
        let fillStyle: string | CanvasPattern = drawSettings.color;
        if (drawSettings.tool === 'brush' && drawSettings.brushTexture && drawSettings.brushTexture !== 'none') {
           const pat = getTexturePattern(drawSettings.brushTexture, ctx);
           if (pat) fillStyle = pat;
        }

        // Interpolate points between last and current
        for (let i = 0; i < dist; i += step) {
            const ix = lastPoint.x + (Math.cos(angle) * i);
            const iy = lastPoint.y + (Math.sin(angle) * i);
            
            if (drawSettings.tool === 'erase') {
                ctx.clearRect(ix - drawSettings.size/2, iy - drawSettings.size/2, drawSettings.size, drawSettings.size);
            } else {
                drawShape(ctx, ix, iy, drawSettings.size, drawSettings.brushShape || 'circle', fillStyle);
            }
        }
    }
    
    pointsRef.current.push({x, y});

  }, [imgSrc, drawSettings, customBrushPattern, isSelecting, selection]);

  const stopDrawing = useCallback(() => {
    if (isSelecting) {
        setIsSelecting(false);
        // Normalize rect (handle negative width/height)
        if (selection) {
            setSelection({
                x: selection.w < 0 ? selection.x + selection.w : selection.x,
                y: selection.h < 0 ? selection.y + selection.h : selection.y,
                w: Math.abs(selection.w),
                h: Math.abs(selection.h)
            });
        }
    }

    if (isDrawingRef.current) {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if(ctx) ctx.globalAlpha = 1; 
        }
        isDrawingRef.current = false;
        pointsRef.current = [];
        saveHistory(); 
    }
  }, [saveHistory, isSelecting, selection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', drawMove);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', drawMove);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseout', stopDrawing);
    };
  }, [startDrawing, drawMove, stopDrawing]);

  const getCanvasBase64 = () => {
      if (!canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png').split(',')[1];
  }

  const generateAIBrush = async () => {
      if (!aiBrushPrompt) return;
      setAiLoading(true);
      try {
        const b64 = await generateImage(`Seamless repeating texture pattern of ${aiBrushPrompt}. High contrast, white background.`, '1:1');
        if (b64) {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 128; canvas.height = 128;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 128, 128);
                    const pat = ctx.createPattern(canvas, 'repeat');
                    setCustomBrushPattern(pat);
                    setDrawSettings(p => ({...p, brushTexture: 'custom'}));
                }
            };
        }
      } catch (e) { console.error(e); }
      setAiLoading(false);
  };

  const runAI = async () => {
    if(!aiPrompt && aiMode !== 'animate' && aiMode !== 'upscale' && aiMode !== 'analyze' && aiMode !== 'remove-bg') return;
    setAiLoading(true);
    setAiResult('');
    setGeneratedVideo(null);

    try {
        if (aiMode === 'retouch') {
            const settings = await generateImageSettings(aiPrompt);
            if (settings) setFilters(prev => ({...prev, ...settings}));
        } else if (aiMode === 'generate') {
            const b64 = await generateImage(aiPrompt, aspectRatio);
            if (b64) {
                updateCanvasImage(`data:image/png;base64,${b64}`, true);
                setHasUnsavedChanges(true);
            }
        } else if (aiMode === 'edit') {
            const base64 = getCanvasBase64();
            if (base64) {
                const b64Res = await editImage(base64, 'image/png', aiPrompt);
                if (b64Res) {
                    updateCanvasImage(`data:image/png;base64,${b64Res}`, false);
                    setHasUnsavedChanges(true);
                }
            }
        } else if (aiMode === 'remove-bg') {
            const base64 = getCanvasBase64();
            if (base64) {
                const b64Res = await removeBackground(base64, 'image/png', aiPrompt);
                if (b64Res) {
                    updateCanvasImage(`data:image/png;base64,${b64Res}`, false);
                    setHasUnsavedChanges(true);
                }
            }
        } else if (aiMode === 'analyze') {
            const base64 = getCanvasBase64();
            if (base64) {
                const text = await analyzeImage(base64, 'image/png', aiPrompt || "Analyze this image");
                if (text) setAiResult(text);
            }
        } else if (aiMode === 'animate') {
            const base64 = getCanvasBase64();
            if (base64) {
                const vidUrl = await animateImage(base64, 'image/png', aspectRatio === '9:16' ? '9:16' : '16:9');
                if (vidUrl) setGeneratedVideo(vidUrl);
            }
        } else if (aiMode === 'upscale') {
            const base64 = getCanvasBase64();
            if (base64) {
                const b64Res = await upscaleImage(base64, 'image/png', upscaleRes, aspectRatio, upscaleFactor);
                if (b64Res) {
                    updateCanvasImage(`data:image/png;base64,${b64Res}`, false);
                    setHasUnsavedChanges(true);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    setAiLoading(false);
  };

  const calculateAutoQuality = () => {
      const canvas = canvasRef.current;
      if (!canvas || !exportSettings.targetSize) return;
      
      let multiplier = 1024;
      if (exportSettings.targetSizeUnit === 'MB') multiplier = 1024 * 1024;
      if (exportSettings.targetSizeUnit === 'GB') multiplier = 1024 * 1024 * 1024;

      let targetBytes = exportSettings.targetSize * multiplier;
      if (targetBytes <= 0) return;

      setEstimatedSize("Compressing...");
      
      // Binary search for quality
      let min = 0.01;
      let max = 1.0;
      let bestQuality = 0.8;
      
      // Iterative approximation (max 8 steps)
      for(let i=0; i<8; i++) {
          let mid = (min + max) / 2;
          let dataUrl = canvas.toDataURL(exportSettings.format, mid);
          // Base64 length approx: 4 characters = 3 bytes
          let size = (dataUrl.length - 22) * 3 / 4; // Subtract header approx
          
          if (size > targetBytes) {
              max = mid;
          } else {
              min = mid;
              bestQuality = mid;
          }
      }
      
      setExportSettings(p => ({...p, quality: bestQuality}));
      
      // Calculate final estimate
      let finalUrl = canvas.toDataURL(exportSettings.format, bestQuality);
      let finalSize = (finalUrl.length - 22) * 3 / 4;
      
      let displaySize = "";
      if(finalSize > 1024*1024*1024) displaySize = (finalSize / (1024*1024*1024)).toFixed(2) + " GB";
      else if(finalSize > 1024*1024) displaySize = (finalSize / (1024*1024)).toFixed(2) + " MB";
      else displaySize = (finalSize / 1024).toFixed(2) + " KB";

      setEstimatedSize(displaySize);
  };
  
  // Update estimate when quality changes manually
  useEffect(() => {
      if(showExportModal && canvasRef.current && exportSettings.targetSize === 0) {
          const dataUrl = canvasRef.current.toDataURL(exportSettings.format, exportSettings.quality);
          let size = (dataUrl.length - 22) * 3 / 4;
          let displaySize = "";
          if(size > 1024*1024*1024) displaySize = (size / (1024*1024*1024)).toFixed(2) + " GB";
          else if(size > 1024*1024) displaySize = (size / (1024*1024)).toFixed(2) + " MB";
          else displaySize = (size / 1024).toFixed(2) + " KB";
          setEstimatedSize(displaySize);
      }
  }, [exportSettings.quality, exportSettings.format, showExportModal]);

  const handleExportConfirm = () => {
    let canvas: HTMLCanvasElement | null = canvasRef.current;
    
    // Check if we are in 3D mode and try to grab the 3D canvas
    if (activeTab === '3d' && mountRef.current) {
        canvas = mountRef.current.querySelector('canvas');
    }

    if(canvas) {
        const link = document.createElement('a');
        const ext = exportSettings.extension || (exportSettings.format === 'image/jpeg' ? 'jpg' : exportSettings.format.split('/')[1]);
        link.download = `${exportSettings.name}.${ext}`;
        link.href = canvas.toDataURL(exportSettings.format, exportSettings.quality);
        link.click();
        setShowExportModal(false);
    }
  };

  const handleQuickSave = () => {
    let canvas: HTMLCanvasElement | null = canvasRef.current;
    
    // Check if we are in 3D mode and try to grab the 3D canvas
    if (activeTab === '3d' && mountRef.current) {
        canvas = mountRef.current.querySelector('canvas');
    }

    if (canvas) {
        const link = document.createElement('a');
        link.download = 'ganeshaystudio_quick_save.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
  };

  const handleCopy = () => {
      if (!selection || !canvasRef.current) return;
      if (selection.w <= 0 || selection.h <= 0) {
          alert("Select an area first using the Select tool.");
          return;
      }
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const data = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
      setClipboard(data);
  };

  const handleCut = () => {
      if (!selection || !canvasRef.current) return;
      if (selection.w <= 0 || selection.h <= 0) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const data = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
      setClipboard(data);
      ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
      setSelection(null);
      saveHistory();
  };

  const handlePaste = () => {
      if (!clipboard || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      // Paste at selection start or top-left
      const x = selection ? selection.x : 0;
      const y = selection ? selection.y : 0;
      
      ctx.putImageData(clipboard, x, y);
      saveHistory();
      // Move selection frame to pasted area
      setSelection({x, y, w: clipboard.width, h: clipboard.height});
  };

  useEffect(() => {
    if (activeTab !== '3d' || !mountRef.current) return;

    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(3, 3, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    let geometry;
    switch (threeSettings.shape) {
        case 'sphere': geometry = new THREE.SphereGeometry(2, 32, 32); break;
        case 'torus': geometry = new THREE.TorusGeometry(1.5, 0.5, 16, 100); break;
        case 'icosahedron': geometry = new THREE.IcosahedronGeometry(2, 0); break;
        case 'cone': geometry = new THREE.ConeGeometry(2, 4, 32); break;
        default: geometry = new THREE.BoxGeometry(3, 3, 3);
    }

    const material = new THREE.MeshStandardMaterial({
        color: threeSettings.color,
        wireframe: threeSettings.wireframe,
        roughness: 0.3,
        metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    sceneRef.current = scene;
    meshRef.current = mesh;

    const animate = () => {
        if (settingsRef.current.autoRotate && mesh && !isDragging.current) {
            mesh.rotation.y += 0.005;
        }
        renderer.render(scene, camera);
        requestRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
        if (!mountRef.current) return;
        const newW = mountRef.current.clientWidth;
        const newH = mountRef.current.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        renderer.dispose();
        window.removeEventListener('resize', handleResize);
    };
  }, [activeTab, threeSettings.shape, threeSettings.wireframe]);

  useEffect(() => {
    if (meshRef.current) {
        (meshRef.current.material as THREE.MeshStandardMaterial).color.set(threeSettings.color);
    }
  }, [threeSettings.color]);

  const handle3DMouseDown = (e: React.MouseEvent) => {
      isDragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handle3DMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current || !meshRef.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      meshRef.current.rotation.y += dx * 0.01;
      meshRef.current.rotation.x += dy * 0.01;
      prevMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handle3DMouseUp = () => { isDragging.current = false; };

  const handleAddCollaborator = () => {
    const name = prompt("Enter collaborator name (Simulated):");
    if (name) {
        setCollaborators([...collaborators, name]);
        alert(`${name} has been invited to collaborate!`);
    }
  };

  const handleSetLayerAnimation = (type: Layer['animation']) => {
      setLayers(prev => prev.map((l, i) => i === 0 ? { ...l, animation: type } : l));
  };

  return (
    <div className="flex h-full bg-[#1a1a1a] relative">
      <Sidebar>
         <div className="p-4 flex flex-col space-y-2 border-b border-neutral-800">
             <div className="flex justify-between items-center">
                 <button onClick={saveProject} className={`text-xs px-3 py-1 rounded flex items-center font-bold transition-all ${hasUnsavedChanges ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>
                    {hasUnsavedChanges ? 'Save *' : 'Saved'}
                </button>
                <div className="flex space-x-2">
                     <button onClick={handleExportProject} className="p-1 text-neutral-400 hover:text-white" title="Export Project File (JSON)"><Save className="w-4 h-4"/></button>
                     <label className="p-1 text-neutral-400 hover:text-white cursor-pointer" title="Import Project File (JSON)">
                         <FolderOpen className="w-4 h-4"/>
                         <input type="file" accept=".json" onChange={handleImportProject} ref={projectInputRef} className="hidden"/>
                     </label>
                </div>
             </div>
             <div className="flex justify-between items-center w-full">
                <button onClick={handleAddCollaborator} className="flex items-center text-[10px] bg-neutral-800 px-2 py-1 rounded text-green-400 hover:bg-neutral-700 w-fit">
                    <Users className="w-3 h-3 mr-1"/> {collaborators.length} Online
                </button>
                <div className="flex space-x-1">
                    <button onClick={handleUndo} disabled={historyStep <= 0} className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo className="w-4 h-4"/></button>
                    <button onClick={handleRedo} disabled={historyStep >= history.length - 1} className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo className="w-4 h-4"/></button>
                </div>
             </div>
         </div>
         <TabButton active={activeTab === 'layers'} onClick={() => setActiveTab('layers')} icon={Layers} label="Layers" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'edit'} onClick={() => setActiveTab('edit')} icon={MousePointer2} label="Edit" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'transform'} onClick={() => setActiveTab('transform')} icon={Scale} label="Transform" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')} icon={Sliders} label="Adjust" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'motion'} onClick={() => setActiveTab('motion')} icon={PlayCircle} label="Motion" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'draw'} onClick={() => setActiveTab('draw')} icon={PenTool} label="Paint" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'id'} onClick={() => setActiveTab('id')} icon={User} label="ID Photo" colorClass="border-blue-500" />
         <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={Sparkles} label="Gen AI" colorClass="border-blue-500" />
         <TabButton active={activeTab === '3d'} onClick={() => setActiveTab('3d')} icon={Box} label="3D Assets" colorClass="border-blue-500" />

         <div className="mt-4 p-4 border-t border-neutral-800 flex-1 overflow-y-auto">
             {activeTab === 'layers' && (
                 <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <label className="py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer text-neutral-300 hover:text-white transition-colors">
                            <ImageIcon className="w-3 h-3 mr-1"/> 
                            {imgSrc ? "Replace Base" : "Import"}
                            <input type="file" accept="image/*" onChange={handleUpload} className="hidden"/>
                        </label>
                        <label className={`py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer text-neutral-300 hover:text-white transition-colors ${!imgSrc ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Plus className="w-3 h-3 mr-1"/> 
                            Add Overlay
                            <input type="file" accept="image/*" onChange={handleAddOverlay} disabled={!imgSrc} className="hidden"/>
                        </label>
                    </div>

                    {imgSrc && (
                         <button 
                             onClick={() => {
                                 setImgSrc(null);
                                 setHistory([]);
                                 setHistoryStep(-1);
                                 if(canvasRef.current) {
                                     const ctx = canvasRef.current.getContext('2d');
                                     ctx?.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
                                 }
                                 localStorage.removeItem('ganeshaystudio_autosave');
                             }}
                             className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded flex items-center justify-center text-xs font-bold text-red-400 mb-4 transition-colors"
                         >
                             <Trash2 className="w-4 h-4 mr-2" /> Clear Canvas
                         </button>
                    )}

                    {layers.map(layer => (
                        <div key={layer.id} className="bg-neutral-800 rounded border border-neutral-700 p-2">
                             <div className="flex items-center justify-between text-xs mb-2">
                                <span className='font-medium'>{layer.name}</span>
                                <Layers className="w-4 h-4 text-blue-500" />
                             </div>
                             <div className="flex items-center space-x-2">
                                 <span className="text-[10px] text-neutral-400">Mode:</span>
                                 <select 
                                    value={layer.blendMode || 'normal'} 
                                    onChange={(e) => setLayers(ls => ls.map(l => l.id === layer.id ? {...l, blendMode: e.target.value} : l))}
                                    className="bg-neutral-900 text-[10px] rounded border border-neutral-700 p-1 flex-1"
                                 >
                                     <option value="normal">Normal</option>
                                     {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                 </select>
                             </div>
                        </div>
                    ))}
                 </div>
             )}
             {activeTab === 'edit' && (
                 <div className="space-y-4">
                     <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><MousePointer2 className="w-3 h-3 mr-2"/> Selection Tools</h3>
                     
                     <button 
                        onClick={() => {
                            setDrawSettings(p => ({...p, tool: 'select'}));
                        }}
                        className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center border transition-all ${drawSettings.tool === 'select' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}
                     >
                        <MousePointer2 className="w-4 h-4 mr-2"/> Marquee Select
                     </button>
                     <p className="text-[9px] text-neutral-500">Click and drag on canvas to select an area.</p>

                     <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleCopy} disabled={!selection} className="py-2 bg-neutral-900 border border-neutral-800 hover:border-blue-500 rounded text-xs font-bold text-neutral-300 disabled:opacity-50">
                            <Copy className="w-4 h-4 mx-auto mb-1"/> Copy
                        </button>
                        <button onClick={handlePaste} disabled={!clipboard} className="py-2 bg-neutral-900 border border-neutral-800 hover:border-blue-500 rounded text-xs font-bold text-neutral-300 disabled:opacity-50">
                            <Clipboard className="w-4 h-4 mx-auto mb-1"/> Paste
                        </button>
                        <button onClick={handleCut} disabled={!selection} className="py-2 bg-neutral-900 border border-neutral-800 hover:border-blue-500 rounded text-xs font-bold text-neutral-300 disabled:opacity-50">
                            <Scissors className="w-4 h-4 mx-auto mb-1"/> Cut
                        </button>
                        <button onClick={() => setSelection(null)} disabled={!selection} className="py-2 bg-neutral-900 border border-neutral-800 hover:border-red-500 rounded text-xs font-bold text-neutral-300 disabled:opacity-50">
                            <X className="w-4 h-4 mx-auto mb-1"/> Deselect
                        </button>
                     </div>
                 </div>
             )}
             {activeTab === 'motion' && (
                 <div className="space-y-4">
                     <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><PlayCircle className="w-3 h-3 mr-2"/> Motion Animation</h3>
                     <p className="text-[10px] text-neutral-500">Apply simple real-time animations to the canvas.</p>
                     
                     <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => handleSetLayerAnimation('none')} className={`p-2 rounded text-xs font-bold ${!layers[0]?.animation || layers[0].animation === 'none' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>None</button>
                         <button onClick={() => handleSetLayerAnimation('pulse')} className={`p-2 rounded text-xs font-bold ${layers[0]?.animation === 'pulse' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>Pulse</button>
                         <button onClick={() => handleSetLayerAnimation('shake')} className={`p-2 rounded text-xs font-bold ${layers[0]?.animation === 'shake' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>Shake</button>
                         <button onClick={() => handleSetLayerAnimation('float')} className={`p-2 rounded text-xs font-bold ${layers[0]?.animation === 'float' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>Float</button>
                         <button onClick={() => handleSetLayerAnimation('spin')} className={`p-2 rounded text-xs font-bold ${layers[0]?.animation === 'spin' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>Spin</button>
                     </div>
                 </div>
             )}
             {activeTab === 'id' && (
                 <div className="space-y-6">
                    <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><User className="w-3 h-3 mr-2"/> ID & Passport Tools</h3>
                    
                    <div className="space-y-2 bg-neutral-900 p-3 rounded border border-neutral-800">
                         <label className="text-[10px] text-neutral-500 uppercase">Templates</label>
                         <select 
                            value={selectedTemplate}
                            onChange={e => {
                                setSelectedTemplate(e.target.value as any);
                                applyPassportTemplate(e.target.value);
                            }}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-xs"
                         >
                             <option value="">Select Country/Type...</option>
                             {Object.entries(PASSPORT_TEMPLATES).map(([k, v]) => (
                                 <option key={k} value={k}>{v.label}</option>
                             ))}
                         </select>
                    </div>

                    <div className="space-y-2 bg-neutral-900 p-3 rounded border border-neutral-800">
                        <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-neutral-300">Compliance Overlay</span>
                             <ToggleButton label={passportOverlay ? "On" : "Off"} state={passportOverlay} setState={setPassportOverlay} Icon={ScanFace} />
                        </div>
                        <p className="text-[9px] text-neutral-500">Shows face oval and eye line guide.</p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><Sparkles className="w-3 h-3 mr-2"/> One-Click Fixes (AI)</h3>
                        
                        <button 
                            onClick={() => handleOfficialAI('white-bg')} 
                            disabled={aiLoading || !imgSrc}
                            className="w-full py-2 bg-neutral-800 hover:bg-blue-900/30 border border-neutral-700 hover:border-blue-500 rounded text-xs font-bold transition-colors flex items-center justify-center"
                        >
                            <Scissors className="w-3 h-3 mr-2"/> Make Background White
                        </button>

                         <button 
                            onClick={() => handleOfficialAI('suit')} 
                            disabled={aiLoading || !imgSrc}
                            className="w-full py-2 bg-neutral-800 hover:bg-blue-900/30 border border-neutral-700 hover:border-blue-500 rounded text-xs font-bold transition-colors flex items-center justify-center"
                        >
                            <Shirt className="w-3 h-3 mr-2"/> Change to Suit
                        </button>
                    </div>
                    
                    {aiLoading && <p className="text-[10px] text-blue-400 animate-pulse text-center">Processing official request...</p>}

                    <div className="p-2 bg-blue-900/20 border border-blue-500/20 rounded">
                        <h4 className="text-[10px] font-bold text-blue-400 mb-1">Official Guidance</h4>
                        <ul className="text-[9px] text-neutral-400 list-disc list-inside space-y-1">
                            <li>Expression must be neutral (no smiling).</li>
                            <li>Eyes must be open and visible.</li>
                            <li>No shadows on face or background.</li>
                            <li>Head centered within the oval guide.</li>
                        </ul>
                    </div>
                 </div>
             )}
             {activeTab === 'transform' && (
                 <div className="space-y-6">
                    <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><Scale className="w-3 h-3 mr-2"/> Image Size</h3>
                    <div className="space-y-3 bg-neutral-900 p-3 rounded border border-neutral-800">
                        
                        <div className="flex space-x-2 items-center mb-2">
                            <label className="text-[10px] text-neutral-500">Units:</label>
                            <select 
                                value={transform.unit} 
                                onChange={e => {
                                    const newUnit = e.target.value as any;
                                    setTransform(p => ({...p, unit: newUnit}));
                                }}
                                className="bg-neutral-950 border border-neutral-700 rounded p-1 text-xs flex-1"
                            >
                                <option value="px">Pixels (px)</option>
                                <option value="in">Inches (in)</option>
                                <option value="mm">Millimeters (mm)</option>
                                <option value="cm">Centimeters (cm)</option>
                            </select>
                        </div>

                        {transform.unit !== 'px' && (
                             <div className="mb-2">
                                 <label className="text-[10px] text-neutral-500 block mb-1">DPI (Resolution)</label>
                                 <input type="number" value={transform.dpi} onChange={e => setTransform(p => ({...p, dpi: parseInt(e.target.value)}))} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                             </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-neutral-500 block mb-1">Width ({transform.unit})</label>
                                <input type="number" value={transform.width} onChange={(e) => {
                                    const w = parseFloat(e.target.value);
                                    setTransform(p => ({
                                        ...p, 
                                        width: w,
                                        height: p.maintainAspect ? parseFloat((w * (p.height/p.width)).toFixed(2)) : p.height
                                    }))
                                }} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-neutral-500 block mb-1">Height ({transform.unit})</label>
                                <input type="number" value={transform.height} onChange={(e) => {
                                    const h = parseFloat(e.target.value);
                                    setTransform(p => ({
                                        ...p, 
                                        height: h,
                                        width: p.maintainAspect ? parseFloat((h * (p.width/p.height)).toFixed(2)) : p.width
                                    }))
                                }} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                            </div>
                        </div>
                        <ToggleButton label="Constrain Proportions" state={transform.maintainAspect} setState={v => setTransform(p => ({...p, maintainAspect: v}))} Icon={Move} />
                        <button onClick={handleResize} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold">Apply Resize</button>
                        {transform.unit !== 'px' && (
                             <p className="text-[9px] text-neutral-500 text-center">
                                 Output: {Math.round(toPixels(transform.width, transform.unit, transform.dpi))} x {Math.round(toPixels(transform.height, transform.unit, transform.dpi))} px
                             </p>
                        )}
                    </div>

                    <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center pt-2"><Move className="w-3 h-3 mr-2"/> Orientation</h3>
                    <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-3 rounded border border-neutral-800">
                        <button onClick={() => handleRotate('ccw')} className="py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px]">
                            <RotateCcw className="w-4 h-4 mb-1 text-neutral-400"/> Rotate Left
                        </button>
                        <button onClick={() => handleRotate('cw')} className="py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px]">
                            <RotateCw className="w-4 h-4 mb-1 text-neutral-400"/> Rotate Right
                        </button>
                        <button onClick={() => handleFlip('horizontal')} className="py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px]">
                            <FlipHorizontal className="w-4 h-4 mb-1 text-neutral-400"/> Flip Horiz.
                        </button>
                        <button onClick={() => handleFlip('vertical')} className="py-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px]">
                            <FlipVertical className="w-4 h-4 mb-1 text-neutral-400"/> Flip Vert.
                        </button>
                    </div>

                    <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center pt-2"><Scissors className="w-3 h-3 mr-2"/> Canvas Crop (px)</h3>
                    <div className="space-y-3 bg-neutral-900 p-3 rounded border border-neutral-800">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-neutral-500 block mb-1">X (Left)</label>
                                <input type="number" value={transform.cropX} onChange={(e) => setTransform(p => ({...p, cropX: parseInt(e.target.value)}))} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] text-neutral-500 block mb-1">Y (Top)</label>
                                <input type="number" value={transform.cropY} onChange={(e) => setTransform(p => ({...p, cropY: parseInt(e.target.value)}))} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] text-neutral-500 block mb-1">Width</label>
                                <input type="number" value={transform.cropW} onChange={(e) => setTransform(p => ({...p, cropW: parseInt(e.target.value)}))} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                            </div>
                            <div>
                                <label className="text-[10px] text-neutral-500 block mb-1">Height</label>
                                <input type="number" value={transform.cropH} onChange={(e) => setTransform(p => ({...p, cropH: parseInt(e.target.value)}))} className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs" />
                            </div>
                        </div>
                        <button onClick={handleCrop} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold">Apply Crop</button>
                    </div>
                 </div>
             )}
             {activeTab === 'adjust' && (
                 <div className="space-y-6">
                    <CurveEditorMock title="Tone Curve" color="#3b82f6"/>
                    <div className="space-y-4 bg-neutral-900 p-3 rounded border border-neutral-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-neutral-300">Basic</span>
                            <button onClick={() => setFilters({ brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, pixelate: 0, blendMode: 'normal', red: 100, green: 100, blue: 100 })} className="text-[10px] text-blue-400">Reset</button>
                        </div>
                        <Slider label="Brightness" value={filters.brightness} max={200} onChange={v => setFilters({...filters, brightness:v})} />
                        <Slider label="Contrast" value={filters.contrast} max={200} onChange={v => setFilters({...filters, contrast:v})} />
                        <Slider label="Saturation" value={filters.saturate} max={200} onChange={v => setFilters({...filters, saturate:v})} />
                        <Slider label="Blur" value={filters.blur} max={20} step={0.1} onChange={v => setFilters({...filters, blur:v})} />
                        
                        <div className="pt-2 border-t border-neutral-800 mt-2">
                             <span className="text-xs font-bold text-neutral-300 block mb-2">RGB Channels</span>
                             <Slider label="Red" value={filters.red || 100} max={200} onChange={v => setFilters({...filters, red:v})} />
                             <Slider label="Green" value={filters.green || 100} max={200} onChange={v => setFilters({...filters, green:v})} />
                             <Slider label="Blue" value={filters.blue || 100} max={200} onChange={v => setFilters({...filters, blue:v})} />
                        </div>

                        <div className="pt-2 border-t border-neutral-800 mt-2">
                            <span className="text-xs font-bold text-neutral-300 block mb-2">Creative</span>
                            <Slider label="Pixelate" value={filters.pixelate} max={50} onChange={v => setFilters({...filters, pixelate:v})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {Object.keys(FILTER_PRESETS).map(key => (
                            <button 
                                key={key}
                                onClick={() => setFilters({ ...filters, ...FILTER_PRESETS[key as keyof typeof FILTER_PRESETS] })}
                                className="p-2 bg-neutral-800 hover:bg-blue-900/30 text-[10px] font-bold text-neutral-300 border border-neutral-700 hover:border-blue-500 rounded transition-all"
                            >
                                {key}
                            </button>
                        ))}
                    </div>
                 </div>
             )}
             {activeTab === 'draw' && (
                 <div className="space-y-6">
                     <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-900 rounded border border-neutral-800">
                         <button onClick={() => setDrawSettings(d => ({...d, tool: 'brush'}))} className={`p-2 rounded flex flex-col items-center justify-center ${drawSettings.tool === 'brush' ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}>
                             <Brush className="w-4 h-4 mb-1"/> <span className="text-[8px] uppercase font-bold">Brush</span>
                         </button>
                         <button onClick={() => setDrawSettings(d => ({...d, tool: 'erase'}))} className={`p-2 rounded flex flex-col items-center justify-center ${drawSettings.tool === 'erase' ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}>
                             <Eraser className="w-4 h-4 mb-1"/> <span className="text-[8px] uppercase font-bold">Erase</span>
                         </button>
                         <button onClick={() => setDrawSettings(d => ({...d, tool: 'text'}))} className={`p-2 rounded flex flex-col items-center justify-center ${drawSettings.tool === 'text' ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}>
                             <Type className="w-4 h-4 mb-1"/> <span className="text-[8px] uppercase font-bold">Text</span>
                         </button>
                     </div>

                     <div className="space-y-4 bg-neutral-900 p-3 rounded border border-neutral-800">
                         <h4 className="text-[10px] font-bold text-neutral-500 uppercase">Brush Settings</h4>
                         
                         <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-neutral-400">Color</span>
                                <div className="flex items-center space-x-2 bg-neutral-950 p-1 rounded border border-neutral-700">
                                    <div className="w-4 h-4 rounded-full" style={{backgroundColor: drawSettings.color}}></div>
                                    <span className="text-[10px] font-mono text-neutral-300">{drawSettings.color}</span>
                                    <input type="color" value={drawSettings.color} onChange={e => setDrawSettings(d => ({...d, color: e.target.value}))} className="w-6 h-6 opacity-0 absolute cursor-pointer"/>
                                </div>
                            </div>
                            <div className="flex justify-between">
                                {PRESET_COLORS.map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setDrawSettings(d => ({...d, color: c}))}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${drawSettings.color === c ? 'border-white' : 'border-transparent'}`}
                                        style={{backgroundColor: c}}
                                    />
                                ))}
                            </div>
                         </div>
                         
                         <Slider label="Size" value={drawSettings.size} max={100} min={1} onChange={v => setDrawSettings(d => ({...d, size: v}))} />
                         <Slider label="Opacity" value={drawSettings.opacity ?? 1} max={1} step={0.1} onChange={v => setDrawSettings(d => ({...d, opacity: v}))} />
                         
                         {drawSettings.tool === 'brush' && (
                             <>
                                 <div className="space-y-2 pt-2 border-t border-neutral-800">
                                     <span className="text-[10px] text-neutral-400 block">Shape</span>
                                     <div className="grid grid-cols-4 gap-2">
                                          {['circle', 'square', 'star', 'heart'].map(s => (
                                              <button key={s} onClick={() => setDrawSettings(d => ({...d, brushShape: s as any}))} className={`p-1 rounded border flex items-center justify-center ${drawSettings.brushShape === s ? 'bg-blue-600 border-blue-500' : 'bg-neutral-800 border-neutral-700'}`}>
                                                  {s === 'circle' && <Circle className="w-3 h-3"/>}
                                                  {s === 'square' && <Square className="w-3 h-3"/>}
                                                  {s === 'star' && <Star className="w-3 h-3"/>}
                                                  {s === 'heart' && <Heart className="w-3 h-3"/>}
                                              </button>
                                          ))}
                                     </div>
                                 </div>

                                 <div className="space-y-2 pt-2 border-t border-neutral-800">
                                    <span className="text-[10px] text-neutral-400 block">Texture</span>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['none', 'canvas', 'paper', 'wood'].map(t => (
                                            <button 
                                                key={t} 
                                                onClick={() => setDrawSettings(d => ({...d, brushTexture: t as any}))} 
                                                className={`p-1 rounded border flex items-center justify-center text-[9px] capitalize ${drawSettings.brushTexture === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                 </div>

                                 <div className="space-y-2 pt-2 border-t border-neutral-800">
                                    <span className="text-[10px] text-neutral-400 block flex items-center"><Sparkles className="w-3 h-3 mr-1 text-purple-400"/> AI Texture Gen</span>
                                    <div className="flex space-x-2">
                                        <input 
                                            type="text" 
                                            value={aiBrushPrompt} 
                                            onChange={(e) => setAiBrushPrompt(e.target.value)} 
                                            placeholder="e.g. fire, scales..." 
                                            className="flex-1 bg-neutral-950 border border-neutral-700 rounded p-1 text-xs text-white"
                                        />
                                        <button 
                                            onClick={generateAIBrush} 
                                            disabled={aiLoading} 
                                            className="bg-purple-600 hover:bg-purple-500 text-white p-1.5 rounded"
                                        >
                                            <Wand2 className="w-3 h-3"/>
                                        </button>
                                    </div>
                                    {drawSettings.brushTexture === 'custom' && (
                                        <p className="text-[9px] text-green-400">Custom texture active</p>
                                    )}
                                 </div>

                                 <div className="space-y-2 pt-2 border-t border-neutral-800">
                                     <span className="text-[10px] text-neutral-400 block">Blend Mode</span>
                                     <select 
                                        value={drawSettings.brushBlendMode} 
                                        onChange={e => setDrawSettings(d => ({...d, brushBlendMode: e.target.value}))}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs text-white"
                                     >
                                         {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                     </select>
                                 </div>
                             </>
                         )}
                         
                         {drawSettings.tool === 'text' && (
                             <div className="space-y-2 pt-2 border-t border-neutral-800">
                                 <input 
                                     type="text" 
                                     value={drawSettings.textInput} 
                                     onChange={e => setDrawSettings(d => ({...d, textInput: e.target.value}))}
                                     className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs text-white"
                                     placeholder="Text to add..."
                                 />
                                 <select 
                                     value={drawSettings.fontFamily} 
                                     onChange={e => setDrawSettings(d => ({...d, fontFamily: e.target.value}))}
                                     className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs text-white"
                                 >
                                     {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                 </select>
                             </div>
                         )}
                     </div>
                 </div>
             )}
             
             {activeTab === 'ai' && (
                 <div className="space-y-4">
                     <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><Sparkles className="w-3 h-3 mr-2"/> Generative AI</h3>
                     
                     {!aiResult && !generatedVideo && (
                         <div className="grid grid-cols-3 gap-2 mb-4">
                             {['generate', 'edit', 'remove-bg', 'upscale', 'animate', 'analyze', 'retouch'].map(mode => (
                                 <button
                                     key={mode}
                                     onClick={() => setAiMode(mode as any)}
                                     className={`p-2 rounded border flex flex-col items-center justify-center text-center transition-all ${aiMode === mode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600'}`}
                                 >
                                     {mode === 'generate' && <ImageIcon className="w-4 h-4 mb-1"/>}
                                     {mode === 'edit' && <Wand2 className="w-4 h-4 mb-1"/>}
                                     {mode === 'remove-bg' && <Scissors className="w-4 h-4 mb-1"/>}
                                     {mode === 'upscale' && <Maximize className="w-4 h-4 mb-1"/>}
                                     {mode === 'animate' && <Film className="w-4 h-4 mb-1"/>}
                                     {mode === 'analyze' && <ScanFace className="w-4 h-4 mb-1"/>}
                                     {mode === 'retouch' && <Sparkles className="w-4 h-4 mb-1"/>}
                                     <span className="text-[8px] font-bold uppercase">{mode.replace('-', ' ')}</span>
                                 </button>
                             ))}
                         </div>
                     )}

                     <div className="bg-neutral-900 p-3 rounded border border-neutral-800 space-y-3">
                         
                         {aiMode !== 'retouch' && aiMode !== 'upscale' && (
                             <textarea 
                                 value={aiPrompt} 
                                 onChange={e => setAiPrompt(e.target.value)} 
                                 placeholder={
                                     aiMode === 'generate' ? "Describe the image to create..." : 
                                     aiMode === 'edit' ? "Describe the change (e.g. add sunglasses)..." :
                                     aiMode === 'remove-bg' ? "Describe subject (optional)..." :
                                     "Describe your request..."
                                 } 
                                 className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-xs text-white h-20"
                             />
                         )}
                         
                         {aiMode === 'generate' && (
                             <div className="flex items-center space-x-2">
                                 <span className="text-[10px] text-neutral-500">Aspect:</span>
                                 <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-neutral-950 border border-neutral-700 rounded p-1 text-xs flex-1">
                                     <option value="1:1">1:1 Square</option>
                                     <option value="16:9">16:9 Landscape</option>
                                     <option value="9:16">9:16 Portrait</option>
                                     <option value="4:3">4:3 Standard</option>
                                     <option value="3:4">3:4 Portrait</option>
                                 </select>
                             </div>
                         )}
                         
                         {aiMode === 'upscale' && (
                             <div className="flex items-center space-x-2">
                                 <span className="text-[10px] text-neutral-500">Resolution:</span>
                                 <select value={upscaleRes} onChange={e => setUpscaleRes(e.target.value as any)} className="bg-neutral-950 border border-neutral-700 rounded p-1 text-xs flex-1">
                                     <option value="2K">2K (High)</option>
                                     <option value="4K">4K (Ultra)</option>
                                 </select>
                             </div>
                         )}

                         <button 
                             onClick={runAI} 
                             disabled={aiLoading}
                             className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded text-xs font-bold flex items-center justify-center transition-all"
                         >
                             {aiLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <Wand2 className="w-3 h-3 mr-2"/>}
                             {aiMode === 'generate' ? "Generate Image" : "Run Process"}
                         </button>
                     </div>
                     
                     {aiResult && (
                         <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] text-neutral-300 max-h-32 overflow-y-auto">
                             {aiResult}
                         </div>
                     )}
                     
                     {generatedVideo && (
                         <div className="space-y-2">
                             <h4 className="text-[10px] font-bold text-neutral-500 uppercase">Generated Video</h4>
                             <video src={generatedVideo} controls className="w-full rounded border border-neutral-800" />
                         </div>
                     )}
                 </div>
             )}
             
             {activeTab === '3d' && (
                 <div className="space-y-4">
                     <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center"><Box className="w-3 h-3 mr-2"/> 3D Assets</h3>
                     <div className="bg-neutral-900 p-3 rounded border border-neutral-800 space-y-3">
                         <div>
                             <span className="text-[10px] text-neutral-500 block mb-1">Shape</span>
                             <select 
                                 value={threeSettings.shape}
                                 onChange={e => setThreeSettings(p => ({...p, shape: e.target.value}))}
                                 className="w-full bg-neutral-950 border border-neutral-700 rounded p-1 text-xs text-white"
                             >
                                 <option value="cube">Cube</option>
                                 <option value="sphere">Sphere</option>
                                 <option value="cone">Cone</option>
                                 <option value="torus">Torus</option>
                                 <option value="icosahedron">Icosahedron</option>
                             </select>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-[10px] text-neutral-500">Color</span>
                             <input type="color" value={threeSettings.color} onChange={e => setThreeSettings(p => ({...p, color: e.target.value}))} className="w-6 h-6 rounded bg-transparent border-none p-0 cursor-pointer"/>
                         </div>
                         <ToggleButton label="Wireframe" state={threeSettings.wireframe} setState={v => setThreeSettings(p => ({...p, wireframe: v}))} Icon={Box} />
                         <ToggleButton label="Auto Rotate" state={threeSettings.autoRotate} setState={v => setThreeSettings(p => ({...p, autoRotate: v}))} Icon={RotateCw} />
                         
                         <button 
                             onClick={handleQuickSave}
                             className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-xs font-bold text-neutral-300 hover:text-white mt-2"
                         >
                             Capture View to Image
                         </button>
                     </div>
                 </div>
             )}
         </div>
      </Sidebar>

      <div className="flex-1 bg-[#121212] flex flex-col items-center justify-center relative overflow-hidden p-8">
           {/* Main Canvas Area */}
           <div className="relative shadow-2xl overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] border border-neutral-800 rounded-lg max-w-full max-h-full flex items-center justify-center">
               {!imgSrc && activeTab !== '3d' ? (
                   <div className="flex flex-col items-center p-12 text-neutral-500">
                       <ImageIcon className="w-16 h-16 mb-4 opacity-20"/>
                       <p>No Image Loaded</p>
                       <label className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer transition-colors text-xs font-bold">
                           Upload Image
                           <input type="file" accept="image/*" onChange={handleUpload} className="hidden"/>
                       </label>
                   </div>
               ) : activeTab === '3d' ? (
                   <div 
                      ref={mountRef} 
                      className="w-[800px] h-[600px] cursor-move bg-neutral-900"
                      onMouseDown={handle3DMouseDown}
                      onMouseMove={handle3DMouseMove}
                      onMouseUp={handle3DMouseUp}
                      onMouseLeave={handle3DMouseUp}
                   ></div>
               ) : (
                   <>
                      <canvas 
                          ref={canvasRef} 
                          className={`max-w-full max-h-full object-contain ${activeTab === 'draw' || activeTab === 'edit' ? 'cursor-crosshair' : 'cursor-default'}`}
                      />
                      {/* Passport Overlay Guide */}
                      {activeTab === 'id' && passportOverlay && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-4 border-green-500/50">
                              <div className="w-[60%] h-[75%] border-2 border-dashed border-green-400/80 rounded-[50%] absolute top-[10%] opacity-70"></div>
                              <div className="w-full h-px bg-green-400/50 absolute top-[45%]"></div>
                              <div className="w-px h-full bg-green-400/50 absolute left-1/2"></div>
                              <div className="absolute bottom-2 right-2 bg-green-900/80 text-green-400 px-2 py-1 text-xs rounded">ID Guide On</div>
                          </div>
                      )}
                      {/* Selection Overlay */}
                      {selection && (
                          <div 
                              className="absolute border-2 border-dashed border-white bg-blue-500/20 pointer-events-none"
                              style={{
                                  left: selection.x, 
                                  top: selection.y, 
                                  width: selection.w, 
                                  height: selection.h
                              }}
                          ></div>
                      )}
                   </>
               )}
           </div>
           
           {/* Zoom/Pan Controls could go here */}
           {(imgSrc || activeTab === '3d') && (
               <div className="absolute bottom-4 right-4 bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-full px-4 py-2 flex items-center space-x-4">
                   <button onClick={() => { if(canvasRef.current) { canvasRef.current.style.transform = `scale(${zoom - 0.1})`; setZoom(z=>z-0.1); } }}><ZoomOut className="w-4 h-4 text-neutral-400"/></button>
                   <span className="text-xs font-mono text-neutral-400">{Math.round(zoom * 100)}%</span>
                   <button onClick={() => { if(canvasRef.current) { canvasRef.current.style.transform = `scale(${zoom + 0.1})`; setZoom(z=>z+0.1); } }}><ZoomIn className="w-4 h-4 text-neutral-400"/></button>
               </div>
           )}
      </div>
      
      {showExportModal && (
           <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6">
                   <h3 className="text-lg font-bold text-white mb-4">Export Image</h3>
                   <div className="space-y-4">
                       <div>
                           <label className="text-xs text-neutral-500">Format</label>
                           <select value={exportSettings.format} onChange={e => setExportSettings(p => ({...p, format: e.target.value}))} className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-white">
                               <option value="image/png">PNG</option>
                               <option value="image/jpeg">JPEG</option>
                               <option value="image/webp">WebP</option>
                           </select>
                       </div>
                       <div>
                           <label className="text-xs text-neutral-500">Quality</label>
                           <input type="range" min="0" max="1" step="0.1" value={exportSettings.quality} onChange={e => setExportSettings(p => ({...p, quality: parseFloat(e.target.value)}))} className="w-full" />
                       </div>
                       <button onClick={handleExportConfirm} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold text-white">Download</button>
                       <button onClick={() => setShowExportModal(false)} className="w-full py-2 text-neutral-500 text-sm">Cancel</button>
                   </div>
               </div>
           </div>
      )}
    </div>
  );
};

export default ImageStudio;
