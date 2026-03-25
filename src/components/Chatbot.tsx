import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { createChatSession } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export interface ChatbotRef {
  openAndSend: (message: string) => void;
}

export const Chatbot = forwardRef<ChatbotRef, { cvContext?: string }>(({ cvContext }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    openAndSend: (message: string) => {
      setIsOpen(true);
      setPendingMessage(message);
    }
  }));

  useEffect(() => {
    if (isOpen && !chatRef.current) {
      chatRef.current = createChatSession(cvContext);
      setMessages([{ role: 'model', text: 'Hi! I am your AI Career Coach. Ask me anything about your CV, interview prep, or career advice!' }]);
    }
  }, [isOpen, cvContext]);

  useEffect(() => {
    if (pendingMessage && chatRef.current && !isLoading) {
      handleSend(pendingMessage);
      setPendingMessage(null);
    }
  }, [pendingMessage, chatRef.current, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (overrideMessage?: string) => {
    const userMsg = (overrideMessage || input).trim();
    if (!userMsg || !chatRef.current) return;
    
    if (!overrideMessage) setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      const errStr = error instanceof Error ? error.message : String(error);
      
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("rate limit") || errStr.toLowerCase().includes("too many requests")) {
        errorMessage = "You've reached the rate limit for the AI service. Please wait a moment and try again.";
      } else if (errStr.includes("401") || errStr.includes("403") || errStr.toLowerCase().includes("api key") || errStr.includes("API_KEY_INVALID")) {
        errorMessage = "There is an issue with the AI service configuration (Invalid API Key). Please check your settings.";
      } else if (errStr.toLowerCase().includes("fetch failed") || errStr.toLowerCase().includes("network")) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      }
      
      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
        aria-expanded={isOpen}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 p-4 bg-slate-900 text-white rounded-full shadow-xl hover:bg-slate-800 transition-transform hover:scale-105 z-40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isOpen ? 'hidden' : 'block'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 w-auto sm:w-96 h-[80vh] sm:h-[500px] max-h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col z-50 overflow-hidden"
          >
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="font-bold font-display tracking-tight">Career Coach AI</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                aria-label="Close chat"
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'}`}>
                    <div className="markdown-body prose prose-sm max-w-none">
                      <Markdown rehypePlugins={[rehypeSanitize]}>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 rounded-bl-sm shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask for advice..."
                  aria-label="Chat input"
                  className="flex-1 bg-transparent border-none focus:outline-none px-3 py-2 text-sm text-slate-700 placeholder:text-slate-500"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  aria-label="Send message"
                  className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
