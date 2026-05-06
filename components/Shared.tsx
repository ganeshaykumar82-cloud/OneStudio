
import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, X, ChevronRight, Keyboard, HelpCircle, Info } from 'lucide-react';

// Fix: Make children optional to resolve TypeScript errors in usage
export const Sidebar = ({ children }: { children?: React.ReactNode }) => (
  <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col z-10 shrink-0 overflow-hidden h-full">
    {children}
  </aside>
);

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  colorClass?: string;
}

export const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label, colorClass = 'border-purple-500' }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center space-x-3 px-6 py-3 border-l-2 transition-all duration-200 
      ${active 
        ? `bg-neutral-800 ${colorClass} text-white` 
        : 'border-transparent text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
      }`}
  >
     <Icon className="w-4 h-4" />
     <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
  </button>
);

interface SliderProps {
  label: string;
  value: number;
  max: number;
  min?: number;
  step?: number;
  onChange: (val: number) => void;
}

export const Slider: React.FC<SliderProps> = ({ label, value, max, min=0, step=1, onChange }) => (
  <div className="group">
    <div className="flex justify-between mb-2">
       <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider group-hover:text-white transition-colors">{label}</span>
       <span className="text-[10px] font-mono text-neutral-500 bg-neutral-800 px-1 rounded">{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 1) : value}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={e => onChange(parseFloat(e.target.value))} 
      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-500 hover:accent-white transition-all" 
    />
  </div>
);

export const ToggleButton = ({ label, state, setState, Icon }: { label: string, state: boolean, setState: (v: boolean) => void, Icon: LucideIcon }) => (
    <button 
        onClick={() => setState(!state)} 
        className={`w-full py-2 rounded text-xs font-bold transition-all flex items-center justify-center border ${state ? 'bg-neutral-100 text-black border-white' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'}`}
    >
        <Icon className="w-3 h-3 mr-2" /> {label}
    </button>
);

interface KnobProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    onChangeEnd?: (val: number) => void;
    size?: number;
    color?: string;
    step?: number;
}

export const Knob: React.FC<KnobProps> = ({ label, value, min, max, onChange, onChangeEnd, size = 64, color = '#22c55e', step = 1 }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startVal = useRef(0);
    
    // Refs for callbacks to prevent effect re-running
    const onChangeRef = useRef(onChange);
    const onChangeEndRef = useRef(onChangeEnd);

    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { onChangeEndRef.current = onChangeEnd; }, [onChangeEnd]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: MouseEvent) => {
            e.preventDefault();
            
            // Calculate delta (drag up to increase, down to decrease)
            const deltaY = startY.current - e.clientY;
            const range = max - min;
            
            // Sensitivity: 150px drag height = full range
            const sensitivity = 150;
            const delta = (deltaY / sensitivity) * range; 
            
            let newVal = startVal.current + delta;
            
            // Snap to step
            if (step) newVal = Math.round(newVal / step) * step;
            
            // Clamp
            newVal = Math.min(max, Math.max(min, newVal));
            
            // Call latest onChange
            if (onChangeRef.current) onChangeRef.current(newVal);
        };
        
        const handleUp = (e: MouseEvent) => {
            setIsDragging(false);
            document.body.style.cursor = '';
            
            // Recalculate one last time to be precise for the end event
            const deltaY = startY.current - e.clientY;
            const range = max - min;
            const sensitivity = 150;
            const delta = (deltaY / sensitivity) * range; 
            let newVal = startVal.current + delta;
            if (step) newVal = Math.round(newVal / step) * step;
            newVal = Math.min(max, Math.max(min, newVal));

            if (onChangeEndRef.current) onChangeEndRef.current(newVal);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        document.body.style.cursor = 'ns-resize';

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDragging, max, min, step]);

    const handleDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startY.current = e.clientY;
        startVal.current = value;
    };

    // --- Geometry for Gauge ---
    const strokeWidth = size * 0.12; // Dynamic stroke based on size
    const radius = (size / 2) - strokeWidth;
    const center = size / 2;
    
    // We want a 270 degree arc (leaving 90 degrees open at bottom)
    // Start angle: 135 deg (bottom-left)
    // End angle: 405 deg (bottom-right)
    const startAngle = 135;
    const endAngle = 405;
    const angleRange = endAngle - startAngle;
    
    const percentage = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const currentAngle = startAngle + (percentage * angleRange);

    // Helper to get coordinates
    const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: cx + (r * Math.cos(angleInRadians)),
            y: cy + (r * Math.sin(angleInRadians))
        };
    };

    const createArc = (start: number, end: number) => {
        const startPt = polarToCartesian(center, center, radius, end);
        const endPt = polarToCartesian(center, center, radius, start);
        const largeArcFlag = end - start <= 180 ? "0" : "1";
        return [
            "M", startPt.x, startPt.y, 
            "A", radius, radius, 0, largeArcFlag, 0, endPt.x, endPt.y
        ].join(" ");
    };

    const trackPath = createArc(startAngle, endAngle);
    const progressPath = createArc(startAngle, currentAngle);
    
    // Handle Dot Position
    const handlePos = polarToCartesian(center, center, radius, currentAngle);

    return (
        <div className="flex flex-col items-center group select-none">
            <div 
                onMouseDown={handleDown}
                className="relative cursor-ns-resize hover:scale-105 transition-transform"
                style={{ width: size, height: size }}
            >
                <svg width={size} height={size}>
                     {/* Background Track (Dark Grey) */}
                     <path 
                        d={trackPath} 
                        fill="none" 
                        stroke="#2d3748" // neutral-750 
                        strokeWidth={strokeWidth} 
                        strokeLinecap="round" 
                    />
                    
                    {/* Active Value Arc (Colored) */}
                     <path 
                        d={progressPath} 
                        fill="none" 
                        stroke={color} 
                        strokeWidth={strokeWidth} 
                        strokeLinecap="round" 
                        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
                    />

                    {/* Handle Dot */}
                    <circle 
                        cx={handlePos.x} 
                        cy={handlePos.y} 
                        r={strokeWidth * 0.8} 
                        fill="white" 
                        className="shadow-sm"
                    />

                    {/* Center Value Text */}
                    <text 
                        x="50%" 
                        y="54%" 
                        dominantBaseline="middle" 
                        textAnchor="middle" 
                        fill="white" 
                        fontSize={size * 0.25} 
                        fontWeight="bold"
                        fontFamily="monospace"
                        className="pointer-events-none"
                    >
                        {Math.round(value)}
                    </text>
                </svg>
            </div>
             <div className="mt-2 text-center">
                 <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</div>
             </div>
        </div>
    );
};

