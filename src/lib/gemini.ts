/// <reference types="vite/client" />
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { extractTextFromPDF } from "./pdf";

// We use import.meta.env for Vite client-side env vars
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error(`API Key is missing or invalid: ${apiKey}`);
  }
  return new GoogleGenAI({ apiKey });
}

export interface Suggestion {
  title: string;
  description: string;
  type: 'general' | 'summary' | 'achievements';
  items?: string[];
  examples?: { original: string; improved: string }[];
}

export interface JobMatch {
  index: number;
  matchScore: number;
  matchSummary: string[];
}

export interface SectionFeedback {
  section: string;
  score: number;
  feedback: string;
  suggestions: string[];
}

export interface AnalysisResult {
  atsScore: number;
  atsScoreBreakdown?: {
    keywordMatching: number; // out of 100
    formatting: number; // out of 100
    achievements: number; // out of 100
    keywordFeedback?: string;
    keywordSuggestions?: string[];
    formattingFeedback?: string;
    formattingSuggestions?: string[];
    achievementsFeedback?: string;
    achievementsSuggestions?: string[];
  };
  sectionFeedback?: SectionFeedback[];
  missingSkills: string[];
  suggestions: Suggestion[];
  matchScore?: number;
  matchSummary?: string[];
  jobMatches?: JobMatch[];
  jobDescriptions?: string[];
  originalText?: string;
}

export function handleGeminiError(error: any): never {
  console.error("Gemini API Error:", error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("rate limit") || errorMessage.toLowerCase().includes("too many requests")) {
    throw new Error("You've reached the rate limit for the AI service. Please wait a moment and try again.");
  }
  if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.toLowerCase().includes("api key") || errorMessage.includes("API_KEY_INVALID")) {
    console.error("Original API Key Error:", errorMessage);
    throw new Error(`AI Service Error: ${errorMessage}`);
  }
  if (errorMessage.toLowerCase().includes("fetch failed") || errorMessage.toLowerCase().includes("network")) {
    throw new Error("Network error. Please check your internet connection and try again.");
  }
  
  throw new Error(`An unexpected error occurred: ${errorMessage}`);
}

