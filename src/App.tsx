import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Briefcase,
  ChevronRight,
  Loader2,
  Sparkles,
  Info,
  ChevronDown,
  X,
  LogOut,
  History,
  ArrowLeft,
  Trash2,
  Copy,
  MessageSquare,
  Flame,
  Linkedin,
  Download,
  Target,
} from "lucide-react";
import { useDropzone, FileRejection } from "react-dropzone";
import rehypeSanitize from "rehype-sanitize";
import { jsPDF } from "jspdf";
import {
  analyzeCV,
  getMarketInsights,
  generateCoverLetter,
  generateHotSeatQuestions,
  generateLinkedInProfile,
  getJobRecommendations,
  rewriteCV,
  type AnalysisResult,
  type JobRecommendation,
} from "./lib/gemini";
import { CircularProgress } from "./components/CircularProgress";
import { cn } from "./lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};
import {
  auth,
  db,
  signInWithGoogle,
  logOut,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { Chatbot, ChatbotRef } from "./components/Chatbot";
import { LandingPage } from "./components/LandingPage";
import { GranularLoader } from "./components/GranularLoader";
import Markdown from "react-markdown";

interface SavedAnalysis extends AnalysisResult {
  id: string;
  fileName: string;
  createdAt: Date;
  jobDescription?: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescriptions, setJobDescriptions] = useState<string[]>([""]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const ANALYSIS_STEPS = [
    "Extracting text and formatting from CV...",
    "Analyzing core skills and experience...",
    "Evaluating against job descriptions...",
    "Generating improvement suggestions...",
    "Finalizing consolidated report..."
  ];
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAtsModal, setShowAtsModal] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(
    null,
  );

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{
    subscriptionTier: string;
    credits: number;
  } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<"upload" | "results" | "history">("upload");
  const [history, setHistory] = useState<SavedAnalysis[]>([]);

  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [marketInsights, setMarketInsights] = useState<{
    salaryTrends: string;
    inDemandSkills: string[];
    topCompanies: string[];
    generalOutlook: string;
    groundingChunks: any[];
  } | null>(null);
  const [isGettingInsights, setIsGettingInsights] = useState(false);
  const [marketInsightsError, setMarketInsightsError] = useState<string | null>(
    null,
  );
  const [marketInsightsRefinement, setMarketInsightsRefinement] = useState("");

  const [hotSeatQuestions, setHotSeatQuestions] = useState<
    { weakness: string; question: string; defenseStrategy: string }[] | null
  >(null);
  const [isGeneratingHotSeat, setIsGeneratingHotSeat] = useState(false);
  const [hotSeatError, setHotSeatError] = useState<string | null>(null);

  const [linkedInProfile, setLinkedInProfile] = useState<{
    headline: string;
    about: string;
  } | null>(null);
  const [isGeneratingLinkedIn, setIsGeneratingLinkedIn] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);

  const [rewrittenCV, setRewrittenCV] = useState<string | null>(null);
  const [isRewritingCV, setIsRewritingCV] = useState(false);
  const [rewriteCVError, setRewriteCVError] = useState<string | null>(null);

  const [jobRecommendations, setJobRecommendations] = useState<JobRecommendation[] | null>(null);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedRewrite, setCopiedRewrite] = useState(false);
  const [copiedSuggestion, setCopiedSuggestion] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const chatbotRef = useRef<ChatbotRef>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success') {
      setCheckoutSuccess('Payment successful! You are now a Pro user.');
      window.history.replaceState({}, document.title, '/');
      setShowUpgradeModal(false);
    } else if (paymentStatus === 'failed') {
      setCheckoutError('Payment failed or was cancelled.');
      window.history.replaceState({}, document.title, '/');
    } else if (paymentStatus === 'success_demo') {
      const uid = params.get('userId');
      if (uid && user && user.uid === uid) {
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          updateDoc(doc(db, 'users', uid), {
            subscriptionTier: 'pro',
            credits: 9999
          }).catch(console.error);
        });
      }
      setCheckoutSuccess('Payment successful! (Demo mode)');
      window.history.replaceState({}, document.title, '/');
      setShowUpgradeModal(false);
    }
  }, [user]);

  const handleJazzCashCheckout = async () => {
    if (!user) return;
    setCheckoutError(null);
    
    // If no JazzCash credentials are provided, use demo mode immediately
    // We check this by trying the API first, or we can just use a demo toggle.
    // Let's try the API.
    try {
      const response = await fetch('/api/jazzcash/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email })
      });
      
      // If the server is not running the Express backend (e.g. still running Vite dev server),
      // it will return HTML instead of JSON.
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const result = await response.json();
        
        if (result.error) {
          // If credentials are not configured on the server, fallback to demo mode
          if (result.error.includes('credentials not configured')) {
            setCheckoutSuccess("JazzCash keys not found. Using Demo Mode to upgrade your account.");
            import('firebase/firestore').then(({ doc, updateDoc }) => {
              updateDoc(doc(db, 'users', user.uid), {
                subscriptionTier: 'pro',
                credits: 9999
              }).catch(console.error);
            });
            setTimeout(() => setShowUpgradeModal(false), 2000);
            return;
          }
          setCheckoutError(result.error);
          return;
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.url;
        
        for (const key in result.data) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = result.data[key];
          form.appendChild(input);
        }
        
        document.body.appendChild(form);
        form.submit();
      } else {
        // Fallback to demo mode if backend is not available
        setCheckoutSuccess("Backend not ready. Using Demo Mode to upgrade your account.");
        import('firebase/firestore').then(({ doc, updateDoc }) => {
          updateDoc(doc(db, 'users', user.uid), {
            subscriptionTier: 'pro',
            credits: 9999
          }).catch(console.error);
        });
        setTimeout(() => setShowUpgradeModal(false), 2000);
      }
      
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError('Failed to initiate checkout. Please try again.');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as any);
            } else {
              setDoc(userRef, {
                email: currentUser.email,
                displayName: currentUser.displayName || "",
                photoURL: currentUser.photoURL || "",
                subscriptionTier: "free",
                credits: 5,
                createdAt: serverTimestamp(),
              });
            }
          });
          return () => unsubscribeProfile();
        } catch (error) {
          console.error("Error creating/fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "analyses"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const analysesData: SavedAnalysis[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          analysesData.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as SavedAnalysis);
        });
        setHistory(analysesData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "analyses");
      },
    );

    return () => unsubscribe();
  }, [user, isAuthReady]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB limit
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]); // Only process the first file
        setError(null);
      }
    },
    onDropRejected: (fileRejections: FileRejection[]) => {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === "file-too-large") {
        setError(`File "${rejection.file.name}" is too large. Maximum size is 5MB.`);
      } else if (rejection.errors[0].code === "file-invalid-type") {
        setError(`Invalid file type for "${rejection.file.name}". Please upload a PDF document.`);
      } else {
        setError(`File upload rejected: ${rejection.errors[0].message}`);
      }
    },
  });

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload a CV first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep(0);
    setError(null);

    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => Math.min(prev + 1, ANALYSIS_STEPS.length - 2));
    }, 3000);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = (reader.result as string).split(",")[1];
        try {
          const mimeType = file.type || "application/pdf";
          const analysis = await analyzeCV(
            base64String,
            mimeType,
            jobDescriptions,
          );
          
          clearInterval(stepInterval);
          setAnalysisStep(ANALYSIS_STEPS.length - 1);
          
          setTimeout(async () => {
            setResult(analysis);
            setView("results");
            setIsAnalyzing(false);

            if (user) {
              try {
                const docData: any = {
                  userId: user.uid,
                  createdAt: serverTimestamp(),
                  fileName: (file.name || "Unknown File").substring(0, 255),
                  atsScore: Number(analysis.atsScore) || 0,
                  atsScoreBreakdown: analysis.atsScoreBreakdown || null,
                  missingSkills: (analysis.missingSkills || []).slice(0, 100),
                  suggestions: (analysis.suggestions || []).slice(0, 100),
                };

                if (analysis.matchScore != null) {
                  docData.matchScore = Number(analysis.matchScore) || 0;
                }

                const validJds = jobDescriptions.filter(jd => jd.trim().length > 0);
                if (validJds.length > 0) {
                  docData.jobDescriptions = validJds.map(jd => jd.substring(0, 5000));
                }
                if (analysis.jobMatches && analysis.jobMatches.length > 0) {
                  docData.jobMatches = analysis.jobMatches;
                }

                await addDoc(collection(db, "analyses"), docData);
              } catch (firestoreErr) {
                handleFirestoreError(
                  firestoreErr,
                  OperationType.CREATE,
                  "analyses",
                );
              }
            }
          }, 500);
        } catch (err: any) {
          clearInterval(stepInterval);
          console.error("CV Analysis Error:", err);
          setError(err.message || "Failed to analyze CV. Please try again.");
          setIsAnalyzing(false);
        }
      };
      reader.onerror = () => {
        clearInterval(stepInterval);
        setError("Failed to read file.");
        setIsAnalyzing(false);
      };
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || "An unexpected error occurred.");
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setJobDescriptions([""]);
    setResult(null);
    setError(null);
    setExpandedSuggestion(null);
    setCoverLetter(null);
    setMarketInsights(null);
    setHotSeatQuestions(null);
    setView("upload");
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteDoc(doc(db, "analyses", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `analyses/${id}`);
    }
  };

  const viewHistoryItem = (item: SavedAnalysis) => {
    setResult(item);
    if (item.jobDescriptions && item.jobDescriptions.length > 0) {
      setJobDescriptions(item.jobDescriptions);
    } else if (item.jobDescription) {
      setJobDescriptions([item.jobDescription]);
    } else {
      setJobDescriptions([""]);
    }
    setCoverLetter(null);
    setMarketInsights(null);
    setHotSeatQuestions(null);
    setView("results");
  };

  const handleGenerateCoverLetter = async () => {
    if (!result) return;
    setIsGeneratingCoverLetter(true);
    setCoverLetterError(null);
    try {
      const context = `ATS Score: ${result.atsScore}\nMissing Skills: ${result.missingSkills.join(", ")}`;
      const jd = jobDescriptions.find(jd => jd.trim().length > 0) || "";
      const cl = await generateCoverLetter(context, jd);
      setCoverLetter(cl || null);
    } catch (err: any) {
      console.error(err);
      setCoverLetterError(
        err.message || "An error occurred while generating the cover letter.",
      );
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleGetJobRecommendations = async () => {
    if (!result || !file) return;
    setIsGeneratingRecommendations(true);
    setRecommendationsError(null);
    try {
      // Fetch preferences and saved searches
      let preferences = {};
      let savedSearches: any[] = [];
      
      if (user) {
        try {
          const prefDoc = await getDoc(doc(db, "preferences", user.uid));
          if (prefDoc.exists()) {
            preferences = prefDoc.data();
          }
          
          // We would normally fetch saved searches here, but for now we'll pass empty array
          // or we could implement a quick fetch if we had a collection for it.
          // Since we just added it to the blueprint, let's assume it's empty for now
          // unless we want to build a full UI for saving searches.
        } catch (e) {
          console.error("Failed to fetch preferences", e);
        }
      }

      // We need the CV content. Since we don't store the raw text in state, 
      // we'll pass a summary of the analysis result as a proxy for the CV content
      // to avoid re-parsing the PDF.
      const cvSummary = `
        ATS Score: ${result.atsScore}
        Missing Skills: ${result.missingSkills.join(', ')}
        Suggestions: ${result.suggestions.map(s => s.title).join(', ')}
      `;

      const recommendations = await getJobRecommendations(cvSummary, preferences, savedSearches);
      setJobRecommendations(recommendations || null);
    } catch (err: any) {
      console.error("Job Recommendations Error:", err);
      setRecommendationsError(err.message || "An error occurred while generating recommendations.");
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const handleRewriteCV = async () => {
    if (!result || !result.originalText) {
      setRewriteCVError("Original CV text is missing. Please re-upload your CV.");
      return;
    }
    setIsRewritingCV(true);
    setRewriteCVError(null);
    try {
      const rewritten = await rewriteCV(result.originalText, result.suggestions, result.missingSkills);
      setRewrittenCV(rewritten || null);
    } catch (err: any) {
      console.error("Rewrite CV Error:", err);
      setRewriteCVError(err.message || "An error occurred while rewriting your CV.");
    } finally {
      setIsRewritingCV(false);
    }
  };

  const handleDownloadRewrittenCV = () => {
    if (!rewrittenCV) return;
    const blob = new Blob([rewrittenCV], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Rewritten_CV.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGetMarketInsights = async (overrideRefinement?: string | React.MouseEvent) => {
    if (!result) return;
    setIsGettingInsights(true);
    setMarketInsightsError(null);
    try {
      const jd = jobDescriptions.find(jd => jd.trim().length > 0) || "";
      const query = jd
        ? `Job matching this description: ${jd.substring(0, 100)}`
        : "Tech industry jobs";
      
      const refinementToUse = typeof overrideRefinement === 'string' ? overrideRefinement : marketInsightsRefinement;
      const insights = await getMarketInsights(query, refinementToUse);
      setMarketInsights(insights || null);
    } catch (err: any) {
      console.error("Market Insights Error:", err);
      const errStr = err instanceof Error ? err.message : String(err);

      let tailoredMessage =
        "An unexpected error occurred while fetching market insights. Please try again later.";

      if (
        errStr.toLowerCase().includes("rate limit") ||
        errStr.toLowerCase().includes("quota") ||
        errStr.includes("429")
      ) {
        tailoredMessage =
          "Rate limit exceeded: Please wait a moment before requesting more market insights.";
      } else if (
        errStr.toLowerCase().includes("api key") ||
        errStr.includes("401") ||
        errStr.includes("403")
      ) {
        tailoredMessage =
          "Authentication failed: There is an issue with the AI service configuration.";
      } else if (
        errStr.toLowerCase().includes("network") ||
        errStr.toLowerCase().includes("fetch failed")
      ) {
        tailoredMessage =
          "Network error: Unable to connect to the market insights service. Please check your internet connection.";
      } else if (
        errStr.toLowerCase().includes("google search") ||
        errStr.toLowerCase().includes("grounding")
      ) {
        tailoredMessage =
          "Search error: Failed to retrieve live market data from Google Search.";
      }

      setMarketInsightsError(tailoredMessage);
    } finally {
      setIsGettingInsights(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    
    const doc = new jsPDF();
    let yPos = 20;
    const lineHeight = 7;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;

    // Helper to add text and manage pagination
    const addText = (text: string, fontSize: number, isBold: boolean = false, color: number[] = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setTextColor(color[0], color[1], color[2]);
      
      const splitText = doc.splitTextToSize(text, maxLineWidth);
      
      splitText.forEach((line: string) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin, yPos);
        yPos += lineHeight;
      });
    };

    // Title
    addText("CV Analysis Report", 22, true, [79, 70, 229]); // Indigo color
    yPos += 5;

    // Scores
    addText(`ATS Score: ${result.atsScore}/100`, 16, true);
    if (result.atsScoreBreakdown) {
      addText(`  - Keyword Matching: ${result.atsScoreBreakdown.keywordMatching}/100`, 11);
      addText(`  - Formatting: ${result.atsScoreBreakdown.formatting}/100`, 11);
      addText(`  - Achievements: ${result.atsScoreBreakdown.achievements}/100`, 11);
    }
    if (result.matchScore !== undefined) {
      addText(`Match Score: ${result.matchScore}/100`, 16, true);
    }
    yPos += 5;

    // Job Matches
    if (result.jobMatches && result.jobMatches.length > 0) {
      addText("Job Matches:", 16, true);
      yPos += 2;
      result.jobMatches.forEach(match => {
        addText(`Job Description ${match.index + 1} Match Score: ${match.matchScore}/100`, 12, true);
        if (match.matchSummary && match.matchSummary.length > 0) {
          match.matchSummary.forEach(point => {
            addText(`  - ${point}`, 10);
          });
        }
        yPos += 3;
      });
      yPos += 2;
    }

    // Missing Skills
    if (result.missingSkills && result.missingSkills.length > 0) {
      addText("Missing Skills:", 14, true);
      const skillsText = result.missingSkills.map(s => `• ${s}`).join('\n');
      addText(skillsText, 11);
      yPos += 5;
    }

    // Suggestions
    if (result.suggestions && result.suggestions.length > 0) {
      addText("Improvement Suggestions:", 16, true);
      yPos += 2;
      
      result.suggestions.forEach((suggestion, index) => {
        addText(`${index + 1}. ${suggestion.title}`, 12, true, [55, 65, 81]); // Slate 700
        addText(suggestion.description, 11);
        
        if (suggestion.items && suggestion.items.length > 0) {
          suggestion.items.forEach(item => {
            addText(`  - ${item}`, 10);
          });
        }
        
        if (suggestion.examples && suggestion.examples.length > 0) {
          suggestion.examples.forEach(ex => {
            addText(`  Original: ${ex.original}`, 10, false, [100, 116, 139]); // Slate 500
            addText(`  Improved: ${ex.improved}`, 10, false, [16, 185, 129]); // Emerald 500
          });
        }
        yPos += 3;
      });
    }

    doc.save("cv-analysis-report.pdf");
  };

  const handleGenerateHotSeat = async () => {
    if (!result) return;
    setIsGeneratingHotSeat(true);
    setHotSeatError(null);
    try {
      const context = `ATS Score: ${result.atsScore}\nMissing Skills: ${result.missingSkills.join(", ")}`;
      const jd = jobDescriptions.find(jd => jd.trim().length > 0) || "";
      const questions = await generateHotSeatQuestions(context, jd);
      setHotSeatQuestions(questions?.questions || null);
    } catch (err: any) {
      console.error(err);
      setHotSeatError(
        err.message || "An error occurred while generating hot seat questions.",
      );
    } finally {
      setIsGeneratingHotSeat(false);
    }
  };

  const handleGenerateLinkedIn = async () => {
    if (!file) {
      setLinkedInError(
        "Original CV file is required to generate a LinkedIn profile. Please upload your CV again.",
      );
      return;
    }
    setIsGeneratingLinkedIn(true);
    setLinkedInError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64String = (reader.result as string).split(",")[1];
          const mimeType = file.type || "application/pdf";
          const profile = await generateLinkedInProfile(base64String, mimeType);
          setLinkedInProfile(profile || null);
        } catch (err: any) {
          console.error(err);
          setLinkedInError(
            err.message ||
              "An error occurred while generating the LinkedIn profile.",
          );
        } finally {
          setIsGeneratingLinkedIn(false);
        }
      };
      reader.onerror = () => {
        setLinkedInError("Failed to read the CV file.");
        setIsGeneratingLinkedIn(false);
      };
    } catch (err: any) {
      console.error(err);
      setLinkedInError(err.message || "An error occurred.");
      setIsGeneratingLinkedIn(false);
    }
  };

  const handleCopyCoverLetter = () => {
    if (coverLetter) {
      navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySuggestion = (
    e: React.MouseEvent,
    text: string,
    index: number,
  ) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedSuggestion(index);
    setTimeout(() => setCopiedSuggestion(null), 2000);
  };

  const handleAskCoach = (
    e: React.MouseEvent,
    title: string,
    description: string,
  ) => {
    e.stopPropagation();
    const prompt = `Can you give me more details or specific examples about this CV improvement suggestion?\n\nSuggestion: ${title}\nDetails: ${description}`;
    chatbotRef.current?.openAndSend(prompt);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/40 blur-[100px] animate-[blob_7s_infinite]"></div>
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-purple-200/40 blur-[100px] animate-[blob_7s_infinite_2s]"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-200/30 blur-[100px] animate-[blob_7s_infinite_4s]"></div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-sm"
            >
              <FileText className="w-5 h-5 text-white" />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-3 h-3 text-yellow-300" />
              </motion.div>
            </motion.div>
            <span className="text-xl font-bold tracking-tight font-display text-slate-900">
              CVBoost AI
            </span>
          </div>
          <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium text-slate-600">
            {user && (
              <button
                onClick={() => setView("history")}
                className={cn(
                  "hover:text-indigo-600 transition-colors flex items-center gap-1 sm:gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md px-2 py-1",
                  view === "history" && "text-indigo-600",
                )}
                title="History"
                aria-label="View History"
              >
                <History className="w-4 h-4 sm:w-5 sm:h-5" />{" "}
                <span className="hidden sm:inline">History</span>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3 sm:gap-4">
                {userProfile && (
                  <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">
                      {userProfile.subscriptionTier === "pro"
                        ? "PRO"
                        : `${userProfile.credits} Credits`}
                    </span>
                    {userProfile.subscriptionTier === "free" && (
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wide"
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs sm:text-sm">
                      {user.email?.[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  onClick={logOut}
                  className="text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="bg-slate-900 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {!isAuthReady ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : !user ? (
          <LandingPage />
        ) : (
          <AnimatePresence mode="wait">
            {view === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-10"
              >
                <div className="text-center space-y-5">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-display text-slate-900 leading-tight">
                    Get more{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                      interviews
                    </span>
                    <br className="hidden sm:block" />
                    with an ATS-friendly CV.
                  </h1>
                  <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed px-2">
                    Upload your resume and let our AI analyze it against
                    industry standards or a specific job description to boost
                    your chances.
                  </p>
                </div>

                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white overflow-hidden">
                  <div className="p-5 sm:p-10 space-y-6 sm:space-y-8">
                    {/* Upload Section */}
                    <div className="space-y-3">
                      <label
                        id="cv-upload-label"
                        className="block text-sm font-medium text-slate-700"
                      >
                        1. Upload your CV (PDF only)
                      </label>
                      <div
                        {...getRootProps()}
                        aria-labelledby="cv-upload-label"
                        className={cn(
                          "border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-200 relative overflow-hidden group focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2",
                          isDragAccept && "border-emerald-500 bg-emerald-50 scale-[1.02]",
                          isDragReject && "border-red-500 bg-red-50 scale-[1.02]",
                          isDragActive && !isDragAccept && !isDragReject && "border-indigo-500 bg-indigo-50 scale-[1.02]",
                          !isDragActive && "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50",
                          file &&
                            !isDragActive &&
                            "border-emerald-500 bg-emerald-50/80",
                          isAnalyzing && "pointer-events-none opacity-80",
                        )}
                      >
                        <input {...getInputProps()} disabled={isAnalyzing} />
                        {file ? (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex flex-col items-center gap-3 text-emerald-700 relative z-10"
                          >
                            <div className="relative">
                              <div className="bg-emerald-100 p-4 rounded-full relative overflow-hidden">
                                <FileText className="w-10 h-10" />
                                {isAnalyzing && (
                                  <motion.div
                                    animate={{ top: ["-20%", "120%"] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 1.5,
                                      ease: "linear",
                                    }}
                                    className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)] z-20"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg truncate max-w-[200px] sm:max-w-[300px]">
                                {file.name}
                              </span>
                              {!isAnalyzing && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                  }}
                                  className="p-1 hover:bg-emerald-200/50 rounded-full transition-colors text-emerald-600 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  title="Remove file"
                                  aria-label="Remove uploaded CV"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                            <span className="text-sm font-medium opacity-80 bg-emerald-200/50 px-3 py-1 rounded-full">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            {isAnalyzing && (
                              <div className="w-full max-w-xs h-2 bg-emerald-200 rounded-full mt-2 overflow-hidden">
                                <motion.div 
                                  className="h-full bg-emerald-600"
                                  initial={{ width: "0%" }}
                                  animate={{ width: "90%" }}
                                  transition={{ duration: 10, ease: "easeOut" }}
                                />
                              </div>
                            )}
                          </motion.div>
                        ) : (
                          <div className="flex flex-col items-center gap-4 text-slate-500 relative z-10">
                            <div
                              className={cn(
                                "p-4 rounded-full shadow-sm border transition-all duration-300",
                                isDragAccept && "bg-emerald-100 border-emerald-200 text-emerald-600 scale-110",
                                isDragReject && "bg-red-100 border-red-200 text-red-600 scale-110 animate-shake",
                                isDragActive && !isDragAccept && !isDragReject && "bg-indigo-100 border-indigo-200 scale-110 animate-bounce",
                                !isDragActive && "bg-white border-slate-100 group-hover:scale-110 group-hover:shadow-md",
                              )}
                            >
                              <Upload
                                className={cn(
                                  "w-8 h-8 transition-colors",
                                  isDragAccept ? "text-emerald-600" : isDragReject ? "text-red-600" : isDragActive ? "text-indigo-600" : "text-indigo-500",
                                )}
                              />
                            </div>
                            <div>
                              <p
                                className={cn(
                                  "font-semibold text-lg transition-colors",
                                  isDragAccept ? "text-emerald-700" : isDragReject ? "text-red-700" : isDragActive ? "text-indigo-700" : "text-slate-700",
                                )}
                              >
                                {isDragAccept
                                  ? "Drop your CV here!"
                                  : isDragReject 
                                  ? "Invalid file type or size"
                                  : "Click to upload or drag and drop"}
                              </p>
                              <p className="text-sm mt-1">PDF (max. 5MB)</p>
                              <p className="text-xs mt-2 text-slate-400">You can drop multiple files, but only the first will be processed.</p>
                            </div>
                          </div>
                        )}

                        {/* Drag active overlay */}
                        <AnimatePresence>
                          {isDragActive && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className={cn(
                                "absolute inset-0 backdrop-blur-[2px] z-0 border-4 border-dashed rounded-2xl",
                                isDragAccept ? "bg-emerald-500/10 border-emerald-400" : isDragReject ? "bg-red-500/10 border-red-400" : "bg-indigo-500/10 border-indigo-400"
                              )}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Job Descriptions Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700">
                          2. Paste Job Descriptions (Optional)
                        </label>
                        <button
                          onClick={() => setJobDescriptions([...jobDescriptions, ""])}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                        >
                          + Add Another JD
                        </button>
                      </div>
                      <div className="space-y-3">
                        {jobDescriptions.map((jd, index) => (
                          <div key={index} className="relative">
                            <textarea
                              value={jd}
                              onChange={(e) => {
                                const newJds = [...jobDescriptions];
                                newJds[index] = e.target.value;
                                setJobDescriptions(newJds);
                              }}
                              placeholder={`Paste job description ${index + 1} here...`}
                              className="w-full h-32 px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-shadow pr-10"
                            />
                            {jobDescriptions.length > 1 && (
                              <button
                                onClick={() => {
                                  const newJds = jobDescriptions.filter((_, i) => i !== index);
                                  setJobDescriptions(newJds);
                                }}
                                className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remove job description"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p>{error}</p>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={handleAnalyze}
                      disabled={!file || isAnalyzing}
                      aria-busy={isAnalyzing}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 relative overflow-hidden"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{ANALYSIS_STEPS[analysisStep]}</span>
                          </div>
                          <div className="w-full max-w-xs h-1.5 bg-indigo-800/50 rounded-full overflow-hidden mt-1">
                            <motion.div 
                              className="h-full bg-white"
                              initial={{ width: "0%" }}
                              animate={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          Analyze My CV
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {view === "results" && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-10"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display tracking-tight">
                      Analysis Results
                    </h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-base sm:text-lg">
                      Here's how your CV performs.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleDownloadPDF}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 hover:border-indigo-200 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                    {user && (
                      <button
                        onClick={() => setView("history")}
                        className="flex-1 sm:flex-none text-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        History
                      </button>
                    )}
                    <button
                      onClick={reset}
                      className="flex-1 sm:flex-none text-center text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                    >
                      New CV
                    </button>
                  </div>
                </div>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  {/* Score Cards */}
                  <motion.div
                    variants={itemVariants}
                    className="md:col-span-1 space-y-6"
                  >
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex items-center justify-center gap-2 mb-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                          ATS Score
                        </h3>
                        <button
                          onClick={() => setShowAtsModal(true)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
                          title="What is an ATS Score?"
                          aria-label="Learn more about ATS Score"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>

                      <div 
                        className="cursor-pointer hover:scale-105 transition-transform duration-200 relative group/score"
                        onClick={() => setShowAtsModal(true)}
                        title="Click for detailed ATS score breakdown"
                      >
                        <CircularProgress value={result.atsScore} />
                        <div className="absolute inset-0 rounded-full bg-slate-900/5 opacity-0 group-hover/score:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        </div>
                      </div>

                      <p className="mt-6 text-sm font-medium text-slate-600 leading-relaxed">
                        {result.atsScore >= 80
                          ? "Excellent! Your CV is highly ATS-friendly."
                          : result.atsScore >= 60
                            ? "Good, but needs some improvements."
                            : "Needs significant formatting and keyword updates."}
                      </p>
                      
                      {result.atsScoreBreakdown && (
                        <div className="mt-6 w-full space-y-3 text-left">
                          <div className="flex flex-col gap-1 group/item relative">
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                              <span className="flex items-center gap-1 cursor-help">
                                Keywords
                                <Info className="w-3 h-3 text-slate-400" />
                              </span>
                              <span>{result.atsScoreBreakdown.keywordMatching}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${result.atsScoreBreakdown.keywordMatching}%` }}></div>
                            </div>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/item:block w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-10 border border-slate-700">
                              <p className="font-semibold mb-1 text-indigo-300">Keyword Matching</p>
                              <p className="mb-2 text-slate-300">Measures how well your CV matches standard industry keywords or the provided job description.</p>
                              <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                <span className="text-slate-400 font-medium">Example:</span> If the JD asks for "React.js", writing "React" might not be enough for older ATS systems.
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 group/item relative">
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                              <span className="flex items-center gap-1 cursor-help">
                                Formatting
                                <Info className="w-3 h-3 text-slate-400" />
                              </span>
                              <span>{result.atsScoreBreakdown.formatting}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${result.atsScoreBreakdown.formatting}%` }}></div>
                            </div>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/item:block w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-10 border border-slate-700">
                              <p className="font-semibold mb-1 text-emerald-300">Formatting & Readability</p>
                              <p className="mb-2 text-slate-300">Evaluates readability, structure, and absence of complex layouts that confuse ATS parsers.</p>
                              <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                <span className="text-slate-400 font-medium">Tip:</span> Avoid multi-column layouts, tables, images, and non-standard fonts. Stick to a clean, single-column design.
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 group/item relative">
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                              <span className="flex items-center gap-1 cursor-help">
                                Achievements
                                <Info className="w-3 h-3 text-slate-400" />
                              </span>
                              <span>{result.atsScoreBreakdown.achievements}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${result.atsScoreBreakdown.achievements}%` }}></div>
                            </div>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/item:block w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-10 border border-slate-700">
                              <p className="font-semibold mb-1 text-amber-300">Quantified Achievements</p>
                              <p className="mb-2 text-slate-300">Rewards quantified impact over generic responsibilities. ATS systems look for numbers and metrics.</p>
                              <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                <span className="text-slate-400 font-medium">Example:</span> Instead of "Managed a team", use "Managed a team of 5, increasing productivity by 20%".
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {jobDescriptions.some(jd => jd.trim().length > 0) && result.jobMatches && result.jobMatches.length > 0 && (
                      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">
                          Job Matches
                        </h3>

                        <div className="w-full space-y-8">
                          {result.jobMatches.map((match, idx) => (
                            <div key={idx} className="flex flex-col items-center border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                              <h4 className="text-sm font-semibold text-slate-700 mb-4">Job Description {match.index + 1}</h4>
                              <CircularProgress value={match.matchScore} />
                              
                              {match.matchSummary && match.matchSummary.length > 0 && (
                                <div className="mt-6 text-left w-full bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-indigo-500" />
                                    Why it matches:
                                  </h4>
                                  <ul className="space-y-3">
                                    {match.matchSummary.map((point, i) => (
                                      <li key={i} className="text-sm text-slate-600 flex items-start gap-2 leading-relaxed">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></div>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Details */}
                  <motion.div
                    variants={itemVariants}
                    className="md:col-span-2 space-y-6"
                  >
                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-600 shadow-sm">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 font-display">
                          Missing Skills & Keywords
                        </h3>
                      </div>
                      {result.missingSkills.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {result.missingSkills.map((skill, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                              <span>{skill}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500 italic">
                          No major missing skills identified.
                        </p>
                      )}
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 shadow-sm">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 font-display">
                          Improvement Suggestions
                        </h3>
                      </div>
                      {result.suggestions.length > 0 ? (
                        <motion.ul
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                          className="space-y-4"
                        >
                          {result.suggestions.map((suggestion, i) => {
                            const isExpanded = expandedSuggestion === i;

                            return (
                              <motion.li
                                key={i}
                                variants={itemVariants}
                                className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:border-emerald-200 transition-colors"
                              >
                                <button
                                  onClick={() =>
                                    setExpandedSuggestion(isExpanded ? null : i)
                                  }
                                  aria-expanded={isExpanded}
                                  aria-controls={`suggestion-content-${i}`}
                                  className="w-full flex items-center gap-4 p-5 text-left transition-colors hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-slate-50"
                                >
                                  <div className="bg-emerald-100 text-emerald-700 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold shadow-sm">
                                    {i + 1}
                                  </div>
                                  <div className="flex-1 flex items-center justify-between">
                                    <h4 className="font-semibold text-slate-900 text-lg pr-4">
                                      {suggestion.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <div
                                        onClick={(e) =>
                                          handleCopySuggestion(
                                            e,
                                            suggestion.description,
                                            i,
                                          )
                                        }
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            handleCopySuggestion(
                                              e as any,
                                              suggestion.description,
                                              i,
                                            );
                                          }
                                        }}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        title="Copy description"
                                        aria-label="Copy suggestion description"
                                      >
                                        {copiedSuggestion === i ? (
                                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-5 h-5" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronDown
                                    className={cn(
                                      "w-5 h-5 text-slate-500 transition-transform shrink-0",
                                      isExpanded && "rotate-180",
                                    )}
                                  />
                                </button>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      id={`suggestion-content-${i}`}
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                                        <p className="text-slate-600 text-sm leading-relaxed">
                                          {suggestion.description}
                                        </p>

                                        <div className="mt-4 flex justify-end">
                                          <button
                                            onClick={(e) =>
                                              handleAskCoach(
                                                e,
                                                suggestion.title,
                                                suggestion.description,
                                              )
                                            }
                                            className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          >
                                            <MessageSquare className="w-4 h-4" />
                                            Ask Coach for Details
                                          </button>
                                        </div>

                                        {suggestion.type === "summary" &&
                                          suggestion.items &&
                                          suggestion.items.length > 0 && (
                                            <div className="mt-5">
                                              <h5 className="font-medium text-sm text-indigo-900 mb-3 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" />{" "}
                                                AI-Generated Summaries
                                              </h5>
                                              <div className="space-y-3">
                                                {suggestion.items.map(
                                                  (item, j) => (
                                                    <div
                                                      key={j}
                                                      className="p-4 bg-white rounded-xl border border-indigo-100 text-sm text-slate-700 shadow-sm leading-relaxed"
                                                    >
                                                      {item}
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}

                                        {suggestion.type === "achievements" &&
                                          suggestion.examples &&
                                          suggestion.examples.length > 0 && (
                                            <div className="mt-5">
                                              <h5 className="font-medium text-sm text-indigo-900 mb-3 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" />{" "}
                                                Measurable Examples
                                              </h5>
                                              <div className="space-y-3">
                                                {suggestion.examples.map(
                                                  (ex, j) => (
                                                    <div
                                                      key={j}
                                                      className="p-4 bg-white rounded-xl border border-indigo-100 text-sm shadow-sm"
                                                    >
                                                      <div className="text-rose-600 mb-3 pb-3 border-b border-slate-100">
                                                        <span className="font-semibold text-rose-700">
                                                          Before:
                                                        </span>{" "}
                                                        {ex.original}
                                                      </div>
                                                      <div className="text-emerald-700">
                                                        <span className="font-semibold text-emerald-800">
                                                          After:
                                                        </span>{" "}
                                                        {ex.improved}
                                                      </div>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.li>
                            );
                          })}
                        </motion.ul>
                      ) : (
                        <p className="text-slate-500 italic">
                          Your CV looks great! No major suggestions.
                        </p>
                      )}
                    </div>
                  </motion.div>

                  {/* AI Tools */}
                  <motion.div
                    variants={itemVariants}
                    className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2"
                  >
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 font-display">
                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 shadow-sm">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        Auto-Rewrite CV
                      </h3>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Let AI automatically rewrite your CV to incorporate all the suggested improvements and missing skills.
                      </p>
                      {rewriteCVError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{rewriteCVError}</p>
                        </div>
                      )}
                      {isRewritingCV ? (
                        <div className="w-full bg-emerald-50/50 border border-emerald-100 py-6 rounded-xl flex flex-col items-center justify-center">
                          <GranularLoader
                            messages={[
                              "Analyzing original CV...",
                              "Integrating missing skills...",
                              "Enhancing bullet points...",
                              "Formatting for ATS...",
                              "Finalizing rewrite...",
                            ]}
                            colorClass="text-emerald-700"
                            spinnerColorClass="text-emerald-600"
                          />
                        </div>
                      ) : rewrittenCV ? (
                        <div className="mt-4 flex flex-col gap-2">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 prose prose-sm max-w-none max-h-60 overflow-y-auto">
                            <Markdown>{rewrittenCV}</Markdown>
                          </div>
                          <div className="flex justify-end gap-3 mt-1">
                            <button
                              onClick={handleDownloadRewrittenCV}
                              className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-1"
                              aria-label="Download rewritten CV"
                            >
                              <Download className="w-4 h-4" />
                              Download TXT
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(rewrittenCV);
                                setCopiedRewrite(true);
                                setTimeout(() => setCopiedRewrite(false), 2000);
                              }}
                              className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-1"
                              aria-label="Copy rewritten CV"
                            >
                              {copiedRewrite ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                              {copiedRewrite ? "Copied!" : "Copy to Clipboard"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleRewriteCV}
                          disabled={isRewritingCV}
                          className="w-full bg-emerald-50 text-emerald-700 py-2.5 rounded-xl font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          Rewrite Now
                        </button>
                      )}
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 font-display">
                        <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 shadow-sm">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        Generate Cover Letter
                      </h3>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Get a fast, AI-generated cover letter tailored to your
                        CV and the job description.
                      </p>
                      {coverLetterError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{coverLetterError}</p>
                        </div>
                      )}
                      {isGeneratingCoverLetter ? (
                        <div className="w-full bg-indigo-50/50 border border-indigo-100 py-6 rounded-xl flex flex-col items-center justify-center">
                          <GranularLoader
                            messages={[
                              "Analyzing CV context...",
                              "Reviewing job description...",
                              "Drafting professional introduction...",
                              "Highlighting key achievements...",
                              "Refining tone and formatting...",
                            ]}
                            colorClass="text-indigo-700"
                            spinnerColorClass="text-indigo-600"
                          />
                        </div>
                      ) : coverLetter ? (
                        <div className="mt-4 flex flex-col gap-2">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 prose prose-sm max-w-none max-h-60 overflow-y-auto">
                            <Markdown>{coverLetter}</Markdown>
                          </div>
                          <button
                            onClick={handleCopyCoverLetter}
                            className="self-end flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
                            aria-label="Copy cover letter"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            {copied ? "Copied!" : "Copy to Clipboard"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleGenerateCoverLetter}
                          disabled={isGeneratingCoverLetter}
                          className="w-full bg-indigo-50 text-indigo-700 py-2.5 rounded-xl font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          Generate Now
                        </button>
                      )}
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 font-display">
                        <div className="bg-purple-100 p-2 rounded-xl text-purple-600 shadow-sm">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        Market Insights
                      </h3>
                      <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                        Get real-time job market trends and salary info using AI analysis.
                      </p>

                      <div className="mb-4 flex gap-2">
                        <input
                          type="text"
                          placeholder="Refine query (e.g., 'in London', 'Remote only')"
                          value={marketInsightsRefinement}
                          onChange={(e) =>
                            setMarketInsightsRefinement(e.target.value)
                          }
                          className="w-full p-2.5 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-purple-50/30 placeholder:text-purple-300 transition-all"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isGettingInsights) {
                              handleGetMarketInsights();
                            }
                          }}
                        />
                        {marketInsights && (
                          <button
                            onClick={() => {
                              setMarketInsightsRefinement("");
                              handleGetMarketInsights("");
                            }}
                            disabled={isGettingInsights}
                            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Clear refinement and reset insights"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {marketInsightsError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{marketInsightsError}</p>
                        </div>
                      )}
                      {isGettingInsights ? (
                        <div className="w-full bg-purple-50/50 border border-purple-100 py-6 rounded-xl flex flex-col items-center justify-center">
                          <GranularLoader
                            messages={[
                              "Connecting to Google Search...",
                              "Querying live market data...",
                              "Analyzing salary trends...",
                              "Identifying key industry skills...",
                              "Synthesizing insights...",
                            ]}
                            colorClass="text-purple-700"
                            spinnerColorClass="text-purple-600"
                          />
                        </div>
                      ) : marketInsights ? (
                        <div className="mt-4 flex flex-col gap-4">
                          <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <h4 className="font-semibold text-slate-900 mb-1">
                              General Outlook
                            </h4>
                            <p className="text-sm text-slate-700">
                              {marketInsights.generalOutlook}
                            </p>
                          </div>
                          <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <h4 className="font-semibold text-slate-900 mb-1">
                              Salary Trends
                            </h4>
                            <p className="text-sm text-slate-700">
                              {marketInsights.salaryTrends}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                              <h4 className="font-semibold text-slate-900 mb-2">
                                In-Demand Skills
                              </h4>
                              <ul className="list-disc pl-4 text-sm text-slate-700 space-y-1">
                                {marketInsights.inDemandSkills?.map(
                                  (skill, i) => (
                                    <li key={i}>{skill}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                              <h4 className="font-semibold text-slate-900 mb-2">
                                Top Companies
                              </h4>
                              <ul className="list-disc pl-4 text-sm text-slate-700 space-y-1">
                                {marketInsights.topCompanies?.map(
                                  (company, i) => (
                                    <li key={i}>{company}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          </div>

                          {marketInsights.groundingChunks &&
                            marketInsights.groundingChunks.length > 0 && (
                              <div className="mt-2 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  Sources
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {marketInsights.groundingChunks.map(
                                    (chunk: any, idx: number) => {
                                      if (chunk.web?.uri && chunk.web?.title) {
                                        return (
                                          <a
                                            key={idx}
                                            href={chunk.web.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded truncate max-w-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            title={chunk.web.title}
                                            aria-label={`Source: ${chunk.web.title}`}
                                          >
                                            {chunk.web.title}
                                          </a>
                                        );
                                      }
                                      return null;
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                          <button
                            onClick={handleGetMarketInsights}
                            disabled={isGettingInsights}
                            className="w-full mt-2 bg-purple-50 text-purple-700 py-2.5 rounded-xl font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            Refresh Insights
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleGetMarketInsights}
                          disabled={isGettingInsights}
                          className="w-full bg-purple-50 text-purple-700 py-2.5 rounded-xl font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          Get Insights
                        </button>
                      )}
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group sm:col-span-2">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 font-display">
                        <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shadow-sm">
                          <Flame className="w-5 h-5" />
                        </div>
                        The Hot Seat: Interview Predictor
                      </h3>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        We found the weak spots in your CV. Here are the 3
                        toughest questions a recruiter will ask you about them,
                        and how to defend yourself.
                      </p>

                      {hotSeatError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{hotSeatError}</p>
                        </div>
                      )}

                      {isGeneratingHotSeat ? (
                        <div className="w-full bg-orange-50/50 border border-orange-100 py-8 rounded-xl flex flex-col items-center justify-center">
                          <GranularLoader
                            messages={[
                              "Scanning CV for weaknesses...",
                              "Identifying experience gaps...",
                              "Formulating tough questions...",
                              "Developing defense strategies...",
                              "Finalizing interview prep...",
                            ]}
                            colorClass="text-orange-700"
                            spinnerColorClass="text-orange-600"
                            spinnerSize="w-8 h-8"
                          />
                        </div>
                      ) : hotSeatQuestions ? (
                        <div className="space-y-6 mt-4">
                          {hotSeatQuestions.map((q, idx) => (
                            <div
                              key={idx}
                              className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="bg-orange-100 text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                                  {idx + 1}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-slate-900 text-base">
                                    {q.question}
                                  </h4>
                                  <p className="text-xs font-medium text-orange-600 mt-1 uppercase tracking-wider">
                                    Targeting: {q.weakness}
                                  </p>
                                </div>
                              </div>
                              <div className="ml-9 p-4 bg-white rounded-xl border border-orange-100 text-sm text-slate-700 shadow-sm">
                                <span className="font-semibold text-emerald-600 block mb-1">
                                  Defense Strategy:
                                </span>
                                {q.defenseStrategy}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={handleGenerateHotSeat}
                          disabled={isGeneratingHotSeat}
                          className="w-full bg-orange-50 text-orange-700 py-3 rounded-xl font-semibold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <Flame className="w-5 h-5" />
                          Enter The Hot Seat
                        </button>
                      )}
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group sm:col-span-2">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 font-display">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600 shadow-sm">
                          <Linkedin className="w-5 h-5" />
                        </div>
                        LinkedIn Profile Optimizer
                      </h3>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Let AI rewrite your LinkedIn Headline and About section
                        based on your CV to attract more recruiters.
                      </p>

                      {linkedInError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{linkedInError}</p>
                        </div>
                      )}

                      {isGeneratingLinkedIn ? (
                        <div className="w-full bg-blue-50/50 border border-blue-100 py-8 rounded-xl flex flex-col items-center justify-center">
                          <GranularLoader
                            messages={[
                              "Extracting career highlights...",
                              "Drafting catchy headline...",
                              "Writing engaging about section...",
                              "Optimizing for search...",
                              "Finalizing profile...",
                            ]}
                            colorClass="text-blue-700"
                            spinnerColorClass="text-blue-600"
                            spinnerSize="w-8 h-8"
                          />
                        </div>
                      ) : linkedInProfile ? (
                        <div className="space-y-6 mt-4">
                          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <h4 className="font-semibold text-slate-900 text-base mb-2">
                              Headline
                            </h4>
                            <div className="p-4 bg-white rounded-xl border border-blue-100 text-sm text-slate-700 shadow-sm">
                              {linkedInProfile.headline}
                            </div>
                          </div>
                          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <h4 className="font-semibold text-slate-900 text-base mb-2">
                              About Section
                            </h4>
                            <div className="p-4 bg-white rounded-xl border border-blue-100 text-sm text-slate-700 shadow-sm whitespace-pre-wrap">
                              {linkedInProfile.about}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={handleGenerateLinkedIn}
                            disabled={isGeneratingLinkedIn || !file}
                            className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!file ? "Original CV file is required" : ""}
                          >
                            <Linkedin className="w-5 h-5" />
                            Generate LinkedIn Profile
                          </button>
                          {!file && (
                            <p className="text-xs text-slate-500 text-center">
                              Original CV file is required. Please upload your
                              CV again to use this feature.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group sm:col-span-2">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 font-display">
                        <div className="bg-teal-100 p-2 rounded-xl text-teal-600 shadow-sm">
                          <Target className="w-5 h-5" />
                        </div>
                        Job Recommendations
                      </h3>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Get personalized job recommendations based on your CV analysis and profile preferences.
                      </p>

                      {recommendationsError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>{recommendationsError}</p>
                        </div>
                      )}

                      {isGeneratingRecommendations ? (
                        <div className="w-full bg-teal-50/50 border border-teal-100 py-8 rounded-xl flex flex-col items-center justify-center">
                          <GranularLoader
                            messages={[
                              "Analyzing CV profile...",
                              "Matching with industry roles...",
                              "Filtering by preferences...",
                              "Evaluating fit and match scores...",
                              "Finalizing recommendations...",
                            ]}
                            colorClass="text-teal-700"
                            spinnerColorClass="text-teal-600"
                            spinnerSize="w-8 h-8"
                          />
                        </div>
                      ) : jobRecommendations ? (
                        <div className="space-y-4 mt-4">
                          {jobRecommendations.map((job, idx) => (
                            <div key={idx} className="p-5 bg-teal-50/50 rounded-2xl border border-teal-100">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-semibold text-slate-900 text-lg">{job.title}</h4>
                                  <p className="text-sm font-medium text-teal-700">{job.company} • {job.location}</p>
                                </div>
                                <div className="bg-white px-3 py-1 rounded-full border border-teal-200 text-sm font-bold text-teal-700 shadow-sm">
                                  {job.matchScore}% Match
                                </div>
                              </div>
                              <div className="mt-3 p-4 bg-white rounded-xl border border-teal-100 text-sm text-slate-700 shadow-sm">
                                <span className="font-semibold text-slate-900 block mb-1">Why it matches:</span>
                                {job.whyItMatches}
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-medium">Search query:</span>
                                <code className="bg-slate-100 px-2 py-1 rounded text-slate-700">{job.searchQuery}</code>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={handleGetJobRecommendations}
                            className="w-full mt-2 bg-slate-50 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                          >
                            Refresh Recommendations
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={handleGetJobRecommendations}
                            disabled={isGeneratingRecommendations || !file}
                            className="w-full bg-teal-50 text-teal-700 py-3 rounded-xl font-semibold hover:bg-teal-100 transition-colors flex items-center justify-center gap-2 border border-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!file ? "Original CV file is required" : ""}
                          >
                            <Target className="w-5 h-5" />
                            Get Job Recommendations
                          </button>
                          {!file && (
                            <p className="text-xs text-slate-500 text-center">
                              Original CV file is required. Please upload your CV again to use this feature.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {view === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display tracking-tight">
                      Your History
                    </h2>
                    <p className="text-slate-500 mt-1 sm:mt-2 text-base sm:text-lg">
                      Past CV analyses saved to your account.
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    className="w-full sm:w-auto justify-center text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-full shadow-sm hover:shadow transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                  >
                    <Upload className="w-4 h-4" /> New Analysis
                  </button>
                </div>

                {history.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <History className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      No history yet
                    </h3>
                    <p className="text-slate-500 max-w-sm mx-auto">
                      Upload a CV to get started. Your analysis results will be
                      automatically saved here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300 group-hover:from-indigo-400 group-hover:to-indigo-600 transition-all"></div>
                        <div className="flex justify-between items-start mb-6 mt-2">
                          <div className="flex items-center gap-4">
                            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 shadow-sm">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <h4
                                className="font-bold text-slate-900 truncate max-w-[150px] text-lg font-display"
                                title={item.fileName}
                              >
                                {item.fileName}
                              </h4>
                              <p className="text-sm text-slate-500 font-medium">
                                {item.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold shadow-sm",
                                item.atsScore >= 80
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.atsScore >= 60
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700",
                              )}
                            >
                              ATS: {item.atsScore}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          {item.atsScoreBreakdown && (
                            <div className="mb-4 space-y-2">
                              <div className="text-xs text-slate-500 font-medium mb-1">Score Breakdown</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500" style={{ width: `${item.atsScoreBreakdown.keywordMatching}%` }} title={`Keywords: ${item.atsScoreBreakdown.keywordMatching}%`} />
                                </div>
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${item.atsScoreBreakdown.formatting}%` }} title={`Formatting: ${item.atsScoreBreakdown.formatting}%`} />
                                </div>
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500" style={{ width: `${item.atsScoreBreakdown.achievements}%` }} title={`Achievements: ${item.atsScoreBreakdown.achievements}%`} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="text-sm text-slate-600 flex justify-between items-center">
                            <span className="font-medium">Missing Skills</span>
                            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">
                              {item.missingSkills.length}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600 flex justify-between items-center">
                            <span className="font-medium">Suggestions</span>
                            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">
                              {item.suggestions.length}
                            </span>
                          </div>
                          {item.matchScore !== undefined &&
                            item.matchScore !== null && (
                              <div className="text-sm text-slate-600 flex justify-between items-center">
                                <span className="font-medium">Job Match</span>
                                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">
                                  {item.matchScore}%
                                </span>
                              </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => viewHistoryItem(item)}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                            aria-label={`View details for ${item.fileName}`}
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(item.id)}
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                            title="Delete"
                            aria-label={`Delete ${item.fileName} from history`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* ATS Info Modal */}
      <AnimatePresence>
        {showAtsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowAtsModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ats-modal-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-bold text-slate-900 font-display"
                    id="ats-modal-title"
                  >
                    What is an ATS Score?
                  </h3>
                </div>
                <button
                  onClick={() => setShowAtsModal(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                <p>
                  An <strong>Applicant Tracking System (ATS)</strong> is
                  software used by employers to scan, sort, and rank job
                  applications before human recruiters even look at them.
                </p>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 my-4">
                  <p className="font-medium text-slate-900 mb-4">
                    Your <strong>ATS Score</strong> represents how well your CV
                    is optimized for these systems. It is calculated based on three key pillars:
                  </p>
                  <ul className="space-y-5">
                    <li className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-semibold text-indigo-700">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        Keyword Matching
                      </div>
                      <p className="text-slate-600 ml-4">
                        Presence of relevant skills, tools, and job titles. ATS parsers look for exact matches to the job description.
                      </p>
                      <div className="ml-4 mt-1 bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Example:</span> If the job asks for "React.js", writing "React" might not be enough for older ATS systems.
                      </div>
                    </li>
                    <li className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-semibold text-emerald-700">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        Formatting & Readability
                      </div>
                      <p className="text-slate-600 ml-4">
                        Use of standard headings (Experience, Education) and avoiding complex layouts that confuse the parser.
                      </p>
                      <div className="ml-4 mt-1 bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Tip:</span> Avoid multi-column layouts, tables, images, and non-standard fonts. Stick to a clean, single-column design.
                      </div>
                    </li>
                    <li className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-semibold text-amber-700">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        Quantified Achievements
                      </div>
                      <p className="text-slate-600 ml-4">
                        Clear dates, measurable impact, and a professional summary. ATS systems often reward numbers and metrics.
                      </p>
                      <div className="ml-4 mt-1 bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Example:</span> Instead of "Managed a team", use "Managed a team of 5 engineers, increasing productivity by 20%".
                      </div>
                    </li>
                  </ul>
                </div>
                <p className="pt-2 font-medium text-indigo-700 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                  A score above 80 means your CV is highly likely to pass the
                  automated screening and reach a human recruiter.
                </p>
              </div>
              <button
                onClick={() => setShowAtsModal(false)}
                className="mt-8 w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                Got it, thanks!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowUpgradeModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                    Upgrade to Pro
                  </h3>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                <p>
                  Unlock the full power of CVBoost AI with a Pro subscription.
                </p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 my-4">
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium text-slate-900">
                        Unlimited CV Scans
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium text-slate-900">
                        Unlimited Cover Letters
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium text-slate-900">
                        Unlimited LinkedIn Profiles
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium text-slate-900">
                        Priority AI Processing
                      </span>
                    </li>
                  </ul>
                </div>
                
                {checkoutError && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{checkoutError}</p>
                  </div>
                )}
                
                {checkoutSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{checkoutSuccess}</p>
                  </div>
                )}

                <p className="text-center text-slate-500 text-xs mt-4">
                  *This is a demonstration of the monetization flow. In a real
                  app, this would redirect to JazzCash Checkout.
                </p>
              </div>
              <button
                onClick={handleJazzCashCheckout}
                disabled={!!checkoutSuccess}
                className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upgrade Now - 999 PKR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chatbot */}
      {user && (
        <Chatbot
          ref={chatbotRef}
          cvContext={
            result
              ? JSON.stringify({
                  atsScore: result.atsScore,
                  missingSkills: result.missingSkills,
                })
              : undefined
          }
        />
      )}
    </div>
  );
}
