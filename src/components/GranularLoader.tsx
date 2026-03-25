import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface GranularLoaderProps {
  messages: string[];
  intervalMs?: number;
  colorClass?: string;
  spinnerColorClass?: string;
  spinnerSize?: string;
}

export function GranularLoader({ 
  messages, 
  intervalMs = 2500, 
  colorClass = "text-indigo-700", 
  spinnerColorClass = "text-indigo-600",
  spinnerSize = "w-6 h-6"
}: GranularLoaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const progress = ((currentIndex + 1) / messages.length) * 100;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, messages.length - 1));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [messages.length, intervalMs]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full max-w-xs mx-auto">
      <Loader2 className={cn("animate-spin", spinnerSize, spinnerColorClass)} />
      
      <div className="w-full space-y-2">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            className={cn("h-full rounded-full", spinnerColorClass.replace('text-', 'bg-'))}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        
        <div className="h-5 relative w-full flex justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={cn("text-sm font-medium absolute text-center w-full px-4 truncate", colorClass)}
            >
              {messages[currentIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