export async function analyzeCV(fileBase64: string, mimeType: string, jobDescriptions: string[] = []): Promise<AnalysisResult> {
  let cvContent = "";
  if (mimeType === "application/pdf") {
    try {
      cvContent = await extractTextFromPDF(fileBase64);
    } catch (e) {
      console.warn("PDF extraction failed, falling back to Gemini native PDF parsing", e);
    }
  }

  const safeJobDescs = jobDescriptions.map(jd => jd.substring(0, 5000)).filter(jd => jd.trim().length > 0);
  let jdContext = "";
  if (safeJobDescs.length > 0) {
    jdContext = `4. Match Scores (0-100) based on the provided Job Description(s). To calculate this authentically:
       - Perform a strict, nuanced comparison for EACH job description.
       - Evaluate the depth of experience. Just mentioning a keyword is not enough; it must be tied to an achievement.
       - Penalize missing mandatory requirements from the JD.
       - Provide a concise matchSummary (array of strings) of why the CV matches or doesn't match the job description, using bullet points derived from the analysis.
       - Provide a 'jobMatches' array in the JSON response, where each object contains the 'index' (0-based, corresponding to the job descriptions provided), a 'matchScore' (0-100), and a 'matchSummary' (array of strings).
       
       Job Descriptions:
${safeJobDescs.map((jd, idx) => `--- Job Description ${idx} ---\n${jd}\n`).join('\n')}`;
  }

  const prompt = `
    Analyze this CV with absolute strictness and 100% authenticity. You are an expert ATS (Applicant Tracking System) and senior technical recruiter.
    
    1. ATS score (0-100): Calculate this realistically based strictly on the following three components (which you must also provide in the atsScoreBreakdown):
       - Keyword Matching (0-100): Overlap with the job description (if provided) or standard industry roles. Provide tailored 'keywordFeedback' and 1-2 'keywordSuggestions'.
       - Formatting (0-100): Readability, clear sections, absence of complex layouts that confuse parsers. Provide tailored 'formattingFeedback' and 1-2 'formattingSuggestions'.
       - Achievements (0-100): Impact metrics (reward quantified achievements like "% increased", "$ saved"). Provide tailored 'achievementsFeedback' and 1-2 'achievementsSuggestions'.
       - The overall atsScore should be a weighted average of these three components. Do NOT give an arbitrarily high score. Be critical and authentic.
       
    2. Missing skills (list of strings): Identify missing skills ONLY by strictly comparing the CV text against the provided Job Description(s). 
       - Do NOT hallucinate or guess skills.
       - If a skill is in the JD but missing or weakly represented in the CV, list it.
       - If no JD is provided, list 2-3 standard industry skills missing based on their current role level.
       
    3. Improvement suggestions: Must be 100% actionable and based ONLY on the current flaws in the CV.
       - You MUST include at least one suggestion of type 'summary' (providing 2-3 AI-generated alternative summary statements tailored EXACTLY to the CV's facts in the 'items' field).
       - You MUST include one of type 'achievements' (providing 2-3 examples of how to quantify their existing achievements in the 'examples' field). Do NOT make up numbers; show them how to structure the sentence (e.g., "Increased [metric] by [X]% by doing [action]").
       - Other suggestions can be of type 'general' (e.g., formatting, action verbs).
       
    4. Section-specific granular feedback: Provide detailed feedback and tailored suggestions for specific sections of the CV (e.g., "Education", "Experience", "Skills", "Summary"). Include a score (0-100) for each section.
       
    ${!cvContent ? `5. Extracted Text: You MUST extract and return the full text of the CV in the 'extractedText' field. This is critical for downstream processing.` : ''}
       
    ${jdContext}
    
    CRITICAL PARSING & AUTHENTICITY INSTRUCTIONS:
    - STRICT ACCURACY: Do NOT invent, assume, or hallucinate any skills, experiences, metrics, or previous companies. 
    - Base your entire analysis 100% ONLY on the provided text. If the CV is weak, the score MUST reflect that.

    OUTPUT FORMAT:
    You MUST return a valid JSON object with the following structure. Do NOT include any comments or markdown formatting in the JSON:
    {
      "atsScore": 85,
      "atsScoreBreakdown": {
        "keywordMatching": 80,
        "formatting": 90,
        "achievements": 75,
        "keywordFeedback": "Your CV matches most core requirements but misses some specific tools.",
        "keywordSuggestions": ["Add 'React.js' instead of just 'React'"],
        "formattingFeedback": "Clean layout, easy to parse.",
        "formattingSuggestions": ["Avoid using tables for skills"],
        "achievementsFeedback": "Good use of metrics in recent roles.",
        "achievementsSuggestions": ["Quantify your impact in the first role"]
      },
      "sectionFeedback": [
        {
          "section": "Experience",
          "score": 70,
          "feedback": "Your experience section lacks quantifiable achievements.",
          "suggestions": ["Add metrics to your bullet points", "Use strong action verbs"]
        }
      ],
      "missingSkills": ["skill1", "skill2"],
      "suggestions": [
        {
          "title": "Suggestion Title",
          "description": "Suggestion Description",
          "type": "general",
          "items": [],
          "examples": []
        }
      ],
      "jobMatches": [
        {
          "index": 0,
          "matchScore": 90,
          "matchSummary": ["Strong match for frontend skills", "Missing backend experience"]
        }
      ]${!cvContent ? `,\n      "extractedText": "Full text of the CV goes here..."` : ''}
    }
  `;

  try {
    const parts: any[] = [];
    if (cvContent) {
      parts.push({ text: `CV Content:\n\n${cvContent}\n\n` });
    } else {
      parts.push({
        inlineData: {
          mimeType,
          data: fileBase64,
        },
      });
    }
    parts.push({ text: prompt });

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts,
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            atsScore: { type: Type.NUMBER },
            atsScoreBreakdown: {
              type: Type.OBJECT,
              properties: {
                keywordMatching: { type: Type.NUMBER },
                formatting: { type: Type.NUMBER },
                achievements: { type: Type.NUMBER }
              },
              required: ["keywordMatching", "formatting", "achievements"]
            },
            missingSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } },
                  examples: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        original: { type: Type.STRING },
                        improved: { type: Type.STRING }
                      },
                      required: ["original", "improved"]
                    }
                  }
                },
                required: ["title", "description", "type"]
              }
            },
            matchScore: { type: Type.NUMBER },
            matchSummary: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            jobMatches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.NUMBER },
                  matchScore: { type: Type.NUMBER },
                  matchSummary: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["index", "matchScore", "matchSummary"]
              }
            },
            extractedText: { type: Type.STRING }
          },
          required: ["atsScore", "atsScoreBreakdown", "missingSkills", "suggestions"]
        }
      },
    });

    const text = response.text || "{}";
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    return {
      ...parsed,
      originalText: cvContent || parsed.extractedText || ""
    };
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function rewriteCV(originalText: string, suggestions: Suggestion[] = [], missingSkills: string[] = []) {
  const safeOriginalText = originalText ? originalText.substring(0, 15000) : '';
  const prompt = `
    You are an expert executive resume writer and ATS optimization specialist.
    I will provide you with an original CV text, a list of missing skills, and a list of improvement suggestions.
    
    Your task is to REWRITE the entire CV to incorporate these improvements and skills naturally.
    
    RULES:
    1. CRITICAL: You MUST maintain the EXACT SAME structure, headings, and order as the original CV. Do not change the layout or the way sections are organized.
    2. Maintain the truthfulness of the original CV. Do not invent new jobs or degrees.
    3. Enhance the text within the existing sections (e.g., improving bullet points with action verbs, adding missing skills to the skills section or experience).
    4. Format the output in clean, professional Markdown that closely resembles the original structure. Preserve the original formatting (like bolding, italics, bullet points) as much as possible.
    5. Ensure the final result is ready to be copied and pasted back into the user's original CV template without them having to reformat everything.

    ORIGINAL CV:
    ${safeOriginalText}

    MISSING SKILLS TO INTEGRATE:
    ${(missingSkills || []).join(', ')}

    SUGGESTIONS TO APPLY:
    ${(suggestions || []).map(s => `- ${s.title}: ${s.description}`).join('\n')}
  `;

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { temperature: 0.4 }
    });
    
    if (!response.text) {
      throw new Error("The AI was unable to generate a response. This might be due to safety filters or an unexpected model behavior. Please try again or modify your CV content.");
    }
    
    let text = response.text;
    if (text.startsWith('```markdown')) {
      text = text.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    return text.trim();
  } catch (error) {
    handleGeminiError(error);
  }
}