export const CurveEditorMock = ({ title, color = "#eab308" }: { title: string, color?: string }) => (
    <div className="border border-neutral-700 rounded p-2 bg-neutral-800/30 backdrop-blur-sm">
        <h4 className="text-[10px] font-bold mb-2" style={{ color }}>{title}</h4>
        <div className="h-20 w-full relative overflow-hidden rounded bg-neutral-900/50">
            <svg viewBox="0 0 100 100" className="w-full h-full">
                <line x1="0" y1="100" x2="100" y2="0" stroke="#404040" strokeWidth="1" strokeDasharray="4" />
                <path d="M0 100 C 30 90, 70 10, 100 0" fill="none" stroke={color} strokeWidth="2" />
                <circle cx="30" cy="90" r="3" fill="#fff" />
                <circle cx="70" cy="10" r="3" fill="#fff" />
            </svg>
        </div>
    </div>
);

// --- New UI Components ---

export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
           <h3 className="text-lg font-bold text-white flex items-center">{title}</h3>
           <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 overflow-y-auto">
           {children}
        </div>
      </div>
    </div>
  );
};

export const ShortcutsList = ({ items }: { items: { key: string, action: string }[] }) => (
    <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-neutral-800/50 p-2 rounded border border-neutral-800">
                <span className="text-sm text-neutral-300">{item.action}</span>
                <span className="text-xs font-mono bg-neutral-900 px-2 py-1 rounded border border-neutral-700 text-neutral-400 font-bold shadow-sm min-w-[1.5rem] text-center">
                    {item.key}
                </span>
            </div>
        ))}
    </div>
);

export const HelpSection = ({ title, description, icon: Icon }: { title: string, description: string, icon?: LucideIcon }) => (
    <div className="mb-6 last:mb-0">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center">
            {Icon && <Icon className="w-4 h-4 mr-2 text-blue-500" />}
            {title}
        </h4>
        <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>
    </div>
);

export const TourOverlay = ({ steps, onClose }: { steps: { target?: string, title: string, desc: string }[], onClose: () => void }) => {
    const [currentStep, setCurrentStep] = React.useState(0);
    const step = steps[currentStep];

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 flex flex-col items-center justify-center pointer-events-auto">
            <div className="bg-neutral-900 border border-purple-500/50 p-8 rounded-2xl shadow-2xl max-w-md text-center relative animate-bounce-slight">
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-purple-600 p-3 rounded-full border-4 border-neutral-900 shadow-xl">
                    <Info className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 mt-4">{step.title}</h3>
                <p className="text-neutral-400 mb-6">{step.desc}</p>
                
                <div className="flex justify-center space-x-4">
                    {currentStep < steps.length - 1 ? (
                        <button 
                            onClick={() => setCurrentStep(c => c + 1)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full font-bold text-sm transition-all flex items-center"
                        >
                            Next Step <ChevronRight className="w-4 h-4 ml-1" />
                        </button>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-bold text-sm transition-all"
                        >
                            Get Started
                        </button>
                    )}
                </div>
                
                <div className="mt-4 flex justify-center space-x-1">
                    {steps.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === currentStep ? 'bg-purple-500' : 'bg-neutral-800'}`} />
                    ))}
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 text-neutral-600 hover:text-white text-xs">Skip</button>
            </div>
        </div>
    );
}
