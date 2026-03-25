import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, FileText, Briefcase, MessageSquare, ArrowRight, CheckCircle, Flame } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 } 
  }
};

const features = [
  {
    icon: <FileText className="w-6 h-6 text-indigo-500" />,
    title: "Smart ATS Scoring",
    description: "Get an instant score on how well your CV passes Applicant Tracking Systems. Identify missing keywords and formatting issues."
  },
  {
    icon: <Sparkles className="w-6 h-6 text-purple-500" />,
    title: "AI Cover Letters",
    description: "Generate highly tailored, professional cover letters in seconds based on your CV and the specific job description."
  },
  {
    icon: <Briefcase className="w-6 h-6 text-emerald-500" />,
    title: "Live Market Insights",
    description: "Fetch real-time salary data, required skills, and market trends for your target role directly from the web."
  },
  {
    icon: <MessageSquare className="w-6 h-6 text-blue-500" />,
    title: "AI Career Coach",
    description: "Chat with an intelligent assistant that knows your CV inside out. Ask for interview tips or career advice."
  },
  {
    icon: <Flame className="w-6 h-6 text-orange-500" />,
    title: "The Hot Seat",
    description: "Our AI acts as a tough recruiter, finding your CV's weak spots and generating the hardest interview questions you'll face."
  }
];

export function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      <motion.div 
        className="max-w-4xl mx-auto text-center space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Your AI-Powered Career Assistant</span>
        </motion.div>

        <motion.h1 
          variants={itemVariants}
          className="text-5xl sm:text-7xl font-extrabold tracking-tight font-display text-slate-900 leading-[1.1]"
        >
          Land your dream job with a <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            perfectly optimized CV
          </span>
        </motion.h1>

        <motion.p 
          variants={itemVariants}
          className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
        >
          Upload your resume and let our advanced AI analyze it against industry standards. Get actionable feedback, generate cover letters, and chat with your personal career coach.
        </motion.p>

        <motion.div variants={itemVariants} className="pt-8 pb-16">
          <button
            onClick={signInWithGoogle}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-lg font-semibold text-white transition-all duration-200 bg-slate-900 font-display rounded-full hover:bg-slate-800 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 bg-white rounded-full p-0.5" />
            Sign in with Google to Start
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="mt-4 text-sm text-slate-500">Free to use. No credit card required.</p>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="grid sm:grid-cols-2 gap-8 text-left mt-12"
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-100">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="mt-24 pt-12 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-center gap-8 text-slate-600"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span>Secure & Private</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span>Powered by Gemini AI</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span>Real-time Insights</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