export function createChatSession(cvContext?: string) {
  const safeCvContext = cvContext ? cvContext.substring(0, 15000) : '';
  const systemInstruction = safeCvContext 
    ? `You are an expert career coach and CV advisor. The user has uploaded their CV. Here is the context of their CV analysis: ${safeCvContext}`
    : `You are an expert career coach and CV advisor.`;
    
  return getAI().chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
    }
  });
}

export interface JobRecommendation {
  title: string;
  company: string;
  location: string;
  type: string;
  matchScore: number;
  whyItMatches: string;
  searchQuery: string;
}

export async function getJobRecommendations(
  cvContent: string,
  preferences: { desiredRoles?: string[], locations?: string[], jobTypes?: string[] },
  savedSearches: { query: string, location?: string }[]
): Promise<JobRecommendation[]> {
  const prompt = `
    You are an expert technical recruiter and career advisor. Based on the user's CV, their profile preferences, and their saved job searches, recommend 3-5 highly relevant, realistic job openings.
    
    User Preferences:
    - Desired Roles: ${preferences.desiredRoles?.join(', ') || 'Not specified'}
    - Locations: ${preferences.locations?.join(', ') || 'Not specified'}
    - Job Types: ${preferences.jobTypes?.join(', ') || 'Not specified'}
    
    Saved Searches:
    ${savedSearches.length > 0 ? savedSearches.map(s => `- ${s.query} (Location: ${s.location || 'Any'})`).join('\n') : 'None'}
    
    CV Content:
    ${cvContent.substring(0, 5000)}
    
    Instructions:
    1. Generate 3-5 realistic job recommendations that perfectly align with the user's experience level, skills, and preferences.
    2. Provide a realistic company name (you can use well-known companies or realistic fictional ones if necessary, but prefer real ones that hire for these roles).
    3. Calculate a match score (0-100) based on how well their CV aligns with the typical requirements for this role.
    4. Write a brief "whyItMatches" explanation (1-2 sentences) detailing why this role is a good fit.
    5. Provide a "searchQuery" that the user could use on a job board (e.g., "Senior Frontend Developer React London").
    
    OUTPUT FORMAT:
    You MUST return a valid JSON array of objects. Do NOT include any comments or markdown formatting.
    [
      {
        "title": "Senior React Developer",
        "company": "TechCorp",
        "location": "London, UK",
        "type": "Full-time",
        "matchScore": 92,
        "whyItMatches": "Your extensive experience with React and recent leadership of frontend teams perfectly aligns with this role.",
        "searchQuery": "Senior React Developer TechCorp London"
      }
    ]
  `;

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              location: { type: Type.STRING },
              type: { type: Type.STRING },
              matchScore: { type: Type.NUMBER },
              whyItMatches: { type: Type.STRING },
              searchQuery: { type: Type.STRING }
            },
            required: ["title", "company", "location", "type", "matchScore", "whyItMatches", "searchQuery"]
          }
        }
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text) as JobRecommendation[];
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function getMarketInsights(query: string, refinement?: string) {
  const prompt = `
    You are an expert tech recruiter and market analyst.
    Analyze the current, real-world job market for the following role/domain: ${query}
    ${refinement ? `Focus specifically on this refinement/location/criteria: ${refinement}` : ''}
    
    CRITICAL AUTHENTICITY RULES:
    1. Base your analysis STRICTLY on real-world data and industry knowledge. 
    2. Do NOT hallucinate data, companies, or salary numbers. 
    3. If exact data is unavailable, state that it is unavailable or provide a verified industry average.
    4. Ensure the "inDemandSkills" are actually trending right now for this specific role.
    5. Ensure the "topCompanies" are genuinely hiring or are major players in this specific domain.
    
    Provide the output in JSON format with the following keys:
    - "salaryTrends": A brief summary of current salary ranges and trends.
    - "inDemandSkills": An array of 5-7 specific skills currently highly sought after in this role.
    - "topCompanies": An array of 3-5 companies actively hiring or known for this role.
    - "generalOutlook": A short paragraph on the overall job market outlook for this role.
  `;

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            salaryTrends: { type: Type.STRING, description: "Salary ranges and trends" },
            inDemandSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5-7 highly sought after skills" },
            topCompanies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 companies actively hiring" },
            generalOutlook: { type: Type.STRING, description: "Overall job market outlook" }
          },
          required: ["salaryTrends", "inDemandSkills", "topCompanies", "generalOutlook"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const parsed = JSON.parse(text);
    
    return {
      ...parsed,
      groundingChunks: []
    };
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function generateCoverLetter(cvContext: string, jobDescription?: string) {
  const safeJobDesc = jobDescription ? jobDescription.substring(0, 5000) : '';
  const safeCvContext = cvContext ? cvContext.substring(0, 15000) : '';
  
  const prompt = `
    Write a professional, concise, and compelling cover letter based strictly on the following CV analysis context.
    ${safeJobDesc ? `Tailor it specifically to this job description: ${safeJobDesc}` : 'Keep it general but impactful.'}
    
    CRITICAL AUTHENTICITY RULES:
    1. STRICTLY use ONLY the facts, metrics, companies, and experiences provided in the CV Context. 
    2. Do NOT fabricate, invent, or exaggerate any experience, metrics, degrees, or skills.
    3. If a metric or specific achievement is not in the CV, do NOT include it in the cover letter.
    4. Maintain a professional, confident, yet authentic tone. Do not sound overly robotic or boastful about things not proven in the CV.
    
    CV Context:
    ${safeCvContext}
  `;
  
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.4,
      }
    });
    
    return response.text;
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function generateLinkedInProfile(fileBase64: string, mimeType: string) {
  const prompt = `
    Analyze this CV and generate an optimized LinkedIn profile for the candidate.
    STRICT ACCURACY: Do not invent any achievements, roles, or skills not present in the CV. Base the profile entirely on the provided facts.
    Return a JSON object with two fields:
    1. "headline": A catchy, professional LinkedIn headline (under 120 characters) that highlights their core expertise and value proposition.
    2. "about": An engaging, first-person LinkedIn "About" section (3-4 paragraphs) that tells their professional story, highlights key achievements, and includes a call to action or notes what they are looking for.

    OUTPUT FORMAT:
    You MUST return a valid JSON object with the following structure. Do NOT include any comments or markdown formatting in the JSON:
    {
      "headline": "...",
      "about": "..."
    }
  `;

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: fileBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: "LinkedIn Headline" },
            about: { type: Type.STRING, description: "LinkedIn About section" }
          },
          required: ["headline", "about"]
        },
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as { headline: string, about: string };
  } catch (error) {
    handleGeminiError(error);
  }
}

