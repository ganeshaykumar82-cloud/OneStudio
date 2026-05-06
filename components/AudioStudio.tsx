
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Sliders, Sparkles, Play, Pause, Settings2, Volume2, Square, Download, ArrowRight, Save, Music, Zap, Gauge, Waves, X, Settings, Undo, Redo, ListMusic, Disc, Music4, Drum, Scissors, Copy, Clipboard, Trash, ZoomIn, ZoomOut, Crop, MousePointer2, Flag, Circle, StopCircle, Speaker, Radio, Maximize2, Move, ChevronRight, TrendingUp, TrendingDown, Repeat, Grid3X3, Users, FolderOpen, FileJson } from 'lucide-react';
import { Sidebar, TabButton, Slider, ToggleButton } from './Shared';
import { AudioEQ, AudioCompressor, Project, AudioProjectState } from '../types';
import { generateAudioSettings, generateSpeech } from '../services/geminiService';

// --- Audio Helpers for PCM to WAV ---
const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const createWavBlob = (pcmData: Float32Array, sampleRate: number = 44100, numChannels: number = 1) => {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length * 2, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
    view.setUint16(32, numChannels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length * 2, true);
    
    // Write PCM data (Float to Int16)
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, pcmData[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
};

// Buffer Manipulation Helpers
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    
    let result;
    if (numChannels === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }

    return createWavBlob(result, sampleRate, numChannels);
}

const interleave = (inputL: Float32Array, inputR: Float32Array) => {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;

    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

// Reverb Impulse Response Generator
const createImpulseResponse = (duration: number, decay: number, ctx: BaseAudioContext) => {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i;
        const vol = Math.pow(1 - n / length, decay);
        left[i] = (Math.random() * 2 - 1) * vol;
        right[i] = (Math.random() * 2 - 1) * vol;
    }
    return impulse;
};

// --- Constants ---
const EQ_FREQUENCIES = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_PRESETS: Record<string, number[]> = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Deep Bass': [8, 6, 3, 0, -2, -2, 0, 0, 2, 3],
    'Heavy Metal': [6, 4, 0, -3, -2, 2, 4, 5, 4, 3],
    'Vocal Boost': [-2, -2, -2, 2, 5, 5, 4, 2, 1, 0],
    'Electronic': [5, 4, 2, 0, -2, 2, 0, 2, 4, 5],
    'Podcast': [-5, -2, 0, 2, 2, 3, 2, 0, -2, -5],
};

interface LibraryTrack {
    id: string;
    name: string;
    url: string;
    duration: string;
}

interface AudioMarker {
    id: number;
    time: number;
    label: string;
    color: string;
}

const DRUM_ROWS = ['kick', 'snare', 'hihat', 'clap'];

