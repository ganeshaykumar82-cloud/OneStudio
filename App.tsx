import React, { useState, useEffect } from 'react';
import { LayoutGrid, Film, Image as ImageIcon, Activity, ArrowLeft, HelpCircle, Keyboard, Trash2, FolderOpen, Plus, Play, Scissors, Wand2, Mic, Monitor, Layers, Smartphone, Zap, Video, Music, Grid, Sun, Moon, Facebook, Instagram, Twitter, Youtube, Send, Mail, Phone, PlayCircle, X, Check, FileText } from 'lucide-react';
import VideoStudio from './components/VideoStudio';
import ImageStudio from './components/ImageStudio';
import AudioStudio from './components/AudioStudio';
import PdfStudio from './components/PdfStudio';
import { Modal, ShortcutsList, HelpSection, TourOverlay } from './components/Shared';
import { Project } from './types';

type StudioType = 'home' | 'video' | 'image' | 'audio' | 'pdf';

const App = () => {
  const [activeStudio, setActiveStudio] = useState<StudioType>('home'); 
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
      const hasSeenTour = localStorage.getItem('ganeshaystudio_has_seen_tour_v4');
      if (!hasSeenTour) {
          setShowTour(true);
          localStorage.setItem('ganeshaystudio_has_seen_tour_v4', 'true');
      }
  }, []);

  const goHome = () => {
      setActiveStudio('home');
      setCurrentProject(null);
  };

  const startProject = (type: StudioType, project?: Project) => {
      setActiveStudio(type);
      setCurrentProject(project || null);
  };

  // Shortcuts Data
  const getShortcuts = () => {
      const common = [
          { key: '?', action: 'Toggle Help' },
      ];
      if (activeStudio === 'video') return [...common, { key: 'Space', action: 'Play / Pause' }, { key: '← / →', action: 'Seek Timeline' }, { key: 'Ctrl+S', action: 'Save Project' }];
      if (activeStudio === 'image') return [...common, { key: 'Ctrl+Z', action: 'Undo' }, { key: 'Ctrl+Y', action: 'Redo' }, { key: 'B', action: 'Brush Tool' }, { key: 'E', action: 'Eraser Tool' }, { key: 'Ctrl+S', action: 'Save Project' }];
      if (activeStudio === 'audio') return [...common, { key: 'Space', action: 'Play / Pause' }, { key: 'R', action: 'Start/Stop Recording' }, { key: 'Ctrl+S', action: 'Save Project' }];
      return common;
  };

  const tourSteps = [
      { title: 'Welcome to GaneshayStudio', desc: 'Your all-in-one AI-powered creative suite.' },
      { title: 'Project Dashboard', desc: 'Manage all your video, image, audio, and PDF projects here.' },
      { title: 'AI Tools', desc: 'Every studio features powerful Gemini AI tools for generation and editing.' },
  ];

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-sans selection:bg-indigo-500/30 transition-colors duration-300">
      
      {/* Onboarding Tour */}
      {showTour && <TourOverlay steps={tourSteps} onClose={() => setShowTour(false)} />}

      {/* Global Header */}
      {activeStudio !== 'home' && (
        <header className="h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between px-6 shrink-0 z-50 transition-colors">
          <button onClick={goHome} className="flex items-center text-gray-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-white transition-colors group">
             <div className="p-1.5 rounded-full group-hover:bg-gray-100 dark:group-hover:bg-neutral-800 mr-2 transition-colors">
                 <ArrowLeft className="w-4 h-4" />
             </div>
             <span className="text-xs font-bold tracking-widest">DASHBOARD</span>
          </button>
          <div className="flex items-center space-x-2">
              {activeStudio === 'video' && <Film className="w-4 h-4 text-purple-500"/>}
              {activeStudio === 'image' && <ImageIcon className="w-4 h-4 text-blue-500"/>}
              {activeStudio === 'audio' && <Activity className="w-4 h-4 text-green-500"/>}
              {activeStudio === 'pdf' && <FileText className="w-4 h-4 text-red-500"/>}
              <span className="font-bold text-sm tracking-wider">
                  {activeStudio === 'video' && 'VIDEO STUDIO PRO'}
                  {activeStudio === 'image' && 'IMAGE MASTER'}
                  {activeStudio === 'audio' && 'SONIC LAB'}
                  {activeStudio === 'pdf' && 'PDF STUDIO'}
              </span>
          </div>
          <div className="flex items-center space-x-4">
              <button onClick={() => setIsShortcutsOpen(true)} className="text-gray-500 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-white transition-colors" title="Keyboard Shortcuts">
                  <Keyboard className="w-5 h-5" />
              </button>
              <button onClick={() => setIsHelpOpen(true)} className="text-gray-500 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-white transition-colors" title="Help">
                  <HelpCircle className="w-5 h-5" />
              </button>
          </div>
        </header>
      )}

      {/* Main Content Switcher */}
      <div className="flex-1 overflow-hidden relative">
        {activeStudio === 'home' && <Dashboard onSelect={startProject} />}
        {activeStudio === 'video' && <VideoStudio initialProject={currentProject} />}
        {activeStudio === 'image' && <ImageStudio initialProject={currentProject} />}
        {activeStudio === 'audio' && <AudioStudio initialProject={currentProject} />}
        {activeStudio === 'pdf' && <PdfStudio initialProject={currentProject} />}
      </div>

      {/* Global AI Disclaimer for Studios */}
      {activeStudio !== 'home' && (
          <div className="h-6 bg-gray-50 dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-center px-4 shrink-0 transition-colors">
              <span className="text-[10px] text-gray-500 dark:text-neutral-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  Ye AI-generated content hai aur developer iski 100% accuracy ya behavior ki guarantee nahi leta.
              </span>
          </div>
      )}

      {/* Modals */}
      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="GaneshayStudio Help">
          <div className="space-y-6">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-amber-800 dark:text-amber-400 text-sm font-medium">
                      ⚠️ Ye AI-generated content hai aur developer iski 100% accuracy ya behavior ki guarantee nahi leta.
                  </p>
              </div>
              <p className="text-gray-600 dark:text-neutral-300 text-sm">GaneshayStudio leverages Google's Gemini AI to enhance your creative workflow.</p>
              <HelpSection title="Video Studio" description="Edit videos with drag-and-drop timeline layers. Features include cut/copy/paste, keyframe animation, AI color grading, storyboard generation, background removal, and smart cuts suggestions." icon={Film} />
              <HelpSection title="Image Studio" description="Professional photo editing with advanced layers. Includes pixel-perfect paint with Blend Modes, ID/Passport photo compliance tools, 3D asset viewer, and AI tools for generation, upscaling, and motion animation." icon={ImageIcon} />
              <HelpSection title="Audio Studio" description="Complete audio workstation. Mix multiple tracks, use drum pads, record microphone input, and edit waveforms (cut/trim). Features AI auto-EQ, compression, speech synthesis (TTS), and visualizers." icon={Activity} />
              <HelpSection title="PDF Studio" description="Document management tools. Compress PDF files with adjustable quality levels to reduce file size." icon={FileText} />
          </div>
      </Modal>

      <Modal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} title="Keyboard Shortcuts">
          <ShortcutsList items={getShortcuts()} />
      </Modal>

    </div>
  );
};