export async function generateHotSeatQuestions(cvContext: string, jobDescription: string) {
  const safeJobDesc = jobDescription ? jobDescription.substring(0, 5000) : 'General Tech Role';
  const safeCvContext = cvContext ? cvContext.substring(0, 15000) : '';

  const prompt = `
    You are a tough, veteran technical recruiter and hiring manager. 
    Analyze the following CV against the provided Job Description. 
    Find the 3 biggest weaknesses, gaps, missing skills, or questionable areas in the candidate's profile. 
    Generate the 3 toughest, most probing interview questions you would ask to grill the candidate on these specific weaknesses. 
    For each question, provide a brief 'Defense Strategy' explaining how the candidate should gracefully answer it to turn the weakness into a strength.
    
    STRICT ACCURACY: Base these questions ONLY on actual gaps or weaknesses found by comparing the provided CV and Job Description. Do not invent irrelevant weaknesses.
    
    CV Context:
    ${safeCvContext}
    
    Job Description:
    ${safeJobDesc}
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-3-flash-preview', // Use flash for faster response and higher rate limits
      contents: prompt,
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  weakness: { type: Type.STRING, description: "The specific weakness or gap identified" },
                  question: { type: Type.STRING, description: "The tough interview question" },
                  defenseStrategy: { type: Type.STRING, description: "How the candidate should answer" }
                },
                required: ["weakness", "question", "defenseStrategy"]
              }
            }
          },
          required: ["questions"]
        },
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as { questions: { weakness: string, question: string, defenseStrategy: string }[] };
  } catch (error) {
    handleGeminiError(error);
  }
}