const AudioStudio = ({ initialProject }: { initialProject?: Project | null }) => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [trackName, setTrackName] = useState("No Track Loaded");
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState('mixer');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const projectInputRef = useRef<HTMLInputElement>(null);
  
  // Audio Graph Nodes
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassBoostNodeRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const loudnessNodeRef = useRef<GainNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]); // 10-Band EQ
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const reverbGainRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);
  const virtualizerDelayRef = useRef<DelayNode | null>(null);
  const virtualizerGainRef = useRef<GainNode | null>(null);
  
  const rafRef = useRef<number | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isFirstRender = useRef(true);

  // Mixer State
  const [volume, setVolume] = useState(0.8);
  const [vizMode, setVizMode] = useState<'spectrum' | 'waveform'>('spectrum');
  
  // Processing State
  const [eq, setEq] = useState<AudioEQ>({ gains: new Array(10).fill(0) });
  const [compressor, setCompressor] = useState<AudioCompressor>({ threshold: -20, ratio: 4, attack: 0.1, release: 0.5 });
  const [bassBoost, setBassBoost] = useState(0); // 0 to 20 dB
  const [loudness, setLoudness] = useState(false);
  const [virtualizer, setVirtualizer] = useState(0); // 0 to 100%
  
  // Advanced FX State
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [reverbMix, setReverbMix] = useState(0); // 0 to 1
  const [reverbSize, setReverbSize] = useState(2.0); // Seconds
  const [delayTime, setDelayTime] = useState(0); // Seconds
  const [delayFeedback, setDelayFeedback] = useState(0.3);
  
  // Drum Pad State
  const [activeDrum, setActiveDrum] = useState<string | null>(null);

  // Sequencer State
  const [sequencerGrid, setSequencerGrid] = useState<boolean[][]>(
    Array(4).fill(null).map(() => Array(16).fill(false))
  );
  const [isSequencerPlaying, setIsSequencerPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  const sequencerRef = useRef<number | null>(null);

  // Editor State
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selection, setSelection] = useState<{start: number, end: number} | null>(null);
  const [cursorTime, setCursorTime] = useState(0);
  const [clipboard, setClipboard] = useState<AudioBuffer | null>(null);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const waveformWrapperRef = useRef<HTMLDivElement>(null);
  const [seekOnLoad, setSeekOnLoad] = useState<number | null>(null);

  // Visual Feedback
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Library
  const [library, setLibrary] = useState<LibraryTrack[]>([]);

  // History
  const [history, setHistory] = useState<AudioProjectState[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // TTS States
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [generatedTtsUrl, setGeneratedTtsUrl] = useState<string | null>(null);

  // Multi-user Mock
  const [collaborators, setCollaborators] = useState(['You']);

  // ... (Previous History, Undo/Redo, Feedback, Init Effects code remains same) ...
  // Undo/Redo Logic
  const pushToHistory = useCallback(() => {
      const currentState: AudioProjectState = {
          volume,
          eq: JSON.parse(JSON.stringify(eq)),
          compressor: {...compressor},
          reverbMix,
          delayTime,
          delayFeedback,
          playbackRate,
          bassBoost,
          loudness: loudness ? 1 : 0,
          virtualizer
      };

      setHistory(prev => {
          const newHistory = prev.slice(0, historyStep + 1);
          newHistory.push(currentState);
          if (newHistory.length > 20) newHistory.shift();
          return newHistory;
      });
      setHistoryStep(prev => Math.min(prev + 1, 19));
  }, [volume, eq, compressor, reverbMix, delayTime, delayFeedback, playbackRate, bassBoost, loudness, virtualizer, historyStep]);

  // Initial History
  useEffect(() => {
      if (history.length === 0) {
          pushToHistory();
      }
  }, []);

  const handleUndo = () => {
      if (historyStep > 0) {
          const prev = history[historyStep - 1];
          setVolume(prev.volume);
          setEq(prev.eq);
          setCompressor(prev.compressor);
          setReverbMix(prev.reverbMix);
          setDelayTime(prev.delayTime);
          setDelayFeedback(prev.delayFeedback);
          setPlaybackRate(prev.playbackRate);
          setBassBoost(prev.bassBoost);
          setLoudness(!!prev.loudness);
          setVirtualizer(prev.virtualizer);
          setHistoryStep(prev => prev - 1);
      }
  };

  const handleRedo = () => {
      if (historyStep < history.length - 1) {
          const next = history[historyStep + 1];
          setVolume(next.volume);
          setEq(next.eq);
          setCompressor(next.compressor);
          setReverbMix(next.reverbMix);
          setDelayTime(next.delayTime);
          setDelayFeedback(next.delayFeedback);
          setPlaybackRate(next.playbackRate);
          setBassBoost(next.bassBoost);
          setLoudness(!!next.loudness);
          setVirtualizer(next.virtualizer);
          setHistoryStep(prev => prev + 1);
      }
  };

  const showFeedback = (text: string) => {
      setFeedbackText(text);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
          setFeedbackText(null);
      }, 1500);
  };

  useEffect(() => {
     const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
     audioCtxRef.current = new AudioContext();
     analyserRef.current = audioCtxRef.current.createAnalyser();
     analyserRef.current.fftSize = 2048; 
     
     // Initialize Nodes
     gainNodeRef.current = audioCtxRef.current.createGain(); // Master Volume
     loudnessNodeRef.current = audioCtxRef.current.createGain(); // Loudness Boost
     compressorNodeRef.current = audioCtxRef.current.createDynamicsCompressor();
     
     // Bass Boost
     bassBoostNodeRef.current = audioCtxRef.current.createBiquadFilter();
     bassBoostNodeRef.current.type = 'lowshelf';
     bassBoostNodeRef.current.frequency.value = 100;
     bassBoostNodeRef.current.gain.value = 0;

     // Create 10 EQ Band Filters
     eqNodesRef.current = EQ_FREQUENCIES.map(freq => {
         const node = audioCtxRef.current!.createBiquadFilter();
         node.type = 'peaking';
         node.frequency.value = freq;
         node.Q.value = 1.4; // Standard Q for octave bands
         node.gain.value = 0;
         return node;
     });

     // FX Nodes
     reverbNodeRef.current = audioCtxRef.current.createConvolver();
     reverbGainRef.current = audioCtxRef.current.createGain();
     delayNodeRef.current = audioCtxRef.current.createDelay(5.0);
     delayGainRef.current = audioCtxRef.current.createGain();

     // Virtualizer (Simple Haaz Effect / Delay)
     virtualizerDelayRef.current = audioCtxRef.current.createDelay(1.0);
     virtualizerGainRef.current = audioCtxRef.current.createGain();

     return () => { audioCtxRef.current?.close(); }
  }, []);

  // Initialize Reverb Impulse
  useEffect(() => {
      if (audioCtxRef.current && reverbNodeRef.current) {
          reverbNodeRef.current.buffer = createImpulseResponse(reverbSize, 2.0, audioCtxRef.current);
      }
  }, [reverbSize]);

  // Load Project Data
  useEffect(() => {
      if (initialProject && initialProject.data) {
          if (initialProject.data.volume !== undefined) setVolume(initialProject.data.volume);
          if (initialProject.data.eq) setEq(initialProject.data.eq);
          if (initialProject.data.compressor) setCompressor(initialProject.data.compressor);
          if (initialProject.data.vizMode) setVizMode(initialProject.data.vizMode);
          if (initialProject.data.reverbMix !== undefined) setReverbMix(initialProject.data.reverbMix);
          if (initialProject.data.delayTime !== undefined) setDelayTime(initialProject.data.delayTime);
          if (initialProject.data.playbackRate !== undefined) setPlaybackRate(initialProject.data.playbackRate);
          if (initialProject.data.bassBoost !== undefined) setBassBoost(initialProject.data.bassBoost);
          if (initialProject.data.loudness !== undefined) setLoudness(!!initialProject.data.loudness);
          if (initialProject.data.virtualizer !== undefined) setVirtualizer(initialProject.data.virtualizer);
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
  }, [volume, eq, compressor, reverbMix, delayTime, playbackRate, bassBoost, loudness, virtualizer]);

  // ... (Save/Load Project/Import logic same as before) ...
  const saveProject = () => {
      const projectData: Project = {
          id: initialProject?.id || Date.now().toString(),
          name: initialProject?.name || `Audio Project ${new Date().toLocaleDateString()}`,
          type: 'audio',
          createdAt: Date.now(),
          data: { volume, eq, compressor, vizMode, reverbMix, delayTime, playbackRate, bassBoost, loudness, virtualizer }
      };
      const projects = JSON.parse(localStorage.getItem('ganeshaystudio_projects') || '[]');
      const existingIndex = projects.findIndex((p: Project) => p.id === projectData.id);
      if (existingIndex >= 0) projects[existingIndex] = projectData; else projects.push(projectData);
      try {
        localStorage.setItem('ganeshaystudio_projects', JSON.stringify(projects));
        setHasUnsavedChanges(false);
        alert("Project saved successfully!");
      } catch (e) { alert("Storage quota exceeded."); }
  };

  const handleExportProject = () => {
    const projectData: Project = {
        id: Date.now().toString(),
        name: `Audio Project ${new Date().toLocaleDateString()}`,
        type: 'audio',
        createdAt: Date.now(),
        data: { volume, eq, compressor, vizMode, reverbMix, delayTime, playbackRate, bassBoost, loudness, virtualizer }
    };
    const blob = new Blob([JSON.stringify(projectData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "audio_project.json";
    link.click();
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const project = JSON.parse(event.target?.result as string);
                  if (project.type === 'audio' && project.data) {
                      if (project.data.volume !== undefined) setVolume(project.data.volume);
                      if (project.data.eq) setEq(project.data.eq);
                      if (project.data.compressor) setCompressor(project.data.compressor);
                      if (project.data.vizMode) setVizMode(project.data.vizMode);
                      if (project.data.reverbMix !== undefined) setReverbMix(project.data.reverbMix);
                      if (project.data.delayTime !== undefined) setDelayTime(project.data.delayTime);
                      if (project.data.playbackRate !== undefined) setPlaybackRate(project.data.playbackRate);
                      if (project.data.bassBoost !== undefined) setBassBoost(project.data.bassBoost);
                      if (project.data.loudness !== undefined) setLoudness(!!project.data.loudness);
                      if (project.data.virtualizer !== undefined) setVirtualizer(project.data.virtualizer);
                      pushToHistory();
                  } else { alert("Invalid project file"); }
              } catch (err) { alert("Failed to load project"); }
          };
          reader.readAsText(file);
      }
  };

  const handleAddCollaborator = () => {
      const name = prompt("Enter collaborator name (Simulated):");
      if (name) {
          setCollaborators([...collaborators, name]);
          alert(`${name} has been invited to collaborate!`);
      }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(file && audioCtxRef.current) {
       setTrackName(file.name);
       const arrayBuffer = await file.arrayBuffer();
       const audioBuf = await audioCtxRef.current.decodeAudioData(arrayBuffer);
       setAudioBuffer(audioBuf);

       const url = URL.createObjectURL(file);
       setAudioSrc(url);
       setLibrary(prev => [...prev, { id: Date.now().toString(), name: file.name, url, duration: audioBuf.duration.toFixed(2) + 's' }]);
       if (sourceNodeRef.current) { sourceNodeRef.current.disconnect(); sourceNodeRef.current = null; }
       setHasUnsavedChanges(true);
       e.target.value = '';
    }
  };

  // ... (Recording, Editing, Connect Nodes logic same as before) ...
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert("Microphone access not supported."); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mediaRecorderRef.current.onstop = async () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            if (audioCtxRef.current) {
                const audioBuf = await audioCtxRef.current.decodeAudioData(arrayBuffer);
                setAudioBuffer(audioBuf);
                const url = URL.createObjectURL(blob);
                setAudioSrc(url);
                setTrackName(`Recording ${new Date().toLocaleTimeString()}`);
                setHasUnsavedChanges(true);
            }
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
    } catch (e) { console.error("Error accessing microphone:", e); }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
  };

  // ... Editing Helper Functions (getSelectedRange, createBuffer, updateMainBuffer, handleCut, handleCopy, handlePaste, handleDelete, handleTrim, handleFadeIn, handleFadeOut, handleReverse) ...
  const getSelectedRange = () => {
      if (!selection || !audioBuffer) return null;
      const start = Math.min(selection.start, selection.end);
      const end = Math.max(selection.start, selection.end);
      return { start: Math.max(0, start), end: Math.min(audioBuffer.duration, end) };
  };
  const createBuffer = (channels: number, length: number, rate: number) => { return audioCtxRef.current!.createBuffer(channels, length, rate); }
  const updateMainBuffer = (newBuffer: AudioBuffer, timeToSeek?: number) => {
      setAudioBuffer(newBuffer);
      const blob = audioBufferToWav(newBuffer);
      const url = URL.createObjectURL(blob);
      if (timeToSeek !== undefined) setSeekOnLoad(timeToSeek); else setSeekOnLoad(cursorTime);
      setAudioSrc(url);
      setSelection(null);
  };
  const handleCut = () => {
      const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
      handleCopy();
      const startSample = Math.floor(range.start * audioBuffer.sampleRate);
      const endSample = Math.floor(range.end * audioBuffer.sampleRate);
      const newLength = audioBuffer.length - (endSample - startSample);
      if (newLength <= 0) return;
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, newLength, audioBuffer.sampleRate);
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          const oldData = audioBuffer.getChannelData(i);
          const newData = newBuffer.getChannelData(i);
          newData.set(oldData.subarray(0, startSample));
          newData.set(oldData.subarray(endSample), startSample);
      }
      updateMainBuffer(newBuffer, range.start); showFeedback("Cut Selection");
  };
  const handleCopy = () => {
      const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
      const startSample = Math.floor(range.start * audioBuffer.sampleRate);
      const endSample = Math.floor(range.end * audioBuffer.sampleRate);
      const length = endSample - startSample;
      if (length <= 0) return;
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, length, audioBuffer.sampleRate);
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          newBuffer.getChannelData(i).set(audioBuffer.getChannelData(i).subarray(startSample, endSample));
      }
      setClipboard(newBuffer); showFeedback("Copied to Clipboard");
  };
  const handlePaste = () => {
      if (!clipboard || !audioBuffer || !audioCtxRef.current) return;
      const insertTime = cursorTime;
      const insertSample = Math.floor(insertTime * audioBuffer.sampleRate);
      const newLength = audioBuffer.length + clipboard.length;
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, newLength, audioBuffer.sampleRate);
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          const oldData = audioBuffer.getChannelData(i);
          const clipData = clipboard.getChannelData(i);
          const newData = newBuffer.getChannelData(i);
          newData.set(oldData.subarray(0, insertSample));
          newData.set(clipData, insertSample);
          newData.set(oldData.subarray(insertSample), insertSample + clipboard.length);
      }
      updateMainBuffer(newBuffer, insertTime); showFeedback("Pasted");
  };
  const handleDelete = () => {
      const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
      const startSample = Math.floor(range.start * audioBuffer.sampleRate);
      const endSample = Math.floor(range.end * audioBuffer.sampleRate);
      const newLength = audioBuffer.length - (endSample - startSample);
      if (newLength <= 0) return;
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, newLength, audioBuffer.sampleRate);
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          const oldData = audioBuffer.getChannelData(i);
          const newData = newBuffer.getChannelData(i);
          newData.set(oldData.subarray(0, startSample));
          newData.set(oldData.subarray(endSample), startSample);
      }
      updateMainBuffer(newBuffer, range.start); showFeedback("Deleted Selection");
  };
  const handleTrim = () => {
    const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
    const startSample = Math.floor(range.start * audioBuffer.sampleRate);
    const endSample = Math.floor(range.end * audioBuffer.sampleRate);
    const length = endSample - startSample;
    if (length <= 0) return;
    const newBuffer = createBuffer(audioBuffer.numberOfChannels, length, audioBuffer.sampleRate);
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        newBuffer.getChannelData(i).set(audioBuffer.getChannelData(i).subarray(startSample, endSample));
    }
    updateMainBuffer(newBuffer, 0); showFeedback("Trimmed to Selection");
  };
  const handleFadeIn = () => {
      const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
      const startSample = Math.floor(range.start * audioBuffer.sampleRate);
      const endSample = Math.floor(range.end * audioBuffer.sampleRate);
      const length = endSample - startSample;
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          const input = audioBuffer.getChannelData(c);
          const output = newBuffer.getChannelData(c);
          output.set(input);
          for (let i = 0; i < length; i++) {
              const factor = i / length;
              output[startSample + i] *= factor;
          }
      }
      updateMainBuffer(newBuffer, range.start); showFeedback("Applied Fade In");
  };
  const handleFadeOut = () => {
      const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
      const startSample = Math.floor(range.start * audioBuffer.sampleRate);
      const endSample = Math.floor(range.end * audioBuffer.sampleRate);
      const length = endSample - startSample;
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          const input = audioBuffer.getChannelData(c);
          const output = newBuffer.getChannelData(c);
          output.set(input);
          for (let i = 0; i < length; i++) {
              const factor = 1.0 - (i / length);
              output[startSample + i] *= factor;
          }
      }
      updateMainBuffer(newBuffer, range.start); showFeedback("Applied Fade Out");
  };
  const handleReverse = () => {
      const range = getSelectedRange(); if (!range || !audioBuffer || !audioCtxRef.current) return;
      const startSample = Math.floor(range.start * audioBuffer.sampleRate);
      const endSample = Math.floor(range.end * audioBuffer.sampleRate);
      const newBuffer = createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          const input = audioBuffer.getChannelData(c);
          const output = newBuffer.getChannelData(c);
          output.set(input);
          const slice = input.subarray(startSample, endSample);
          for (let i = 0; i < slice.length; i++) {
              output[startSample + i] = slice[slice.length - 1 - i];
          }
      }
      updateMainBuffer(newBuffer, range.start); showFeedback("Reversed Selection");
  };
  const addMarker = () => { setMarkers([...markers, { id: Date.now(), time: cursorTime, label: `Cue ${markers.length + 1}`, color: '#eab308' }]); };

  const connectNodes = () => {
     if(!audioRef.current || !audioCtxRef.current) return;
     const ctx = audioCtxRef.current;
     if (!sourceNodeRef.current) { sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current); }
     const source = sourceNodeRef.current;
     const bassBoostNode = bassBoostNodeRef.current!;
     const loudnessNode = loudnessNodeRef.current!;
     const compNode = compressorNodeRef.current!;
     const masterGain = gainNodeRef.current!;
     const analyser = analyserRef.current!;
     const reverb = reverbNodeRef.current!;
     const reverbGain = reverbGainRef.current!;
     const delay = delayNodeRef.current!;
     const delayGain = delayGainRef.current!;
     const virtDelay = virtualizerDelayRef.current!;
     const virtGain = virtualizerGainRef.current!;

     try { source.disconnect(); } catch(e){}
     try { bassBoostNode.disconnect(); } catch(e){}
     eqNodesRef.current.forEach(node => { try { node.disconnect(); } catch(e){} });
     try { loudnessNode.disconnect(); } catch(e){}
     try { compNode.disconnect(); } catch(e){}
     try { reverb.disconnect(); } catch(e){}
     try { reverbGain.disconnect(); } catch(e){}
     try { delay.disconnect(); } catch(e){}
     try { delayGain.disconnect(); } catch(e){}
     try { virtDelay.disconnect(); } catch(e){}
     try { virtGain.disconnect(); } catch(e){}
     try { masterGain.disconnect(); } catch(e){}

     let currentNode: AudioNode = source;
     currentNode.connect(bassBoostNode);
     currentNode = bassBoostNode;
     eqNodesRef.current.forEach(eqNode => { currentNode.connect(eqNode); currentNode = eqNode; });
     currentNode.connect(loudnessNode);
     loudnessNode.connect(compNode);
     compNode.connect(masterGain);
     if (reverbMix > 0) { compNode.connect(reverb); reverb.connect(reverbGain); reverbGain.connect(masterGain); }
     if (delayTime > 0) { compNode.connect(delay); delay.connect(delayGain); delayGain.connect(masterGain); }
     if (virtualizer > 0) { compNode.connect(virtDelay); virtDelay.connect(virtGain); virtGain.connect(masterGain); }
     masterGain.connect(analyser);
     masterGain.connect(ctx.destination);
  };

  const togglePlay = async () => {
    if(!audioRef.current || !audioCtxRef.current) return;
    if(audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    connectNodes();
    if(isPlaying) { audioRef.current.pause(); setIsPlaying(false); if(rafRef.current) cancelAnimationFrame(rafRef.current); } 
    else { await audioRef.current.play(); setIsPlaying(true); }
  };

  // ... (Draw Waveform, Handle Mouse Events, Update Params, Apply Preset, Handle EQ, Trigger Drum, Sequencer Loop, Run AI, Handle TTS - same as before) ...
  const drawWaveform = useCallback(() => {
      if (!canvasRef.current || !audioBuffer) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 1; ctx.strokeStyle = '#1a1a1a'; ctx.beginPath();
      for(let i=0; i<width; i+=100) { ctx.moveTo(i, 0); ctx.lineTo(i, height); } ctx.stroke();
      if (isPlaying && vizMode === 'spectrum' && analyserRef.current) {
           const bufferLength = analyserRef.current.frequencyBinCount;
           const dataArray = new Uint8Array(bufferLength);
           analyserRef.current.getByteFrequencyData(dataArray);
           const barWidth = (width / bufferLength) * 2.5; let x = 0;
           for(let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;
                const hue = i/bufferLength * 360;
                ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
           }
           ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(0, height/2); ctx.lineTo(width, height/2); ctx.stroke();
      } else {
          const data = audioBuffer.getChannelData(0);
          const step = Math.ceil(data.length / width / zoom);
          const amp = height / 2;
          ctx.lineWidth = 2; ctx.strokeStyle = '#22c55e'; ctx.beginPath();
          const startOffsetSample = Math.floor(scrollOffset * audioBuffer.sampleRate);
          for (let i = 0; i < width; i++) {
              let min = 1.0; let max = -1.0;
              const sampleIdx = startOffsetSample + (i * step);
              if (sampleIdx >= data.length) break;
              for (let j = 0; j < step; j++) {
                  const datum = data[sampleIdx + j];
                  if (datum < min) min = datum; if (datum > max) max = datum;
              }
              ctx.moveTo(i, (1 + min) * amp); ctx.lineTo(i, (1 + max) * amp);
          } ctx.stroke();
      }
      if (selection && (!isPlaying || vizMode === 'waveform')) {
          const step = Math.ceil(audioBuffer.length / width / zoom);
          const startOffsetSample = Math.floor(scrollOffset * audioBuffer.sampleRate);
          const startX = (selection.start * audioBuffer.sampleRate - startOffsetSample) / step;
          const endX = (selection.end * audioBuffer.sampleRate - startOffsetSample) / step;
          const w = endX - startX;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(startX, 0, w, height);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.strokeRect(startX, 0, w, height);
          ctx.fillStyle = 'white'; ctx.font = '10px monospace'; ctx.fillText(`${(selection.end - selection.start).toFixed(2)}s`, startX + 5, height - 10);
      }
      const step = Math.ceil(audioBuffer.length / width / zoom);
      const startOffsetSample = Math.floor(scrollOffset * audioBuffer.sampleRate);
      markers.forEach(m => {
          const mx = (m.time * audioBuffer.sampleRate - startOffsetSample) / step;
          if (mx >= 0 && mx <= width) {
              ctx.beginPath(); ctx.strokeStyle = m.color; ctx.moveTo(mx, 0); ctx.lineTo(mx, height); ctx.stroke();
              ctx.fillStyle = m.color; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx + 5, 0); ctx.lineTo(mx + 5, 10); ctx.lineTo(mx, 15); ctx.fill();
              ctx.font = '10px sans-serif'; ctx.fillText(m.label, mx + 8, 10);
          }
      });
      const cursorX = (cursorTime * audioBuffer.sampleRate - startOffsetSample) / step;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, height); ctx.stroke();
      ctx.save(); ctx.translate(10, 10);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.roundRect(0, 0, 240, 60, 8); ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.stroke();
      ctx.fillStyle = isRecording ? '#ef4444' : isPlaying ? '#22c55e' : '#eab308';
      if (isRecording) { ctx.beginPath(); ctx.arc(15, 15, 5, 0, Math.PI*2); ctx.fill(); } 
      else if (isPlaying) { ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(20, 15); ctx.lineTo(12, 20); ctx.fill(); } 
      else { ctx.fillRect(11, 10, 3, 10); ctx.fillRect(16, 10, 3, 10); }
      ctx.fillStyle = 'white'; ctx.font = 'bold 14px monospace';
      const formatTime = (t: number) => new Date(t * 1000).toISOString().substr(14, 5) + '.' + Math.floor((t % 1) * 100).toString().padStart(2, '0');
      ctx.fillText(`${formatTime(cursorTime)} / ${formatTime(audioBuffer.duration)}`, 35, 19);
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#a3a3a3'; ctx.fillText(`ZOOM: ${(zoom * 100).toFixed(0)}%  |  SR: ${audioBuffer.sampleRate}Hz`, 10, 40);
      ctx.fillStyle = '#22c55e'; ctx.fillText(trackName.length > 25 ? trackName.substring(0,25)+'...' : trackName, 120, 40);
      ctx.restore();
      if (feedbackText) {
          ctx.save(); ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.roundRect(width/2 - 150, height/2 - 30, 300, 60, 10); ctx.fill();
          ctx.fillStyle = '#22c55e'; ctx.fillText(feedbackText, width/2, height/2); ctx.restore();
      }
      if ((isPlaying || isRecording) && audioRef.current) {
          if (!isRecording) setCursorTime(audioRef.current.currentTime);
          rafRef.current = requestAnimationFrame(drawWaveform);
      }
  }, [audioBuffer, zoom, scrollOffset, selection, cursorTime, isPlaying, isRecording, vizMode, markers, trackName, feedbackText]);

  useEffect(() => { drawWaveform(); if (!isPlaying && !isRecording && rafRef.current) cancelAnimationFrame(rafRef.current); return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current) } }, [drawWaveform]);
  
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (!audioBuffer || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = canvasRef.current.width;
      const step = Math.ceil(audioBuffer.length / width / zoom);
      const startOffsetSample = Math.floor(scrollOffset * audioBuffer.sampleRate);
      const clickSample = startOffsetSample + (x * step);
      const clickTime = clickSample / audioBuffer.sampleRate;
      if (e.shiftKey && selection) { setSelection({ ...selection, end: clickTime }); } 
      else { setSelection({ start: clickTime, end: clickTime }); setCursorTime(clickTime); if (audioRef.current) audioRef.current.currentTime = clickTime; }
  };
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (e.buttons !== 1 || !selection || !audioBuffer || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = canvasRef.current.width;
      const step = Math.ceil(audioBuffer.length / width / zoom);
      const startOffsetSample = Math.floor(scrollOffset * audioBuffer.sampleRate);
      const clickSample = startOffsetSample + (x * step);
      const clickTime = clickSample / audioBuffer.sampleRate;
      setSelection({ ...selection, end: clickTime }); setCursorTime(clickTime);
  };

  useEffect(() => {
     if(gainNodeRef.current) gainNodeRef.current.gain.value = volume;
     if(eq.gains && eq.gains.length === 10) { eqNodesRef.current.forEach((node, i) => { node.gain.setTargetAtTime(eq.gains[i], audioCtxRef.current!.currentTime, 0.1); }); }
     if(bassBoostNodeRef.current) { bassBoostNodeRef.current.gain.setTargetAtTime(bassBoost, audioCtxRef.current!.currentTime, 0.1); }
     if(loudnessNodeRef.current) { loudnessNodeRef.current.gain.setTargetAtTime(loudness ? 1.5 : 1.0, audioCtxRef.current!.currentTime, 0.1); }
     if(virtualizerDelayRef.current && virtualizerGainRef.current) { virtualizerDelayRef.current.delayTime.value = 0.02; virtualizerGainRef.current.gain.value = virtualizer / 200; }
     if(compressorNodeRef.current) { compressorNodeRef.current.threshold.value = loudness ? -30 : compressor.threshold; compressorNodeRef.current.ratio.value = loudness ? 12 : compressor.ratio; compressorNodeRef.current.attack.value = compressor.attack; compressorNodeRef.current.release.value = compressor.release; }
     if(reverbGainRef.current) reverbGainRef.current.gain.value = reverbMix;
     if(delayNodeRef.current) delayNodeRef.current.delayTime.value = delayTime;
     if(delayGainRef.current) delayGainRef.current.gain.value = 0.5; 
     if(audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [volume, eq, compressor, reverbMix, delayTime, playbackRate, bassBoost, loudness, virtualizer]);

  const applyPreset = (name: string) => { if (EQ_PRESETS[name]) { pushToHistory(); setEq({ gains: [...EQ_PRESETS[name]] }); } };
  const handleEqChange = (index: number, value: number) => { const newGains = [...eq.gains]; newGains[index] = value; setEq({ ...eq, gains: newGains }); };
  const triggerDrum = useCallback((type: string) => {
    setActiveDrum(type); setTimeout(() => setActiveDrum(null), 200);
    const ctx = audioCtxRef.current; if (!ctx) return;
    const t = ctx.currentTime; const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(gainNodeRef.current!);
    if (type === 'kick') { osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5); gain.gain.setValueAtTime(1, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5); osc.start(t); osc.stop(t + 0.5); } 
    else if (type === 'snare') { osc.type = 'triangle'; osc.frequency.setValueAtTime(200, t); gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2); osc.start(t); osc.stop(t + 0.2); const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const output = noiseBuffer.getChannelData(0); for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1; const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer; const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.5, t); noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2); noise.connect(noiseGain); noiseGain.connect(gainNodeRef.current!); noise.start(t); } 
    else if (type === 'hihat') { const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate); const output = noiseBuffer.getChannelData(0); for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1; const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer; const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 5000; noise.connect(filter); filter.connect(gain); gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05); noise.start(t); } 
    else if (type === 'clap') { const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const output = noiseBuffer.getChannelData(0); for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1; const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer; const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1000; noise.connect(filter); filter.connect(gain); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.5, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15); noise.start(t); }
  }, []);
  const toggleSequencerStep = (row: number, col: number) => { const newGrid = [...sequencerGrid]; newGrid[row][col] = !newGrid[row][col]; setSequencerGrid(newGrid); };
  const gridRef = useRef(sequencerGrid); useEffect(() => { gridRef.current = sequencerGrid; }, [sequencerGrid]);
  useEffect(() => {
      if (isSequencerPlaying) {
          const intervalTime = (60 / bpm) / 4 * 1000;
          sequencerRef.current = window.setInterval(() => {
              setCurrentStep(prev => {
                  const next = (prev + 1) % 16;
                  gridRef.current.forEach((row, rowIndex) => { if (row[next]) { triggerDrum(DRUM_ROWS[rowIndex]); } });
                  return next;
              });
          }, intervalTime);
      } else { if (sequencerRef.current) window.clearInterval(sequencerRef.current); }
      return () => { if (sequencerRef.current) window.clearInterval(sequencerRef.current); }
  }, [isSequencerPlaying, bpm, triggerDrum]);
  const runAI = async () => { if (!aiPrompt) return; setAiLoading(true); try { const settings = await generateAudioSettings(aiPrompt); if (settings) { pushToHistory(); if (settings.threshold) setCompressor(p => ({...p, threshold: settings.threshold})); if (settings.ratio) setCompressor(p => ({...p, ratio: settings.ratio})); if (settings.reverb_wet) setReverbMix(settings.reverb_wet); } } catch (e) { console.error(e); } setAiLoading(false); };
  const handleGenerateSpeech = async () => { if (!ttsText) return; setTtsLoading(true); setGeneratedTtsUrl(null); try { const base64Audio = await generateSpeech(ttsText, ttsVoice); if (base64Audio) { const bytes = base64ToUint8Array(base64Audio); const int16Array = new Int16Array(bytes.buffer); const float32Array = new Float32Array(int16Array.length); for(let i=0; i<int16Array.length; i++) { float32Array[i] = int16Array[i] / 32768.0; } const wavBlob = createWavBlob(float32Array, 24000, 1); const url = URL.createObjectURL(wavBlob); setGeneratedTtsUrl(url); } } catch(e) { console.error(e); } setTtsLoading(false); };

  // --- True Offline Export Logic ---
  const handleExport = async () => {
      if (!audioBuffer) {
          alert("Please import an audio file into the main editor (Mixer -> Upload or Library) to enable export.");
          return;
      }
      setIsExporting(true);
      setShowExportModal(false);

      try {
          // 1. Create Offline Context
          const offlineCtx = new OfflineAudioContext(
              audioBuffer.numberOfChannels,
              audioBuffer.length,
              audioBuffer.sampleRate
          );

          // 2. Recreate Graph in Offline Context
          const source = offlineCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = playbackRate;

          const bassBoostNode = offlineCtx.createBiquadFilter();
          bassBoostNode.type = 'lowshelf';
          bassBoostNode.frequency.value = 100;
          bassBoostNode.gain.value = bassBoost;

          // EQ Chain
          let lastNode: AudioNode = bassBoostNode;
          const eqChain = EQ_FREQUENCIES.map((freq, i) => {
              const node = offlineCtx.createBiquadFilter();
              node.type = 'peaking';
              node.frequency.value = freq;
              node.Q.value = 1.4;
              node.gain.value = eq.gains[i] || 0;
              lastNode.connect(node);
              lastNode = node;
              return node;
          });

          const loudnessNode = offlineCtx.createGain();
          loudnessNode.gain.value = loudness ? 1.5 : 1.0;

          const compressorNode = offlineCtx.createDynamicsCompressor();
          compressorNode.threshold.value = loudness ? -30 : compressor.threshold;
          compressorNode.ratio.value = loudness ? 12 : compressor.ratio;
          compressorNode.attack.value = compressor.attack;
          compressorNode.release.value = compressor.release;

          const masterGain = offlineCtx.createGain();
          masterGain.gain.value = volume;

          // Wire Main Chain
          source.connect(bassBoostNode);
          // eqChain is connected in map
          lastNode.connect(loudnessNode);
          loudnessNode.connect(compressorNode);
          
          // Dry Path
          compressorNode.connect(masterGain);

          // FX: Reverb
          if (reverbMix > 0) {
              const reverb = offlineCtx.createConvolver();
              reverb.buffer = createImpulseResponse(reverbSize, 2.0, offlineCtx);
              const reverbGain = offlineCtx.createGain();
              reverbGain.gain.value = reverbMix;
              compressorNode.connect(reverb);
              reverb.connect(reverbGain);
              reverbGain.connect(masterGain);
          }

          // FX: Delay
          if (delayTime > 0) {
              const delay = offlineCtx.createDelay(5.0);
              delay.delayTime.value = delayTime;
              const delayGain = offlineCtx.createGain();
              delayGain.gain.value = 0.5;
              compressorNode.connect(delay);
              delay.connect(delayGain);
              delayGain.connect(masterGain);
          }

          // FX: Virtualizer
          if (virtualizer > 0) {
              const vDelay = offlineCtx.createDelay(1.0);
              vDelay.delayTime.value = 0.02;
              const vGain = offlineCtx.createGain();
              vGain.gain.value = virtualizer / 200;
              compressorNode.connect(vDelay);
              vDelay.connect(vGain);
              vGain.connect(masterGain);
          }

          masterGain.connect(offlineCtx.destination);

          // 3. Start & Render
          source.start(0);
          const renderedBuffer = await offlineCtx.startRendering();

          // 4. Convert to WAV & Download
          const wavBlob = audioBufferToWav(renderedBuffer);
          const url = URL.createObjectURL(wavBlob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `GaneshayStudio_Export_${Date.now()}.wav`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          alert("Export Successful!");

      } catch (e) {
          console.error("Export Failed:", e);
          alert("Export Failed. See console for details.");
      }
      setIsExporting(false);
  };

  return (
    <div className="flex h-full bg-neutral-950">
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
                <button onClick={saveProject} className={`text-xs px-3 py-1 rounded flex items-center font-bold transition-all ${hasUnsavedChanges ? 'bg-green-600 text-white hover:bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>
                    {hasUnsavedChanges ? 'Save *' : 'Saved'}
                </button>
                <button onClick={handleAddCollaborator} className="flex items-center text-[10px] bg-neutral-800 px-2 py-1 rounded text-green-400 hover:bg-neutral-700">
                     <Users className="w-3 h-3 mr-1"/> {collaborators.length} Online
                </button>
            </div>
         </div>
         <TabButton active={activeTab === 'mixer'} onClick={() => setActiveTab('mixer')} icon={Volume2} label="Mixer" colorClass="border-green-500" />
         <TabButton active={activeTab === 'sequencer'} onClick={() => setActiveTab('sequencer')} icon={Grid3X3} label="Sequencer" colorClass="border-green-500" />
         <TabButton active={activeTab === 'eq'} onClick={() => setActiveTab('eq')} icon={Settings2} label="10-Band EQ" colorClass="border-green-500" /> 
         <TabButton active={activeTab === 'fx'} onClick={() => setActiveTab('fx')} icon={Zap} label="FX Rack" colorClass="border-green-500" /> 
         <TabButton active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={ListMusic} label="Library" colorClass="border-green-500" />
         <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={Sparkles} label="Sonic AI" colorClass="border-green-500" />

         <div className="mt-4 p-4 border-t border-neutral-800 flex-1 overflow-y-auto">
             {activeTab === 'mixer' && (
                 <div className="space-y-6">
                    <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 shadow-inner relative overflow-hidden group">
                        <h3 className="text-xs font-bold text-green-400 mb-4 uppercase tracking-widest flex items-center">
                            <Disc className="w-4 h-4 mr-2 animate-[spin_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity"/> 
                            Master Deck
                        </h3>
                        <p className="text-[10px] text-neutral-400 mb-4 truncate bg-neutral-950 p-2 rounded border border-neutral-800 font-mono text-center">
                            {trackName}
                        </p>
                        <div className="flex items-center h-48 justify-center space-x-6">
                             <div className="h-full w-4 bg-neutral-800 rounded-full relative overflow-hidden">
                                 <div className="absolute bottom-0 w-full bg-green-500 transition-all duration-75" style={{height: `${volume * 100}%`}}></div>
                             </div>
                             <input 
                                type="range" min="0" max="1" step="0.01" 
                                value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} 
                                className="-rotate-90 w-32 bg-neutral-700 appearance-none h-2 rounded-lg" 
                             />
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-xs font-bold text-green-400 mb-3 flex items-center"><Zap className="w-3 h-3 mr-2"/> Enhancements</h3>
                        <div className="space-y-4 bg-neutral-900/50 p-3 rounded border border-neutral-800">
                             
                             <div className="space-y-2">
                                 <div className="flex justify-between items-center">
                                     <span className="text-[10px] font-bold text-neutral-300 flex items-center"><Speaker className="w-3 h-3 mr-1"/> Bass Boost</span>
                                     <span className="text-[10px] text-neutral-400">{bassBoost}dB</span>
                                 </div>
                                 <input type="range" min="0" max="20" step="1" value={bassBoost} 
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setBassBoost(v);
                                        showFeedback(`Bass Boost: ${v}dB`);
                                    }} 
                                    className="w-full h-1 bg-neutral-700 rounded appearance-none accent-green-500" 
                                 />
                             </div>

                             <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-bold text-neutral-300 flex items-center"><Maximize2 className="w-3 h-3 mr-1"/> Loudness</span>
                                 <button 
                                    onClick={() => {
                                        setLoudness(!loudness);
                                        showFeedback(loudness ? "Loudness: OFF" : "Loudness: ON");
                                    }} 
                                    className={`w-12 h-6 rounded-full relative transition-colors ${loudness ? 'bg-green-600' : 'bg-neutral-700'}`}
                                 >
                                     <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${loudness ? 'translate-x-6' : ''}`}></div>
                                 </button>
                             </div>

                             <div className="space-y-2">
                                 <div className="flex justify-between items-center">
                                     <span className="text-[10px] font-bold text-neutral-300 flex items-center"><Move className="w-3 h-3 mr-1"/> Virtualizer</span>
                                     <span className="text-[10px] text-neutral-400">{virtualizer}%</span>
                                 </div>
                                 <input type="range" min="0" max="100" step="1" value={virtualizer} 
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setVirtualizer(v);
                                        showFeedback(`Virtualizer: ${v}%`);
                                    }} 
                                    className="w-full h-1 bg-neutral-700 rounded appearance-none accent-green-500" 
                                 />
                             </div>
                             
                             <button 
                                onClick={() => setActiveTab('eq')} 
                                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-green-500 rounded text-xs font-bold text-neutral-300 hover:text-white transition-colors flex items-center justify-center"
                             >
                                 <Settings2 className="w-3 h-3 mr-2" /> Open Graphic Equalizer
                             </button>

                        </div>
                    </div>

                    <div className="pt-2">
                        <label className="text-xs font-bold text-neutral-500 mb-2 block">Visualization Mode</label>
                        <div className="flex space-x-1 bg-neutral-900 p-1 rounded">
                            <button onClick={() => setVizMode('spectrum')} className={`flex-1 py-1 text-[10px] rounded ${vizMode==='spectrum' ? 'bg-green-900/50 text-green-400':'text-neutral-500'}`}>Spectrum</button>
                            <button onClick={() => setVizMode('waveform')} className={`flex-1 py-1 text-[10px] rounded ${vizMode==='waveform' ? 'bg-green-900/50 text-green-400':'text-neutral-500'}`}>Waveform</button>
                        </div>
                    </div>
                 </div>
             )}
             {activeTab === 'sequencer' && (
                 <div className="space-y-6">
                    <div className="flex justify-between items-center mb-2">
                         <h3 className="text-xs font-bold text-green-400 flex items-center"><Grid3X3 className="w-3 h-3 mr-2"/> Step Sequencer</h3>
                         <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-neutral-400">BPM</span>
                            <input 
                                type="number" 
                                value={bpm} 
                                onChange={(e) => setBpm(parseInt(e.target.value))} 
                                className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1 text-[10px] text-white"
                            />
                            <button 
                                onClick={() => setIsSequencerPlaying(!isSequencerPlaying)} 
                                className={`p-1 rounded ${isSequencerPlaying ? 'text-green-400' : 'text-neutral-400'}`}
                            >
                                {isSequencerPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                         </div>
                    </div>
                    
                    <div className="bg-neutral-900 p-3 rounded border border-neutral-800">
                         {DRUM_ROWS.map((drum, rowIndex) => (
                             <div key={drum} className="flex items-center mb-2 last:mb-0">
                                 <span className="w-12 text-[9px] font-bold text-neutral-400 uppercase text-right mr-2">{drum}</span>
                                 <div className="flex-1 grid grid-cols-16 gap-0.5">
                                     {Array.from({length: 16}).map((_, colIndex) => (
                                         <button 
                                            key={colIndex}
                                            onClick={() => toggleSequencerStep(rowIndex, colIndex)}
                                            className={`h-6 rounded-sm border transition-colors relative ${sequencerGrid[rowIndex][colIndex] ? 'bg-green-600 border-green-500' : 'bg-neutral-800 border-neutral-700 hover:border-neutral-500'} ${colIndex % 4 === 0 ? 'border-l-neutral-500' : ''}`}
                                         >
                                            {/* Playhead Highlight */}
                                            {isSequencerPlaying && currentStep === colIndex && (
                                                <div className="absolute inset-0 bg-white/30 pointer-events-none"></div>
                                            )}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         ))}
                    </div>
                    <div className="flex justify-between text-[8px] text-neutral-500 px-14">
                        <span>1</span><span>2</span><span>3</span><span>4</span>
                    </div>
                 </div>
             )}
             {activeTab === 'eq' && (
                 <div className="space-y-5">
                    <div className="flex items-center justify-between">
                         <h3 className="text-xs font-bold text-neutral-400">Graphic EQ</h3>
                         <select 
                            onChange={(e) => applyPreset(e.target.value)}
                            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-green-500"
                         >
                             <option value="">Presets...</option>
                             {Object.keys(EQ_PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                    </div>
                    
                    <div className="flex justify-between items-end h-40 p-2 bg-neutral-900/50 rounded border border-neutral-800">
                        {eq.gains.map((gain, i) => (
                            <div key={i} className="flex flex-col items-center w-6 group">
                                <input 
                                    type="range" 
                                    min="-12" 
                                    max="12" 
                                    step="1"
                                    value={gain} 
                                    onChange={(e) => handleEqChange(i, parseFloat(e.target.value))}
                                    onMouseUp={pushToHistory}
                                    className="-rotate-90 w-24 h-1 bg-neutral-700 appearance-none rounded cursor-pointer accent-green-500 mb-10"
                                />
                                <span className="text-[8px] text-neutral-500 mt-2 font-mono">
                                    {EQ_FREQUENCIES[i] >= 1000 ? (EQ_FREQUENCIES[i]/1000)+'k' : EQ_FREQUENCIES[i]}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-neutral-800">
                        <h3 className="text-xs font-bold text-neutral-400 mb-2">Dynamics</h3>
                        <Slider label="Threshold" value={compressor.threshold} max={0} min={-60} onChange={v=>setCompressor(p=>({...p, threshold:v}))} />
                        <Slider label="Ratio" value={compressor.ratio} max={10} min={1} step={0.1} onChange={v=>setCompressor(p=>({...p, ratio:v}))} />
                    </div>
                 </div>
             )}
             {activeTab === 'fx' && (
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-2">
                        {['kick', 'snare', 'hihat', 'clap'].map(drum => (
                            <button 
                                key={drum}
                                onClick={() => triggerDrum(drum)} 
                                className={`h-20 rounded-lg flex flex-col items-center justify-center transition-all duration-75 border ${activeDrum === drum ? 'bg-green-600 border-green-400 scale-95' : 'bg-neutral-800 border-neutral-700 hover:border-green-500'}`}
                            >
                                {drum === 'kick' && <Drum className="w-6 h-6 mb-1"/>}
                                {drum === 'snare' && <Square className="w-6 h-6 mb-1"/>}
                                {drum === 'hihat' && <Disc className="w-6 h-6 mb-1"/>}
                                {drum === 'clap' && <Music4 className="w-6 h-6 mb-1"/>}
                                <span className="text-[10px] font-bold uppercase">{drum}</span>
                            </button>
                        ))}
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-green-400 mb-3 flex items-center"><Gauge className="w-3 h-3 mr-2"/> Tuning / Speed</h3>
                        <div className="bg-neutral-900 p-3 rounded border border-neutral-800">
                             <input 
                                type="range" 
                                min="0.5" 
                                max="2.0" 
                                step="0.01" 
                                value={playbackRate} 
                                onChange={e => {
                                    const v = parseFloat(e.target.value);
                                    setPlaybackRate(v);
                                    showFeedback(`Speed: ${v.toFixed(2)}x`);
                                }} 
                                className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
                             />
                             <div className="flex justify-between text-[9px] text-neutral-400 mt-2">
                                 <span>Slow</span>
                                 <span className="font-mono">{playbackRate.toFixed(2)}x</span>
                                 <span>Fast</span>
                             </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-green-400 mb-3 flex items-center"><Waves className="w-3 h-3 mr-2"/> Reverb</h3>
                        <Slider 
                            label="Mix" 
                            value={reverbMix} 
                            max={1} 
                            step={0.05} 
                            onChange={v => {
                                setReverbMix(v);
                                showFeedback(`Reverb: ${(v*100).toFixed(0)}%`);
                            }} 
                        />
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-green-400 mb-3 flex items-center"><Zap className="w-3 h-3 mr-2"/> Delay</h3>
                        <Slider 
                            label="Time (s)" 
                            value={delayTime} 
                            max={2} 
                            step={0.05} 
                            onChange={v => {
                                setDelayTime(v);
                                showFeedback(`Delay Time: ${v.toFixed(2)}s`);
                            }} 
                        />
                        <Slider 
                            label="Feedback" 
                            value={delayFeedback} 
                            max={0.9} 
                            step={0.05} 
                            onChange={v => {
                                setDelayFeedback(v);
                                showFeedback(`Feedback: ${(v*100).toFixed(0)}%`);
                            }} 
                        />
                    </div>
                 </div>
             )}
             {activeTab === 'library' && (
                 <div className="space-y-4">
                     <label className="cursor-pointer bg-green-600 hover:bg-green-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center transition-colors">
                         <Music className="w-4 h-4 mr-2"/> Add Track to Library
                         <input type="file" accept="audio/*" onChange={handleUpload} className="hidden"/>
                     </label>

                     <div className="space-y-2">
                         {library.map(track => (
                             <div 
                                key={track.id} 
                                className={`p-2 rounded border flex items-center justify-between group ${audioSrc === track.url ? 'bg-green-900/20 border-green-500/50' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'}`}
                             >
                                 <div className="flex items-center overflow-hidden">
                                     <Music className={`w-3 h-3 mr-2 ${audioSrc === track.url ? 'text-green-400' : 'text-neutral-500'}`} />
                                     <span className={`text-xs truncate ${audioSrc === track.url ? 'text-green-400 font-bold' : 'text-neutral-300'}`}>{track.name}</span>
                                 </div>
                                 <button onClick={() => { setAudioSrc(track.url); setTrackName(track.name); }} className="p-1 text-neutral-400 hover:text-white">
                                     <ArrowRight className="w-3 h-3"/>
                                 </button>
                             </div>
                         ))}
                         {library.length === 0 && <p className="text-[10px] text-neutral-500 text-center py-4">Library empty. Add tracks to start DJing.</p>}
                     </div>
                 </div>
             )}
             {activeTab === 'ai' && (
                 <div className="space-y-3">
                    <h3 className="text-xs font-bold text-green-400">Sonic Assistant</h3>
                    <textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs h-24 focus:border-green-500 outline-none" placeholder="e.g. 'Clean up the low end' or 'Make it punchy'..." />
                    <button onClick={runAI} disabled={aiLoading} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-bold transition-colors">
                        {aiLoading ? 'Analyzing...' : 'Auto-EQ'}
                    </button>
                    
                    <div className="mt-6 pt-6 border-t border-neutral-800">
                        <h3 className="text-xs font-bold text-green-400 mb-3">Text-to-Speech</h3>
                        <textarea 
                            value={ttsText} 
                            onChange={e => setTtsText(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs h-20 focus:border-green-500 outline-none mb-3" 
                            placeholder="Enter text to generate speech..." 
                        />
                        <button 
                            onClick={handleGenerateSpeech} 
                            disabled={ttsLoading || !ttsText} 
                            className="w-full py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 rounded text-xs font-bold transition-colors flex items-center justify-center"
                        >
                            {ttsLoading ? <Sparkles className="w-3 h-3 animate-spin mr-2"/> : <Music className="w-3 h-3 mr-2"/>}
                            Generate Speech
                        </button>
                        {generatedTtsUrl && (
                            <div className="mt-2 p-2 bg-neutral-900 rounded border border-green-900 flex justify-between items-center">
                                <span className="text-[10px] text-green-400">Audio Generated</span>
                                <button onClick={() => { setAudioSrc(generatedTtsUrl); setTrackName("AI Speech"); setAudioBuffer(null); /* Basic load for playback, edit needs re-decode if desired */ }} className="text-[10px] bg-green-700 px-2 py-1 rounded text-white">Load</button>
                            </div>
                        )}
                    </div>
                 </div>
             )}
         </div>
         <div className="mt-auto p-4 border-t border-neutral-800 space-y-2">
             <button onClick={() => setShowExportModal(true)} disabled={!audioSrc} className="w-full py-3 bg-neutral-100 hover:bg-white text-black rounded font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-50">
               <Settings className="w-4 h-4 mr-2" /> Export Track
            </button>
         </div>
      </Sidebar>

      <div className="flex-1 flex flex-col bg-[#121212]">
         {/* Top Bar / Toolbar */}
         <div className="h-14 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between px-6">
             <div className="flex items-center space-x-2">
                 <div className="p-2 bg-green-900/30 rounded text-green-400 font-bold text-xs flex items-center">
                     <Music className="w-4 h-4 mr-2" />
                     {trackName}
                 </div>
                 {isRecording && (
                     <div className="flex items-center px-3 py-1 rounded bg-red-900/50 border border-red-500 animate-pulse">
                         <Circle className="w-3 h-3 text-red-500 fill-current mr-2"/>
                         <span className="text-xs text-red-400 font-bold">RECORDING</span>
                     </div>
                 )}
             </div>
             <div className="flex items-center space-x-1">
                <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded hover:text-white transition-colors ${isRecording ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'}`} title="Microphone Record">
                    {isRecording ? <Square className="w-4 h-4 fill-current"/> : <Mic className="w-4 h-4"/>}
                </button>
                <div className="w-px h-4 bg-neutral-700 mx-2"></div>
                <button onClick={handleCut} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Cut"><Scissors className="w-4 h-4"/></button>
                <button onClick={handleCopy} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Copy"><Copy className="w-4 h-4"/></button>
                <button onClick={handlePaste} disabled={!clipboard} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Paste"><Clipboard className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-neutral-700 mx-2"></div>
                <button onClick={handleTrim} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Crop/Trim to Selection"><Crop className="w-4 h-4"/></button>
                <button onClick={handleDelete} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-red-400 disabled:opacity-30" title="Delete Selection"><Trash className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-neutral-700 mx-2"></div>
                <button onClick={handleFadeIn} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Fade In"><TrendingUp className="w-4 h-4"/></button>
                <button onClick={handleFadeOut} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Fade Out"><TrendingDown className="w-4 h-4"/></button>
                <button onClick={handleReverse} disabled={!selection} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Reverse"><Repeat className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-neutral-700 mx-2"></div>
                <button onClick={addMarker} disabled={!audioBuffer} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-yellow-400 disabled:opacity-30" title="Add Marker"><Flag className="w-4 h-4"/></button>
             </div>
             <div className="flex items-center space-x-2">
                 <button onClick={() => setZoom(Math.max(0.1, zoom - 0.2))} className="p-2 hover:bg-neutral-800 rounded text-neutral-400"><ZoomOut className="w-4 h-4"/></button>
                 <span className="text-xs font-mono w-12 text-center text-neutral-500">{(zoom * 100).toFixed(0)}%</span>
                 <button onClick={() => setZoom(Math.min(5, zoom + 0.2))} className="p-2 hover:bg-neutral-800 rounded text-neutral-400"><ZoomIn className="w-4 h-4"/></button>
             </div>
         </div>

         {/* Main Editor Area */}
         <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
             {!audioSrc && !isRecording ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-neutral-800 rounded-2xl bg-neutral-900/50">
                     <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
                        <Disc className="w-8 h-8 text-neutral-600" />
                     </div>
                     <span className="text-neutral-400 font-bold mb-2">No Audio Loaded</span>
                     <div className="flex space-x-4">
                        <label className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-bold cursor-pointer">
                            Import File
                            <input type="file" accept="audio/*" onChange={handleUpload} className="hidden"/>
                        </label>
                        <button onClick={startRecording} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold flex items-center">
                             <Mic className="w-3 h-3 mr-2"/> Record Mic
                        </button>
                     </div>
                </div>
             ) : (
                 <div className="w-full h-full relative flex flex-col">
                     {/* Waveform Container */}
                     <div ref={waveformWrapperRef} className="flex-1 relative overflow-hidden bg-black cursor-text">
                         <canvas 
                            ref={canvasRef} 
                            width={1200} 
                            height={400} 
                            className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-full"
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                         />
                     </div>
                     
                     {/* Playback Controls */}
                     <div className="h-24 border-t border-neutral-800 bg-neutral-900 flex items-center justify-center space-x-6">
                        <button onClick={() => { if(audioRef.current) { audioRef.current.currentTime = 0; setCursorTime(0); } }} className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400">
                            <StopCircle className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={togglePlay} 
                            className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center shadow-lg shadow-green-900/20 transition-all hover:scale-105"
                        >
                            {isPlaying ? <Pause className="w-6 h-6 fill-current text-white" /> : <Play className="w-6 h-6 fill-current text-white ml-1" />}
                        </button>
                        <div className="text-neutral-400 font-mono text-sm">
                            {new Date(cursorTime * 1000).toISOString().substr(14, 5)}
                        </div>
                     </div>
                 </div>
             )}
             <audio 
                ref={audioRef} 
                src={audioSrc || undefined} 
                className="hidden" 
                onEnded={()=>setIsPlaying(false)} 
                crossOrigin="anonymous" 
                onLoadedMetadata={(e) => {
                    if (seekOnLoad !== null) {
                        e.currentTarget.currentTime = seekOnLoad;
                        setCursorTime(seekOnLoad);
                        setSeekOnLoad(null);
                    }
                }}
             />
         </div>
      </div>

       {showExportModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center"><Settings className="w-4 h-4 mr-2 text-green-500"/> Export Audio</h3>
                        <button onClick={() => setShowExportModal(false)} className="text-neutral-500 hover:text-white"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-400 uppercase">Format</label>
                            <div className="flex space-x-2">
                                <button className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded">WAV (Lossless)</button>
                                <button className="flex-1 bg-neutral-800 text-neutral-400 text-xs font-bold py-2 rounded hover:bg-neutral-700">MP3 / WebM</button>
                            </div>
                            <p className="text-[10px] text-neutral-500 pt-1">Export includes all edits, EQ, Compression, FX and Drum Overlays.</p>
                        </div>
                    </div>
                    <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex justify-end space-x-3">
                        <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleExport} disabled={isExporting} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded flex items-center transition-colors shadow-lg shadow-green-900/20">
                            <Download className="w-3 h-3 mr-2"/> {isExporting ? "Rendering..." : "Start Export"}
                        </button>
                    </div>
                </div>
            </div>
         )}
    </div>
  );
};

export default AudioStudio;