const Dashboard = ({ onSelect }: { onSelect: (type: StudioType, project?: Project) => void }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
      const saved = localStorage.getItem('ganeshaystudio_projects');
      if (saved) {
          try {
            setProjects(JSON.parse(saved));
          } catch(e) {}
      }

      // Theme Init
      if (localStorage.getItem('theme') === 'light') {
          setDarkMode(false);
          document.documentElement.classList.remove('dark');
      } else {
          setDarkMode(true);
          document.documentElement.classList.add('dark');
      }
  }, []);

  const toggleTheme = () => {
      const newMode = !darkMode;
      setDarkMode(newMode);
      if (newMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newProjects = projects.filter(p => p.id !== id);
      setProjects(newProjects);
      localStorage.setItem('ganeshaystudio_projects', JSON.stringify(newProjects));
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
  <div className="h-full w-full overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 font-sans scroll-smooth transition-colors duration-300">
        {/* Header */}
        <header className="fixed w-full backdrop-blur-md bg-white/80 dark:bg-gray-900/80 z-50 border-b border-gray-200 dark:border-gray-800 transition-colors">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <LayoutGrid className="w-8 h-8 text-indigo-600 dark:text-indigo-500" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GaneshayStudio</h1>
                </div>
                <nav className="hidden md:flex items-center space-x-8">
                    <button onClick={() => scrollToSection('features')} className="hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors text-sm font-medium">Features</button>
                    <button onClick={() => scrollToSection('smart-tools')} className="hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors text-sm font-medium">Smart Tools</button>
                    <button onClick={() => scrollToSection('studio-select')} className="hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors text-sm font-medium">My Projects</button>
                </nav>
                <div className="flex items-center space-x-4">
                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300">
                        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => scrollToSection('studio-select')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-indigo-600/20 dark:shadow-indigo-900/50">
                        Get Started
                    </button>
                </div>
            </div>
        </header>

        <main className="pt-24">
            {/* Hero Section */}
            <section className="container mx-auto px-6 py-20 text-center">
                <h2 className="text-4xl md:text-6xl font-extrabold mb-4 text-gray-900 dark:text-white transition-colors">Unleash Your Creativity with</h2>
                <h1 className="text-5xl md:text-7xl font-extrabold mb-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 text-transparent bg-clip-text animate-gradient-x">GaneshayStudio Hub</h1>
                <p className="max-w-3xl mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 transition-colors">
                    Whether you're a beginner or a seasoned creator, GaneshayStudio gives you everything you need to craft stunning videos, images, and audio with AI precision.
                </p>
                <div className="flex justify-center space-x-4 mb-16">
                    <button onClick={() => scrollToSection('studio-select')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 shadow-xl shadow-indigo-600/20 dark:shadow-indigo-900/50">
                        Start Editing Now
                    </button>
                    <button onClick={() => setShowDemo(true)} className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105 border border-gray-300 dark:border-gray-700 flex items-center">
                        <PlayCircle className="w-5 h-5 mr-2" /> Watch Demo
                    </button>
                </div>

                {/* Studio Selection (Functional Dashboard) */}
                <div id="studio-select" className="max-w-6xl mx-auto scroll-mt-28">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
                        <DashboardCard 
                            title="Video Studio" 
                            desc="New Project" 
                            icon={Film} 
                            color="purple" 
                            onClick={() => onSelect('video')} 
                        />
                        <DashboardCard 
                            title="Image Master" 
                            desc="New Project" 
                            icon={ImageIcon} 
                            color="blue" 
                            onClick={() => onSelect('image')} 
                        />
                        <DashboardCard 
                            title="Sonic Lab" 
                            desc="New Project" 
                            icon={Activity} 
                            color="green" 
                            onClick={() => onSelect('audio')} 
                        />
                        <DashboardCard 
                            title="PDF Studio" 
                            desc="New Project" 
                            icon={FileText} 
                            color="red" 
                            onClick={() => onSelect('pdf')} 
                        />
                    </div>

                     {/* Recent Projects */}
                    {projects.length > 0 && (
                        <div className="text-left bg-white/50 dark:bg-gray-800/50 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm mb-20 shadow-lg transition-colors">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center"><FolderOpen className="w-6 h-6 mr-2 text-indigo-500"/> Recent Projects</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {projects.sort((a,b) => b.createdAt - a.createdAt).map(project => (
                                    <div 
                                        key={project.id} 
                                        onClick={() => onSelect(project.type as StudioType, project)}
                                        className="group bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 hover:border-indigo-500/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800 relative hover:-translate-y-1 shadow-sm hover:shadow-md"
                                    >
                                        <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${project.type === 'video' ? 'bg-purple-500' : project.type === 'image' ? 'bg-blue-500' : project.type === 'pdf' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate pr-4">{project.name}</h3>
                                        <p className="text-xs text-gray-500 mb-4">{new Date(project.createdAt).toLocaleDateString()}</p>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-950 px-2 py-1 rounded">{project.type}</span>
                                            <button onClick={(e) => deleteProject(project.id, e)} className="text-gray-400 hover:text-red-500 p-1 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 max-w-5xl mx-auto p-4 bg-white dark:bg-gray-800/50 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 transition-colors">
                    <div className="aspect-video bg-gray-900 dark:bg-black rounded-lg flex items-center justify-center mb-4 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-purple-900/20"></div>
                        {/* Simulated Editor Preview */}
                        <LayoutGrid className="w-24 h-24 text-gray-700 group-hover:text-indigo-500 transition-colors duration-500 relative z-10" />
                        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur">Preview Mode</div>
                    </div>
                    <div className="h-24 bg-gray-100 dark:bg-gray-900 rounded-lg p-2 transition-colors">
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800/50 rounded-md flex items-center space-x-1 p-1 transition-colors">
                            <div className="h-full w-1/4 bg-indigo-500/50 rounded-sm"></div>
                            <div className="h-full w-1/6 bg-purple-500/50 rounded-sm"></div>
                            <div className="h-full w-1/3 bg-indigo-500/50 rounded-sm"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 transition-colors">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">Everything You Need, All in One Place</h2>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">From basic cuts to complex animations, our complete feature set has you covered.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard 
                            icon={<Scissors className="w-6 h-6"/>} 
                            title="Edit Like a Pro" 
                            color="text-indigo-600 dark:text-indigo-400" 
                            bg="bg-indigo-100 dark:bg-indigo-500/10"
                            items={['✂️ Multi-layer drag-and-drop timeline', '🎬 Trim, split, crop, and merge clips', '🔄 Keyframe animation & undo history']}
                        />
                        <FeatureCard 
                            icon={<Wand2 className="w-6 h-6"/>} 
                            title="Stunning FX & Filters" 
                            color="text-purple-600 dark:text-purple-400" 
                            bg="bg-purple-100 dark:bg-purple-500/10"
                            items={['✨ Real-time effects: glitch, VHS, etc.', '🎨 Advanced color grading with LUTs', '🪄 AI-powered auto-enhance']}
                        />
                        <FeatureCard 
                            icon={<Zap className="w-6 h-6"/>} 
                            title="Motion & Animation" 
                            color="text-pink-600 dark:text-pink-400" 
                            bg="bg-pink-100 dark:bg-pink-500/10"
                            items={['🌀 Motion tracking & object animation', '🟩 Green screen (chroma key) support', '⏱️ Speed ramping & time remapping']}
                        />
                        <FeatureCard 
                            icon={<Music className="w-6 h-6"/>} 
                            title="Studio-Grade Audio" 
                            color="text-teal-600 dark:text-teal-400" 
                            bg="bg-teal-100 dark:bg-teal-500/10"
                            items={['🔊 Multi-track audio mixing', '🎤 Voice enhancement & noise reduction', '🎶 Royalty-free music library']}
                        />
                        <FeatureCard 
                            icon={<Video className="w-6 h-6"/>} 
                            title="Export & Share" 
                            color="text-blue-600 dark:text-blue-400" 
                            bg="bg-blue-100 dark:bg-blue-500/10"
                            items={['🚀 4K export with bitrate control', '📱 Social media presets (YouTube, TikTok)', '💧 Watermark control & branding']}
                        />
                        <FeatureCard 
                            icon={<Grid className="w-6 h-6"/>} 
                            title="Intuitive Interface" 
                            color="text-orange-600 dark:text-orange-400" 
                            bg="bg-orange-100 dark:bg-orange-500/10"
                            items={['🎨 Customizable workspace', '👁️ Real-time preview window', '✍️ Touch and stylus support']}
                        />
                    </div>
                </div>
            </section>
            
            {/* Smart Features Section */}
            <section id="smart-tools" className="py-20 border-t border-gray-200 dark:border-gray-800 transition-colors">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">Smart Features That Work for You</h2>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Let our AI do the heavy lifting, so you can focus on creativity.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <SmartFeatureCard 
                            icon={<Scissors className="w-6 h-6"/>}
                            title="AI Auto-Cut"
                            desc="Automatically find the most exciting parts of your clips and create a dynamic highlight reel in seconds."
                            color="text-rose-600 dark:text-rose-400"
                            bg="bg-rose-100 dark:bg-rose-500/10"
                        />
                        <SmartFeatureCard 
                            icon={<Mic className="w-6 h-6"/>}
                            title="Auto Subtitles"
                            desc="Generate accurate, timed subtitles from your video's audio with our speech-to-text engine."
                            color="text-cyan-600 dark:text-cyan-400"
                            bg="bg-cyan-100 dark:bg-cyan-500/10"
                        />
                        <SmartFeatureCard 
                            icon={<Monitor className="w-6 h-6"/>}
                            title="Face Recognition"
                            desc="Keep subjects perfectly in frame with auto-focus and tracking that intelligently follows faces."
                            color="text-amber-600 dark:text-amber-400"
                            bg="bg-amber-100 dark:bg-amber-500/10"
                        />
                    </div>
                </div>
            </section>

            {/* Tools Hub Section */}
            <section id="tools" className="py-20 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 transition-colors">
                 <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">Your Powerhouse Editing Tools Hub</h2>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Go beyond the basics with specialized tools designed for precision and creativity.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <ToolCard icon={<Wand2 className="w-8 h-8"/>} title="AI Magic Wand" desc="One-click color correction." color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-100 dark:bg-indigo-500/10" />
                        <ToolCard icon={<Layers className="w-8 h-8"/>} title="Precision Keyer" desc="Remove green screens easily." color="text-green-600 dark:text-green-400" bg="bg-green-100 dark:bg-green-500/10" />
                        <ToolCard icon={<Activity className="w-8 h-8"/>} title="Audio Ducking" desc="Auto-lower background music." color="text-blue-600 dark:text-blue-400" bg="bg-blue-100 dark:bg-blue-500/10" />
                        <ToolCard icon={<Video className="w-8 h-8"/>} title="Multi-Cam Sync" desc="Sync footage instantly." color="text-red-600 dark:text-red-400" bg="bg-red-100 dark:bg-red-500/10" />
                    </div>
                </div>
            </section>

             {/* Footer */}
             <footer className="bg-gray-100 dark:bg-gray-950 py-12 border-t border-gray-200 dark:border-gray-800 transition-colors">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-12">
                        <div className="mb-8 md:mb-0 max-w-sm">
                             <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center mb-4"><LayoutGrid className="w-6 h-6 mr-2 text-indigo-500"/> GaneshayStudio</h3>
                             <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                 The next generation of creative tools. Powered by Gemini AI to bring your vision to life faster than ever before.
                             </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-12">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-sm">Follow Us</h4>
                                <div className="flex space-x-4">
                                    <a href="#" className="p-2 bg-white dark:bg-gray-900 rounded-full text-pink-600 hover:bg-pink-50 dark:hover:bg-gray-800 transition-colors shadow-sm"><Instagram className="w-5 h-5" /></a>
                                    <a href="#" className="p-2 bg-white dark:bg-gray-900 rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors shadow-sm"><Facebook className="w-5 h-5" /></a>
                                    <a href="#" className="p-2 bg-white dark:bg-gray-900 rounded-full text-sky-500 hover:bg-sky-50 dark:hover:bg-gray-800 transition-colors shadow-sm"><Send className="w-5 h-5" /></a>
                                    <a href="#" className="p-2 bg-white dark:bg-gray-900 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 transition-colors shadow-sm"><Youtube className="w-5 h-5" /></a>
                                    <a href="#" className="p-2 bg-white dark:bg-gray-900 rounded-full text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors shadow-sm"><Twitter className="w-5 h-5" /></a>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-sm">Support</h4>
                                <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                    <li className="flex items-center hover:text-indigo-500 cursor-pointer"><Mail className="w-4 h-4 mr-2"/> support@ganeshaystudio.ai</li>
                                    <li className="flex items-center hover:text-indigo-500 cursor-pointer"><Phone className="w-4 h-4 mr-2"/> +1 (555) 123-4567</li>
                                    <li className="flex items-center hover:text-indigo-500 cursor-pointer"><HelpCircle className="w-4 h-4 mr-2"/> Help Center</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
                         <div className="text-left mb-4 md:mb-0">
                            <p className="text-gray-500 text-sm">© 2024 GaneshayStudio Creative Suite. All rights reserved.</p>
                            <p className="text-xs text-gray-400 mt-1 italic">Ye AI-generated content hai aur developer iski 100% accuracy ya behavior ki guarantee nahi leta.</p>
                         </div>
                         <div className="flex space-x-6 mt-4 md:mt-0">
                            <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm transition-colors">Privacy Policy</a>
                            <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm transition-colors">Terms of Service</a>
                         </div>
                    </div>
                </div>
            </footer>

            {/* Demo Video Modal */}
            {showDemo && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowDemo(false)}>
                    <div className="bg-black border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowDemo(false)} className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black text-white p-2 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                        <div className="aspect-video w-full">
                             {/* Placeholder Video Embed */}
                             <iframe 
                                width="100%" 
                                height="100%" 
                                src="https://www.youtube.com/embed/LXb3EKWsInQ?autoplay=1" 
                                title="GaneshayStudio Demo" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                             ></iframe>
                        </div>
                    </div>
                </div>
            )}
        </main>
  </div>
)};

const DashboardCard = ({ title, desc, icon: Icon, color, onClick }: any) => {
    const colorMap: Record<string, string> = {
        purple: 'hover:border-purple-500/50 hover:shadow-purple-500/20 text-purple-600 dark:text-purple-400',
        blue: 'hover:border-blue-500/50 hover:shadow-blue-500/20 text-blue-600 dark:text-blue-400',
        green: 'hover:border-green-500/50 hover:shadow-green-500/20 text-green-600 dark:text-green-400',
        red: 'hover:border-red-500/50 hover:shadow-red-500/20 text-red-600 dark:text-red-400',
    };

    return (
      <button onClick={onClick} className={`group relative h-64 bg-white dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-start justify-end overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${colorMap[color]} shadow-sm`}>
        <div className="absolute inset-0 bg-gradient-to-t from-gray-100 dark:from-gray-900 via-transparent to-transparent opacity-80" />
        <Icon className={`w-16 h-16 mb-auto opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 ${colorMap[color].split(' ').pop()}`} />
        <div className="relative z-10 text-left">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 group-hover:tracking-wide transition-all">{title}</h3>
          <div className="flex items-center text-gray-500 dark:text-gray-400 font-medium group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              <Plus className="w-4 h-4 mr-1"/> {desc}
          </div>
        </div>
      </button>
    )
}

const FeatureCard = ({ icon, title, color, bg, items }: any) => (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-8 rounded-xl hover:-translate-y-1 transition-all hover:shadow-2xl duration-300 shadow-sm">
        <div className={`${bg} ${color} rounded-lg w-12 h-12 flex items-center justify-center mb-6`}>
            {icon}
        </div>
        <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{title}</h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            {items.map((item: string, i: number) => <li key={i}>{item}</li>)}
        </ul>
    </div>
);

const SmartFeatureCard = ({ icon, title, desc, color, bg }: any) => (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-8 rounded-xl hover:-translate-y-1 transition-all hover:shadow-2xl duration-300 shadow-sm">
        <div className={`${bg} ${color} rounded-lg w-12 h-12 flex items-center justify-center mb-6`}>
            {icon}
        </div>
        <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400">{desc}</p>
    </div>
);

const ToolCard = ({ icon, title, desc, color, bg }: any) => (
    <div className="text-center p-8 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 transition-all hover:-translate-y-2 duration-300 bg-white dark:bg-transparent shadow-sm dark:shadow-none">
        <div className={`mx-auto ${bg} ${color} rounded-lg w-16 h-16 flex items-center justify-center mb-6`}>
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400">{desc}</p>
    </div>
);

export default App;