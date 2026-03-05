import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, List, HelpCircle, CheckSquare, Share2,
  Dna, GitBranch, Play, Mic, BarChart2, Zap, Download, Settings,
  Upload, Edit3, Loader2, ChevronRight, ChevronLeft, Eye, EyeOff, Save,
  BookOpen, AlertTriangle, Target, Trophy, Clock, History, Pause, FastForward,
  FileSearch, Link2, Headphones, TrendingUp, Repeat, Star, ChevronDown, ChevronUp,
  Volume2, VolumeX, SkipForward, SkipBack, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AIService } from './services/aiService';
import {
  Summary as SummaryType, Question, MCQ, ConceptMapData
} from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Markdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safe hash for localStorage cache keys — avoids btoa crash on non-ASCII text
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36) + '_' + str.length;
}

const TABS = [
  { id: 'input', label: 'Dashboard', icon: FileText },
  { id: 'summary', label: 'Summary', icon: BookOpen },
  { id: 'keypoints', label: 'Key Points', icon: List },
  { id: 'topic', label: 'Topic Generator', icon: Star },
  { id: 'qa', label: 'Q & A Bank', icon: HelpCircle },
  { id: 'mcq', label: 'MCQ Practice', icon: CheckSquare },
  { id: 'map', label: 'Concept Map', icon: Share2 },
  { id: 'dna', label: 'Concept Structure', icon: Dna },
  { id: 'flowchart', label: 'Flowchart', icon: GitBranch },
  { id: 'visual', label: 'Visual Explainer', icon: Eye },
  { id: 'evolution', label: 'Concept Evolution', icon: History },
  { id: 'quiz', label: 'Interactive Quiz', icon: Play },
  { id: 'viva', label: 'Viva Simulator', icon: Mic },
  { id: 'exam', label: 'Exam Mode', icon: Zap },
  { id: 'predictor', label: 'Exam Predictor', icon: Target },
  { id: 'doubt', label: 'Doubt Analyzer', icon: AlertTriangle },
  { id: 'pastpapers', label: 'PYQ Analyzer', icon: FileSearch },
  { id: 'conceptlink', label: 'Concept Linker', icon: Link2 },
  { id: 'audio', label: 'Audio Revision', icon: Headphones },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [inputText, setInputText] = useState('');
  const [compareText, setCompareText] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<{ type: 'limit' | 'failure'; title: string; message: string } | null>(null);
  const [data, setData] = useState<{
    summary?: SummaryType;
    keyPoints?: string[];
    questions?: Question[];
    mcqs?: MCQ[];
    examMCQs?: MCQ[];
    conceptMap?: ConceptMapData;
    eli10?: string;
    doubts?: string[];
    visualSteps?: { title: string; description: string }[];
    evolution?: { period: string; concept: string; explanation: string; change: string }[];
    predictions?: { marks: number; question: string; answer: string; topic: string; probability: string }[];
    conceptLinks?: {
      prerequisites: { name: string; reason: string; importance: string }[];
      relatedConcepts: { name: string; connection: string }[];
      leadsTo: { name: string; description: string }[];
      studyOrder: string[];
    };
  }>({});

  const clearData = (key: string) => {
    setData(prev => { const next = { ...prev }; delete (next as any)[key]; return next; });
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Always use same-origin API path so Vite dev proxy and production server both work
      const res = await fetch('/api/extract', { method: 'POST', body: formData });

      // Safely handle non-JSON / empty responses to avoid "Unexpected end of JSON input"
      const contentType = res.headers.get('content-type') || '';
      const rawBody = await res.text();

      let data: any = null;
      if (rawBody) {
        if (!contentType.includes('application/json')) {
          throw new Error(`Server returned invalid response (status ${res.status}).`);
        }
        try {
          data = JSON.parse(rawBody);
        } catch {
          throw new Error('Server returned malformed JSON.');
        }
      }

      if (!res.ok || data?.error) {
        throw new Error(data?.error || `Upload failed with status ${res.status}.`);
      }

      if (!data || typeof data.text !== 'string' || !data.text.trim()) {
        throw new Error('Server did not return any extracted text.');
      }

      setInputText(data.text);
    } catch (err: any) {
      console.error("Upload extraction error:", err);
      setGlobalError({
        type: 'failure',
        title: 'Upload Failed',
        message: err.message || "We couldn't extract text from this file. Please try another format."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processAll = async () => {
    if (!inputText) return;
    setIsProcessing(true);
    setGlobalError(null);
    try {
      // Check cache first
      const cacheKey = `studysnap_cache_${simpleHash(inputText)}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        console.log("Using cached data...");
        const parsed = JSON.parse(cachedData);
        setData(parsed);
        setActiveTab('summary');
        setIsProcessing(false);
        return;
      }

      console.log("Starting combined AI processing...");
      const result = await AIService.generateAll(inputText);

      console.log("AI processing complete. Updating state and cache...");
      setData(result);

      // Save to cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
        console.warn("Failed to save to localStorage cache (likely quota exceeded)", e);
      }

      setActiveTab('summary');
    } catch (err: any) {
      console.error("Processing error:", err);
      const msg = err?.message || String(err);

      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('resource_exhausted')) {
        setGlobalError({
          type: 'limit',
          title: 'API Limit Reached',
          message: "You've hit the Gemini free-tier quota. Please wait about 60 seconds before trying again."
        });
      } else {
        setGlobalError({
          type: 'failure',
          title: 'Generation Failed',
          message: msg.length > 200 ? "We couldn't process this content. It might be too large or complex for the AI. Try smaller snippets." : msg
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const processTopic = async (topic: string) => {
    if (!topic) return;
    setIsProcessing(true);
    setGlobalError(null);
    try {
      const cacheKey = `studysnap_cache_${simpleHash(topic)}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        console.log("Using cached data for topic...");
        const parsed = JSON.parse(cachedData);
        setData(parsed);
        setInputText(topic);
        setActiveTab('summary');
        setIsProcessing(false);
        return;
      }

      console.log("Starting combined AI processing for topic...");
      const result = await AIService.generateAll(topic);

      console.log("AI processing complete. Updating state and cache...");
      setData(result);
      setInputText(topic);

      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
        console.warn("Failed to save to localStorage cache", e);
      }
      setActiveTab('summary');
    } catch (err: any) {
      console.error("Processing error:", err);
      const msg = err?.message || String(err);

      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('resource_exhausted')) {
        setGlobalError({
          type: 'limit',
          title: 'API Limit Reached',
          message: "You've hit the Gemini free-tier quota. Please wait about 60 seconds before trying again."
        });
      } else {
        setGlobalError({
          type: 'failure',
          title: 'Generation Failed',
          message: msg.length > 200 ? "We couldn't process this topic. Try a simpler name." : msg
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const checkSimilarity = () => {
    if (!inputText || !compareText) return;
    const s1 = new Set(inputText.toLowerCase().split(/\W+/));
    const s2 = new Set(compareText.toLowerCase().split(/\W+/));
    const intersect = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);
    setSimilarity(intersect.size / union.size);
  };

  const resetSimilarity = () => {
    setCompareText('');
    setSimilarity(null);
  };

  const resetAll = async () => {
    await fetch('/api/reset', { method: 'POST' });
    setInputText('');
    setCompareText('');
    setSimilarity(null);
    setData({});
    setGlobalError(null);
    setActiveTab('input');
  };

  return (
    <div className="flex h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#1A1A1A]/10 flex flex-col">
        <div className="p-6 border-bottom border-[#1A1A1A]/10">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-600" />
            StudySnap AI
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {TABS.map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-[#1A1A1A] text-white shadow-lg shadow-black/10"
                  : "text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.badge && <span className="text-xs">{tab.badge}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        {/* Animated container for non-persistent tabs */}
        <AnimatePresence mode="wait">
          {['visual', 'evolution', 'exam', 'predictor', 'doubt', 'conceptlink'].includes(activeTab) ? null : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-8 max-w-5xl mx-auto"
            >
              {activeTab === 'input' && (
                <InputView
                  inputText={inputText}
                  setInputText={setInputText}
                  compareText={compareText}
                  setCompareText={setCompareText}
                  similarity={similarity}
                  checkSimilarity={checkSimilarity}
                  resetSimilarity={resetSimilarity}
                  handleFileUpload={handleFileUpload}
                  processAll={processAll}
                  isProcessing={isProcessing}
                />
              )}
              {activeTab === 'topic' && (
                <TopicView
                  processTopic={processTopic}
                  isProcessing={isProcessing}
                />
              )}
              {activeTab === 'summary' && <SummaryView summary={data.summary} eli10={data.eli10} onClear={() => { clearData('summary'); clearData('eli10'); }} />}
              {activeTab === 'keypoints' && <KeyPointsView points={data.keyPoints} onClear={() => clearData('keyPoints')} />}
              {activeTab === 'qa' && <QAView questions={data.questions} onClear={() => clearData('questions')} />}
              {activeTab === 'mcq' && <MCQView mcqs={data.mcqs} onClear={() => clearData('mcqs')} />}
              {activeTab === 'map' && <ConceptMapView data={data.conceptMap} onClear={() => clearData('conceptMap')} />}
              {activeTab === 'dna' && <ConceptDNAView data={data.conceptMap} onClear={() => clearData('conceptMap')} />}
              {activeTab === 'flowchart' && <FlowchartView data={data.conceptMap} onClear={() => clearData('conceptMap')} />}
              {activeTab === 'quiz' && <QuizView mcqs={data.mcqs} onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })} />}
              {activeTab === 'viva' && <VivaView questions={data.questions} onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })} />}
              {activeTab === 'pastpapers' && <PastPaperAnalyzerView onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })} />}
              {activeTab === 'audio' && <AudioRevisionView text={inputText} summary={data.summary} onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })} />}
              {activeTab === 'export' && <ExportView data={data} />}
              {activeTab === 'settings' && <SettingsView onReset={resetAll} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Persistent views — always mounted, shown/hidden via CSS to preserve local state across tab switches */}
        <div className="p-8 max-w-5xl mx-auto">
          <div style={{ display: activeTab === 'visual' ? 'block' : 'none' }}>
            <VisualExplainView
              preSteps={data.visualSteps}
              text={inputText}
              onClear={() => clearData('visualSteps')}
              onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })}
            />
          </div>
          <div style={{ display: activeTab === 'evolution' ? 'block' : 'none' }}>
            <ConceptEvolutionView
              preEvolution={data.evolution}
              text={inputText}
              onClear={() => clearData('evolution')}
              onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })}
            />
          </div>
          <div style={{ display: activeTab === 'exam' ? 'block' : 'none' }}>
            <ExamModeView
              examMCQs={data.examMCQs}
              inputText={inputText}
              onClear={() => clearData('examMCQs')}
              onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })}
            />
          </div>
          <div style={{ display: activeTab === 'predictor' ? 'block' : 'none' }}>
            <PredictorView
              prePredictions={data.predictions}
              syllabus={inputText}
              onClear={() => clearData('predictions')}
              onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })}
            />
          </div>
          <div style={{ display: activeTab === 'doubt' ? 'block' : 'none' }}>
            <DoubtGeneratorView
              preDoubts={data.doubts}
              text={inputText}
              onClear={() => clearData('doubts')}
              onApiLimit={(t, m) => setGlobalError({ type: 'limit', title: t || 'Limit', message: m || '' })}
            />
          </div>
          <div style={{ display: activeTab === 'conceptlink' ? 'block' : 'none' }}>
            <ConceptLinkingView
              preLinks={data.conceptLinks}
              text={inputText}
              onClear={() => clearData('conceptLinks')}
              onApiLimit={(title, msg) => setGlobalError({ type: 'limit', title: title || 'API Limit', message: msg || 'Please wait a minute.' })}
            />
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto" />
              <p className="mt-4 font-medium text-[#1A1A1A]">Analyzing your knowledge...</p>
              <p className="text-sm text-[#1A1A1A]/60">Extracting concepts, generating visuals, and building your learning path.</p>
            </div>
          </div>
        )}
      </main>

      {globalError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-md w-full p-10 text-center relative overflow-hidden"
          >
            <div className={cn(
              "absolute top-0 left-0 w-full h-2",
              globalError.type === 'limit' ? "bg-amber-500" : "bg-rose-500"
            )} />

            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
              globalError.type === 'limit' ? "bg-amber-100" : "bg-rose-100"
            )}>
              {globalError.type === 'limit' ? (
                <Zap className="w-10 h-10 text-amber-500" />
              ) : (
                <AlertTriangle className="w-10 h-10 text-rose-500" />
              )}
            </div>

            <h2 className="text-3xl font-black mb-3">{globalError.title}</h2>
            <p className="text-[#1A1A1A]/60 mb-8 leading-relaxed">
              {globalError.message}
            </p>


            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => setGlobalError(null)}
                className="px-8 py-3 bg-[#1A1A1A] text-white rounded-full font-bold hover:opacity-80 transition-opacity"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Sub-Views ---

function InputView({ inputText, setInputText, compareText, setCompareText, similarity, checkSimilarity, resetSimilarity, handleFileUpload, processAll, isProcessing }: any) {
  const loadSample = () => {
    setInputText("Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll pigments. In plants, photosynthesis occurs in organelles called chloroplasts. The process involves the conversion of light energy into chemical energy, which is stored in glucose. The overall chemical equation for photosynthesis is: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. This process is vital for life on Earth as it provides the primary source of energy for nearly all ecosystems and releases oxygen into the atmosphere.");
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Welcome to StudySnap AI</h2>
          <p className="mt-2 text-[#1A1A1A]/60 text-lg">Upload your study material to begin the transformation.</p>
        </div>
        <button
          onClick={loadSample}
          className="px-4 py-2 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 rounded-full text-xs font-bold transition-colors"
        >
          Load Sample Data
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Files
          </h3>
          <p className="text-sm text-[#1A1A1A]/60 mb-6">Support for PDF, DOCX, and TXT files. Multi-page extraction supported.</p>
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#1A1A1A]/20 rounded-2xl cursor-pointer hover:bg-[#1A1A1A]/5 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileText className="w-10 h-10 text-[#1A1A1A]/40 mb-3" />
              <p className="mb-2 text-sm text-[#1A1A1A]/60"><span className="font-bold">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-[#1A1A1A]/40">PDF, DOCX, TXT (MAX. 50MB)</p>
            </div>
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
          </label>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Paste Text
            </h3>
            {inputText && (
              <button
                onClick={() => setInputText('')}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-sm text-[#1A1A1A]/60 mb-6">Directly paste your notes, articles, or textbook content here.</p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your content here..."
            className="w-full h-48 p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#1A1A1A]/10 resize-none text-sm"
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10 shadow-sm">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Similarity / Reuse Detector
        </h3>
        <p className="text-sm text-[#1A1A1A]/60 mb-6">Compare your text with another source to detect overlaps or reuse.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <textarea
            value={compareText}
            onChange={(e) => setCompareText(e.target.value)}
            placeholder="Paste text to compare..."
            className="w-full h-32 p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#1A1A1A]/10 resize-none text-sm"
          />
          <div className="flex flex-col justify-center items-center p-6 bg-[#F5F5F0] rounded-2xl">
            {similarity !== null ? (
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-600">{Math.round(similarity * 100)}%</div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mt-2">Similarity Score</div>
                <button
                  onClick={resetSimilarity}
                  className="mt-4 text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 mx-auto"
                >
                  <Zap className="w-3 h-3 rotate-180" />
                  Reset Detector
                </button>
              </div>
            ) : (
              <button
                onClick={checkSimilarity}
                className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full text-sm font-bold"
              >
                Check Similarity
              </button>
            )}
          </div>
        </div>
      </div>

      {
        inputText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Content Preview</h3>
              <button
                onClick={processAll}
                disabled={isProcessing}
                className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isProcessing ? 'Processing...' : 'Generate Learning System'}
              </button>
            </div>
            <div className="mt-8 p-6 bg-[#F5F5F0] rounded-2xl border border-[#1A1A1A]/5 text-sm text-[#1A1A1A]/70 whitespace-pre-wrap max-h-96 overflow-y-auto">
              {inputText.slice(0, 2000)}{inputText.length > 2000 ? '...' : ''}
            </div>
          </motion.div>
        )}
    </div>
  );
}

function TopicView({ processTopic, isProcessing }: any) {
  const [topicInput, setTopicInput] = useState('');

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Topic Generator</h2>
          <p className="mt-2 text-[#1A1A1A]/60 text-lg">Generate a complete study guide from just a topic name.</p>
        </div>
      </header>

      <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10 shadow-sm hover:shadow-md transition-shadow max-w-2xl mx-auto">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Enter Topic
        </h3>
        <p className="text-sm text-[#1A1A1A]/60 mb-6">Type any topic (e.g. "Photosynthesis", "Quantum Computing", "French Revolution") and let the AI generate notes, Q&A, mind maps, and quizzes instantly.</p>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && topicInput.trim() && !isProcessing) processTopic(topicInput.trim()); }}
            placeholder="e.g. Photosynthesis..."
            className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#1A1A1A]/10 text-lg font-medium"
          />

          <button
            onClick={() => processTopic(topicInput.trim())}
            disabled={isProcessing || !topicInput.trim()}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {isProcessing ? 'Generating Content...' : 'Generate Learning System'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryView({ summary, eli10, onClear }: { summary?: SummaryType; eli10?: string; onClear?: () => void }) {
  const [mode, setMode] = useState<'short' | 'medium' | 'detailed'>('medium');

  if (!summary) return <EmptyState />;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Intelligent Summary</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Distilled knowledge in three distinct granularities.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1 rounded-full border border-[#1A1A1A]/10">
            {(['short', 'medium', 'detailed'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                  mode === m ? "bg-[#1A1A1A] text-white" : "text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
        </div>
      </header>

      <div className="bg-white p-10 rounded-[40px] border border-[#1A1A1A]/10 shadow-sm">
        <div className="prose prose-slate max-w-none">
          <Markdown>{summary[mode]}</Markdown>
        </div>
      </div>

      {eli10 && (
        <div className="bg-emerald-50 p-10 rounded-[40px] border border-emerald-100">
          <h3 className="text-2xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Explanation
          </h3>
          <p className="text-emerald-800 leading-relaxed italic">"{eli10}"</p>
        </div>
      )}
    </div>
  );
}

function KeyPointsView({ points, onClear }: { points?: string[]; onClear?: () => void }) {
  if (!points) return <EmptyState />;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Key Learning Points</h2>
          <p className="mt-2 text-[#1A1A1A]/60">The core pillars of this subject matter.</p>
        </div>
        {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {points.map((point, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-[#1A1A1A]/10 flex gap-4 items-start"
          >
            <div className="w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {i + 1}
            </div>
            <p className="text-sm font-medium leading-relaxed">{point}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function QAView({ questions, onClear }: { questions?: Question[]; onClear?: () => void }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  if (!questions) return <EmptyState />;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">2-Mark Q&A</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Deep dive into conceptual understanding.</p>
        </div>
        {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-3xl border border-[#1A1A1A]/10 overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 bg-[#F5F5F0] px-3 py-1 rounded-full">
                  Topic: {q.topic}
                </span>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                  q.difficulty === 'Easy' ? "bg-emerald-100 text-emerald-700" :
                    q.difficulty === 'Medium' ? "bg-amber-100 text-amber-700" :
                      "bg-rose-100 text-rose-700"
                )}>
                  {q.difficulty}
                </span>
              </div>
              <h4 className="text-lg font-bold mb-6">Q{i + 1}: {q.question}</h4>

              <button
                onClick={() => setRevealed(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {revealed[q.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {revealed[q.id] ? 'Hide Answer' : 'Reveal Answer'}
              </button>

              <AnimatePresence>
                {revealed[q.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 pt-6 border-t border-[#1A1A1A]/5"
                  >
                    <p className="text-sm text-[#1A1A1A]/70 leading-relaxed bg-[#F5F5F0] p-6 rounded-2xl">
                      {q.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MCQView({ mcqs, onClear }: { mcqs?: MCQ[]; onClear?: () => void }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  if (!mcqs) return <EmptyState />;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">MCQ Challenge</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Test your precision and recall.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResults(!showResults)}
            className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full text-sm font-bold"
          >
            {showResults ? 'Clear Results' : 'Check Answers'}
          </button>
          {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
        </div>
      </header>

      <div className="space-y-6">
        {mcqs.map((q, i) => (
          <div key={q.id} className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10">
            <h4 className="text-lg font-bold mb-6">{i + 1}. {q.question}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.entries(q.options) as [string, string][]).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setSelected(prev => ({ ...prev, [q.id]: key }))}
                  disabled={showResults}
                  className={cn(
                    "p-4 rounded-2xl text-left text-sm font-medium border transition-all",
                    selected[q.id] === key
                      ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                      : "bg-white border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30",
                    showResults && key === q.answer && "bg-emerald-500 text-white border-emerald-500",
                    showResults && selected[q.id] === key && key !== q.answer && "bg-rose-500 text-white border-rose-500"
                  )}
                >
                  <span className="font-bold mr-2">{key}.</span> {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptMapView({ data, onClear }: { data?: ConceptMapData; onClear?: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const resolveId = (v: any) => (v && typeof v === 'object' ? v.id : v);

    const W = svgRef.current.clientWidth || 900;
    const H = 750;


    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Color palette per node type
    const nodeColor: Record<string, string> = {
      topic: '#10b981',
      subtopic: '#3b82f6',
      detail: '#6b7280',
      micro: '#a855f7',
      formula: '#f59e0b',
      example: '#f43f5e',
    };

    // ─── Dynamic radius per node ( = large enough to fit text ) ───────────
    const BASE_RADIUS: Record<string, number> = {
      topic: 50, subtopic: 36, detail: 26, micro: 24, formula: 28, example: 24,
    };
    const FONT_SIZE: Record<string, number> = {
      topic: 12, subtopic: 11, detail: 9.5, micro: 9, formula: 9.5, example: 9,
    };
    const CHAR_WIDTH = 6.5; // average px width per character at 10px font
    const PADDING = 14;     // inner padding between text edge and circle boundary

    function nodeRadius(d: any): number {
      const name: string = d.name || '';
      const fs = FONT_SIZE[d.type] || 10;
      const scale = fs / 10;
      const words = name.split(' ');
      const halfCols = Math.ceil(words.length / 2);
      // Estimate widest line
      let maxLineChars = 0;
      let cur = '';
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (trial.length <= 18) { cur = trial; }
        else { maxLineChars = Math.max(maxLineChars, cur.length); cur = w; }
      }
      maxLineChars = Math.max(maxLineChars, cur.length);
      // Radius must accommodate the widest line
      const textHalfW = (maxLineChars * CHAR_WIDTH * scale) / 2 + PADDING;
      const baseR = BASE_RADIUS[d.type] || 26;
      return Math.max(baseR, textHalfW);
    }

    // Deep-clone nodes & links so D3 can mutate them
    const nodes: any[] = data.nodes.map(n => ({ ...n }));
    const links: any[] = data.links.map(l => ({
      source: resolveId(l.source),
      target: resolveId(l.target),
    }));

    // Marker definitions (arrowheads per type)
    const defs = svg.append('defs');
    Object.entries(nodeColor).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
        .attr('opacity', 0.85);
    });
    defs.append('marker')
      .attr('id', 'arrow-default')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#94a3b8')
      .attr('opacity', 0.8);

    // Zoom layer
    const g = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => g.attr('transform', event.transform))
    );

    // Force simulation — uses per-node radius
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
        const sType = d.source?.type || 'detail';
        const tType = d.target?.type || 'detail';
        if (sType === 'topic' || tType === 'topic') return 260;
        if (sType === 'subtopic' || tType === 'subtopic') return 200;
        return 160;
      }).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-1200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius((d: any) => nodeRadius(d) + 18).strength(1));

    // Link lines
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        const src = d.source?.type || 'detail';
        return nodeColor[src] || '#94a3b8';
      })
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', (d: any) => {
        const src = d.source?.type || 'detail';
        return src === 'topic' ? 2.5 : src === 'subtopic' ? 2 : 1.5;
      })
      .attr('marker-end', (d: any) => {
        const tType = d.target?.type || 'default';
        return `url(#arrow-${nodeColor[tType] ? tType : 'default'})`;
      });

    // Node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'grab')
      .call(
        d3.drag<SVGGElement, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Node circles — dynamically sized
    node.append('circle')
      .attr('r', (d: any) => nodeRadius(d))
      .attr('fill', (d: any) => nodeColor[d.type] || '#6b7280')
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .attr('opacity', 0.95);

    // Label — white text, optionally wrapped to 2-3 lines, centered inside circle
    const MAX_CHARS = 18;
    node.each(function (d: any) {
      const fs = FONT_SIZE[d.type] || 10;
      const r = nodeRadius(d);
      const words = (d.name as string).split(' ');

      // Build lines by fitting words within MAX_CHARS
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (trial.length <= MAX_CHARS) {
          cur = trial;
        } else {
          if (cur) lines.push(cur);
          cur = w.length > MAX_CHARS ? w.slice(0, MAX_CHARS - 1) + '…' : w;
        }
      }
      if (cur) lines.push(cur);
      const maxLines = Math.max(2, Math.ceil(r / (fs + 3)));
      const displayLines = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        displayLines[maxLines - 1] = displayLines[maxLines - 1].slice(0, MAX_CHARS - 2) + '…';
      }

      const lineH = fs + 3;
      const totalH = (displayLines.length - 1) * lineH;
      const startDy = -totalH / 2;

      // White semi-transparent backdrop for extra readability
      const maxW = Math.max(...displayLines.map(l => l.length)) * (fs * 0.58);
      d3.select(this).append('rect')
        .attr('x', -maxW / 2 - 3)
        .attr('y', startDy - fs)
        .attr('width', maxW + 6)
        .attr('height', totalH + fs + 4)
        .attr('rx', 3)
        .attr('fill', 'rgba(0,0,0,0.18)')
        .attr('pointer-events', 'none');

      const textEl = d3.select(this).append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('font-size', fs)
        .attr('font-weight', d.type === 'topic' ? 800 : d.type === 'subtopic' ? 700 : 600)
        .attr('fill', '#ffffff')
        .attr('pointer-events', 'none');

      displayLines.forEach((line, i) => {
        textEl.append('tspan')
          .attr('x', 0)
          .attr('dy', i === 0 ? startDy : lineH)
          .text(line);
      });

      d3.select(this).append('title').text(d.name);
    });

    // Tick — curved arrow paths
    simulation.on('tick', () => {
      link.attr('d', (d: any) => {
        const rS = nodeRadius(d.source);
        const rT = nodeRadius(d.target);
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const sx = d.source.x + (dx / dist) * rS;
        const sy = d.source.y + (dy / dist) * rS;
        const tx = d.target.x - (dx / dist) * (rT + 10);
        const ty = d.target.y - (dy / dist) * (rT + 10);
        const mx = (sx + tx) / 2 - dy * 0.12;
        const my = (sy + ty) / 2 + dx * 0.12;
        return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
      });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [data]);


  if (!data) return <EmptyState />;

  // Legend
  const legendItems = [
    { type: 'topic', color: '#10b981', label: 'Topic' },
    { type: 'subtopic', color: '#3b82f6', label: 'Subtopic' },
    { type: 'detail', color: '#6b7280', label: 'Detail' },
    { type: 'micro', color: '#a855f7', label: 'Micro' },
    { type: 'formula', color: '#f59e0b', label: 'Formula' },
    { type: 'example', color: '#f43f5e', label: 'Example' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Concept Map</h2>
          <p className="mt-2 text-[#1A1A1A]/60">
            Interactive knowledge graph — drag nodes, scroll to zoom, arrows show relationships.
          </p>
        </div>
        {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {legendItems.map(item => (
          <div key={item.type} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A]/70">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A]/40 ml-auto">
          Drag to move · Scroll to zoom
        </div>
      </div>

      {/* Graph canvas */}
      <div
        className="bg-[#f8fafc] rounded-[28px] border border-[#1A1A1A]/10 shadow-sm overflow-hidden"
        style={{ height: 750 }}
      >
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  );
}
function ConceptDNAView({ data, onClear }: { data?: ConceptMapData; onClear?: () => void }) {
  if (!data) return <EmptyState />;

  const layers = ['topic', 'subtopic', 'micro', 'formula', 'example'];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Concept Structure</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Layered structural exploration of the subject.</p>
        </div>
        {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      <div className="space-y-4">
        {layers.map((layer, i) => (
          <div key={layer} className="bg-white p-6 rounded-3xl border border-[#1A1A1A]/10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold uppercase">
                L{i + 1}
              </div>
              <h3 className="text-lg font-bold uppercase tracking-widest text-[#1A1A1A]/40">{layer}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.nodes.filter(n => n.type === layer).map(n => (
                <span key={n.id} className="px-4 py-2 bg-[#F5F5F0] rounded-full text-xs font-bold border border-[#1A1A1A]/5">
                  {n.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowchartView({ data, onClear }: { data?: ConceptMapData; onClear?: () => void }) {
  if (!data) return <EmptyState />;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Flowchart Generator</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Logical flow of concepts and processes.</p>
        </div>
        {onClear && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      <div className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4">
          {data.nodes.slice(0, 5).map((node, i) => (
            <React.Fragment key={node.id}>
              <div className="px-8 py-4 bg-[#1A1A1A] text-white rounded-xl font-bold shadow-lg">
                {node.name}
              </div>
              {i < 4 && <ChevronRight className="w-6 h-6 rotate-90 text-[#1A1A1A]/20" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuizView({ mcqs: initialMcqs, onApiLimit }: { mcqs?: MCQ[]; onApiLimit?: (title?: string, message?: string) => void }) {
  const [pool, setPool] = useState<MCQ[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [confusion, setConfusion] = useState<{ correction: string; feedback: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [finished, setFinished] = useState(false);

  // Build initial shuffled pool when initialMcqs first arrives
  useEffect(() => {
    if (initialMcqs && initialMcqs.length > 0 && pool.length === 0) {
      setPool(shuffle([...initialMcqs]));
    }
  }, [initialMcqs]);

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  if (!initialMcqs || initialMcqs.length === 0) return <EmptyState />;
  if (pool.length === 0) return <EmptyState />;

  const currentQ = pool[currentIndex];

  const handleAnswer = async (key: string) => {
    setSelected(key);
    const isCorrect = key === currentQ.answer;

    if (!isCorrect) {
      setIsAnalyzing(true);
      try {
        const cacheKey = `confusion_cache_${simpleHash(currentQ.id + '_' + key)}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setConfusion(JSON.parse(cached));
        } else {
          const feedback = await AIService.detectConfusion(
            currentQ.options[key as keyof typeof currentQ.options],
            currentQ.options[currentQ.answer as keyof typeof currentQ.options]
          );
          setConfusion(feedback);
          localStorage.setItem(cacheKey, JSON.stringify(feedback));
        }
      } catch (err: any) {
        console.error(err);
        const msg = err?.message || '';
        if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
          onApiLimit?.('API Limit', "Confusion analysis reached limit. Please wait 60s.");
        }
      } finally {
        setIsAnalyzing(false);
      }
    }

    setResults(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
  };

  const next = async () => {
    const newUsedIds = new Set(usedIds).add(currentQ.id);
    setUsedIds(newUsedIds);

    if (currentIndex < pool.length - 1) {
      // More questions left in current pool cycle
      setCurrentIndex(currentIndex + 1);
      setSelected(null);
      setConfusion(null);
    } else {
      // Pool exhausted — either reshuffle unused from original set or re-fetch
      const allIds = initialMcqs!.map(m => m.id);
      const allUsed = allIds.every(id => newUsedIds.has(id));

      if (allUsed) {
        // All original MCQs used — fetch new batch
        setIsRefetching(true);
        try {
          const newMcqs = await AIService.generateMCQs(
            Array.from(newUsedIds).join(','), // pass hint (not used in prompt, just unique)
            15, 'Medium'
          );
          const freshPool = shuffle(newMcqs);
          setPool(freshPool);
          setUsedIds(new Set());
          setCurrentIndex(0);
        } catch (err: any) {
          console.error('Failed to fetch new questions:', err);
          const msg = err?.message || '';
          if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
            onApiLimit?.('API Limit', "New question generation reached limit. Please wait 60s.");
          }
          // Fallback: reshuffle original
          setPool(shuffle([...initialMcqs!]));
          setUsedIds(new Set());
          setCurrentIndex(0);
        } finally {
          setIsRefetching(false);
        }
      } else {
        // Some originals not yet used — filter and reshuffle unused
        const unused = initialMcqs!.filter(m => !newUsedIds.has(m.id));
        setPool(shuffle(unused.length > 0 ? unused : [...initialMcqs!]));
        if (unused.length === 0) setUsedIds(new Set());
        setCurrentIndex(0);
      }
      setFinished(true);
    }
    setSelected(null);
    setConfusion(null);
  };

  if (finished && currentIndex === 0 && !isRefetching) {
    return (
      <div className="text-center py-20">
        <Trophy className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
        <h2 className="text-4xl font-bold mb-4">Round Complete!</h2>
        <p className="text-xl text-[#1A1A1A]/60 mb-2">You scored {results.correct} out of {results.total}</p>
        <p className="text-sm text-[#1A1A1A]/40 mb-8">A new set of questions is ready — no repeats until all are done!</p>
        <button
          onClick={() => setFinished(false)}
          className="px-8 py-3 bg-[#1A1A1A] text-white rounded-full font-bold flex items-center gap-2 mx-auto"
        >
          <Repeat className="w-4 h-4" /> Continue Quiz
        </button>
      </div>
    );
  }

  if (isRefetching) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
        <p className="font-bold text-lg">Generating fresh questions...</p>
        <p className="text-sm text-[#1A1A1A]/40">You've answered all available questions. Fetching more!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Interactive Quiz</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Question {currentIndex + 1} of {pool.length}</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Score</div>
          <div className="text-2xl font-bold">{results.correct} / {results.total}</div>
        </div>
      </header>

      <div className="bg-white p-10 rounded-[40px] border border-[#1A1A1A]/10 shadow-sm">
        <h3 className="text-2xl font-bold mb-8">{currentQ.question}</h3>
        <div className="grid grid-cols-1 gap-4">
          {(Object.entries(currentQ.options) as [string, string][]).map(([key, value]) => (
            <button
              key={key}
              onClick={() => !selected && handleAnswer(key)}
              disabled={!!selected}
              className={cn(
                "p-6 rounded-2xl text-left font-medium border transition-all flex items-center justify-between",
                selected === key
                  ? (key === currentQ.answer ? "bg-emerald-500 text-white border-emerald-500" : "bg-rose-500 text-white border-rose-500")
                  : (selected && key === currentQ.answer ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30 disabled:cursor-default")
              )}
            >
              <span><span className="font-bold mr-4">{key}.</span> {value}</span>
              {selected === key && (key === currentQ.answer ? <CheckSquare className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />)}
            </button>
          ))}
        </div>

        {isAnalyzing && (
          <div className="mt-6 flex items-center gap-2 text-[#1A1A1A]/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Analyzing your mistake...</span>
          </div>
        )}

        <AnimatePresence>
          {confusion && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-8 bg-rose-50 rounded-3xl border border-rose-100"
            >
              <h4 className="text-rose-900 font-bold flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5" />
                Confusion Detected
              </h4>
              <p className="text-rose-800 text-sm mb-4 font-medium">{confusion.correction}</p>
              <div className="p-4 bg-white/50 rounded-xl text-xs text-rose-700 italic">
                "{confusion.feedback}"
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {selected && (
          <button
            onClick={next}
            className="mt-8 w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            Next Question
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function VivaView({ questions, onApiLimit }: { questions?: Question[]; onApiLimit?: (title?: string, message?: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [report, setReport] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  if (!questions || questions.length === 0) return <EmptyState />;

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(transcripts).length;

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    let finalTranscript = transcripts[currentIndex] || '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimText(interim);
      setTranscripts(prev => ({ ...prev, [currentIndex]: finalTranscript }));
    };
    recognition.onerror = (e: any) => { console.error('Speech error:', e); setIsRecording(false); };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
    setInterimText('');
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');
  };

  const evaluateViva = async () => {
    setIsEvaluating(true);
    setEvalError(null);
    try {
      const vivaData = questions.map((q, i) => ({
        question: q.question,
        spokenAnswer: transcripts[i] || '(No answer given)',
        expectedAnswer: q.answer,
      }));
      const result = await AIService.evaluateViva(vivaData);
      setReport(result);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "Viva evaluation reached limit. Please wait 60s.");
      } else {
        setEvalError(msg || 'Evaluation failed. Please try again.');
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  if (report) {
    const pct = report.maxScore > 0 ? Math.round((report.totalScore / report.maxScore) * 100) : 0;
    const gradeColor = pct >= 85 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : pct >= 50 ? 'text-orange-400' : 'text-rose-400';
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-4xl font-bold tracking-tight">Viva Report</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Your complete oral examination analysis.</p>
        </header>

        <div className="bg-[#1A1A1A] text-white p-12 rounded-[60px] text-center">
          <Mic className="w-12 h-12 mx-auto mb-4 text-white/40" />
          <div className={`text-7xl font-black mb-2 ${gradeColor}`}>{pct}%</div>
          <div className="text-white/60 text-lg mb-2">{report.totalScore} / {report.maxScore} points</div>
          <div className={`inline-block px-6 py-2 rounded-full text-sm font-bold mt-2 ${pct >= 70 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            {report.grade}
          </div>
          <p className="mt-6 max-w-md mx-auto text-white/70 italic text-sm">"{report.appreciation}"</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Question-by-Question Breakdown</h3>
          {report.evaluations.map((ev: any, i: number) => (
            <div key={i} className={`p-6 rounded-3xl border ${ev.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm shrink-0 ${ev.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {ev.score}/10
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold mb-1">Q{i + 1}: {ev.question}</p>
                  <p className="text-sm text-[#1A1A1A]/60 mb-3 italic">Your answer: "{ev.spokenAnswer}"</p>
                  <p className="text-sm font-medium mb-1">{ev.feedback}</p>
                  {!ev.isCorrect && (
                    <div className="mt-2 p-3 bg-white/70 rounded-xl text-xs text-[#1A1A1A]/70">
                      <span className="font-bold text-emerald-700">Correct answer: </span>{ev.correction}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {report.advice?.length > 0 && (
          <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Study Advice
            </h3>
            <div className="space-y-3">
              {report.advice.map((tip: string, i: number) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                  <p className="text-sm text-[#1A1A1A]/70 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => { setReport(null); setTranscripts({}); setCurrentIndex(0); }}
          className="mx-auto flex items-center gap-2 px-8 py-3 bg-[#1A1A1A] text-white rounded-full font-bold"
        >
          <Repeat className="w-4 h-4" /> Start New Viva
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Viva Simulator</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Speak your answers aloud. AI evaluates and gives a full report.</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Answered</div>
          <div className="text-2xl font-bold">{answeredCount} / {questions.length}</div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => { stopRecording(); setCurrentIndex(i); }}
            className={cn(
              'w-9 h-9 rounded-xl text-sm font-bold transition-all',
              i === currentIndex ? 'bg-[#1A1A1A] text-white' :
                transcripts[i] ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F5F5F0] text-[#1A1A1A]/40'
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="bg-white p-10 rounded-[40px] border border-[#1A1A1A]/10 shadow-sm space-y-8">
        <div>
          <span className="px-3 py-1 bg-[#F5F5F0] rounded-full text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <h3 className="text-2xl font-bold mt-4">{currentQ.question}</h3>
        </div>

        <div className="min-h-[80px] p-5 bg-[#F5F5F0] rounded-2xl text-sm leading-relaxed">
          {transcripts[currentIndex] ? (
            <span className="text-[#1A1A1A]/80">{transcripts[currentIndex]}</span>
          ) : (
            <span className="text-[#1A1A1A]/30 italic">Your spoken answer will appear here...</span>
          )}
          {interimText && <span className="text-[#1A1A1A]/40 italic"> {interimText}</span>}
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg',
              isRecording
                ? 'bg-rose-600 text-white shadow-rose-500/30 animate-pulse'
                : 'bg-[#1A1A1A] text-white hover:scale-105'
            )}
          >
            <Mic className="w-10 h-10" />
          </button>
          <p className="text-sm font-medium text-[#1A1A1A]/60">
            {isRecording ? '🔴 Recording... click to stop' : transcripts[currentIndex] ? 'Click to re-record' : 'Click mic to start speaking'}
          </p>
        </div>

        <div className="flex justify-between gap-4">
          <button
            onClick={() => { stopRecording(); setCurrentIndex(Math.max(0, currentIndex - 1)); }}
            disabled={currentIndex === 0}
            className="px-6 py-3 border border-[#1A1A1A]/10 rounded-full text-sm font-bold disabled:opacity-30"
          >
            Previous
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => { stopRecording(); setCurrentIndex(currentIndex + 1); }}
              className="px-6 py-3 bg-[#1A1A1A] text-white rounded-full text-sm font-bold"
            >
              Next Question →
            </button>
          ) : (
            <button
              onClick={evaluateViva}
              disabled={isEvaluating || answeredCount === 0}
              className="px-8 py-3 bg-emerald-600 text-white rounded-full text-sm font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
            >
              {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              {isEvaluating ? 'Evaluating...' : 'Finish & Get Report'}
            </button>
          )}
        </div>

        {evalError && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm">{evalError}</div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl text-sm text-amber-800 flex gap-3">
        <Zap className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
        <span>Answer all questions, then click <strong>Finish &amp; Get Report</strong>. Tap a number above to re-record any answer.</span>
      </div>
    </div>
  );
}


function ExamModeView({ inputText, examMCQs: preExamMCQs, onClear, onApiLimit }: {
  inputText: string;
  examMCQs?: MCQ[];
  onClear?: () => void;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [examError, setExamError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const startExam = async () => {
    if (!inputText && !preExamMCQs?.length) return;
    setLoading(true);
    setExamError(null);
    try {
      // Use pre-generated MCQs if available, otherwise fall back to API
      const questions = preExamMCQs && preExamMCQs.length > 0
        ? preExamMCQs
        : await AIService.generateMCQs(inputText, 15, 'Hard');
      if (!questions || questions.length === 0) throw new Error('No questions generated. Please try again.');
      setMcqs(questions);
      setIsActive(true);
      setTimeLeft(300);
      setSelectedAnswers({});
      setSubmitted(false);
      setScore(0);
    } catch (err: any) {
      console.error('Exam generation failed:', err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "Rate limit reached.");
      } else {
        setExamError(msg || 'Failed to generate exam questions. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsActive(false);
    let correct = 0;
    mcqs.forEach(q => {
      if (selectedAnswers[q.id] === q.answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);
    try {
      await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Exam Mode',
          accuracy: mcqs.length > 0 ? correct / mcqs.length : 0,
          time_spent: 300 - timeLeft
        })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!inputText) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-[#1A1A1A]/5 rounded-full flex items-center justify-center mb-6">
        <Zap className="w-8 h-8 text-amber-500" />
      </div>
      <h3 className="text-2xl font-bold">Load Your Content First</h3>
      <p className="mt-2 text-[#1A1A1A]/40 max-w-xs">Go to the <strong>Dashboard</strong> tab, paste or upload your study material, then click <strong>Generate Learning System</strong> before starting Exam Mode.</p>
    </div>
  );

  if (submitted && mcqs.length > 0) {
    const pct = Math.round((score / mcqs.length) * 100);
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-4xl font-bold tracking-tight">Exam Results</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Your performance breakdown for this session.</p>
        </header>
        <div className="bg-[#1A1A1A] text-white p-16 rounded-[60px] text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <div className="text-7xl font-black mb-2">{pct}%</div>
          <div className="text-white/60 text-lg mb-2">{score} correct out of {mcqs.length}</div>
          <div className={cn("inline-block px-4 py-1 rounded-full text-sm font-bold mt-2", pct >= 70 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
            {pct >= 90 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Needs Improvement' : 'Keep Practising'}
          </div>
          <button onClick={() => { setSubmitted(false); setMcqs([]); }}
            className="mt-10 px-10 py-4 bg-white text-[#1A1A1A] rounded-full font-bold hover:scale-105 transition-transform mx-auto flex items-center gap-2">
            <Zap className="w-4 h-4" /> Retake Exam
          </button>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Answer Review</h3>
          {mcqs.map((q, i) => {
            const userAns = selectedAnswers[q.id];
            const isCorrect = userAns === q.answer;
            return (
              <div key={q.id} className={cn("p-6 rounded-3xl border", isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100")}>
                <div className="flex items-start gap-4">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-sm", isCorrect ? "bg-emerald-500" : "bg-rose-500")}>{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-bold mb-2">{q.question}</p>
                    <p className="text-sm"><span className="font-bold">Your answer:</span> {userAns ? `${userAns}. ${q.options[userAns as keyof typeof q.options]}` : 'Not answered'}</p>
                    {!isCorrect && <p className="text-sm mt-1 text-emerald-700"><span className="font-bold">Correct:</span> {q.answer}. {q.options[q.answer as keyof typeof q.options]}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Exam Mode</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Time-pressured assessment environment.</p>
        </div>
        <div className="flex items-center gap-4">
          {onClear && !isActive && <button onClick={onClear} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
          <div className={cn(
            "px-8 py-4 rounded-2xl font-mono text-3xl font-bold border",
            timeLeft < 60 ? "bg-rose-50 text-rose-600 border-rose-100 animate-pulse" : "bg-white text-[#1A1A1A] border-[#1A1A1A]/10"
          )}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {!isActive ? (
        <div className="bg-[#1A1A1A] text-white p-16 rounded-[60px] text-center">
          <Zap className="w-16 h-16 mx-auto mb-6 text-emerald-400" />
          <h3 className="text-3xl font-bold mb-4">Ready for the Challenge?</h3>
          <p className="text-white/60 mb-10 max-w-md mx-auto">
            10 Hard Questions. 5 Minutes. No hints. No second chances.
            Your performance will be recorded in your permanent report.
          </p>
          {examError && (
            <div className="mb-6 mx-auto max-w-md bg-rose-500/20 border border-rose-400/30 rounded-2xl p-4 text-rose-200 text-sm">
              <strong className="block mb-1">Generation Failed</strong>
              {examError}
            </div>
          )}
          <button
            onClick={startExam}
            disabled={loading}
            className="px-12 py-4 bg-white text-[#1A1A1A] rounded-full font-bold text-lg hover:scale-105 transition-transform flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            {loading ? 'Generating Questions...' : examError ? 'Try Again' : 'Start Examination'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {mcqs.map((q, i) => (
            <div key={q.id} className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10">
              <h4 className="text-lg font-bold mb-6">{i + 1}. {q.question}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(q.options).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedAnswers(prev => ({ ...prev, [q.id]: key }))}
                    className={cn(
                      "p-4 rounded-2xl text-left text-sm font-medium border transition-all",
                      selectedAnswers[q.id] === key
                        ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                        : "bg-white border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30"
                    )}
                  >
                    <span className="font-bold mr-2">{key}.</span> {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleSubmit}
            className="w-full py-6 bg-emerald-600 text-white rounded-[32px] font-bold text-xl shadow-xl shadow-emerald-600/20"
          >
            Submit Examination
          </button>
        </div>
      )}
    </div>
  );
}


function DoubtGeneratorView({ text, preDoubts, onClear, onApiLimit }: {
  text: string;
  preDoubts?: string[];
  onClear?: () => void;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [doubts, setDoubts] = useState<string[]>(preDoubts || []);
  const [loading, setLoading] = useState(false);

  // Update if pre-generated data arrives
  React.useEffect(() => { if (preDoubts && preDoubts.length > 0) setDoubts(preDoubts); }, [preDoubts]);

  if (!text && !preDoubts?.length) return <EmptyState />;

  const generate = async () => {
    setLoading(true);
    try {
      const cacheKey = `doubt_cache_${simpleHash(text)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setDoubts(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const response = await AIService.generateDoubts(text);
      setDoubts(response);
      localStorage.setItem(cacheKey, JSON.stringify(response));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "Rate limit reached. Please wait a minute.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Doubt Generator</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Anticipate common pitfalls and confusing areas.</p>
        </div>
        {onClear && doubts.length > 0 && <button onClick={() => { setDoubts([]); onClear(); }} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      {!doubts.length ? (
        <div className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-amber-500" />
          <h3 className="text-xl font-bold mb-4">Generate Doubts</h3>
          <p className="text-[#1A1A1A]/60 mb-8 max-w-md mx-auto">We'll analyze the content to find where students usually get stuck.</p>
          <button
            onClick={generate}
            disabled={loading}
            className="px-10 py-4 bg-[#1A1A1A] text-white rounded-full font-bold flex items-center gap-2 mx-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Analyze Potential Doubts
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {doubts.map((doubt, i) => (
            <div key={i} className="bg-amber-50 p-8 rounded-3xl border border-amber-100 flex gap-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-lg shadow-amber-500/20">
                ?
              </div>
              <div>
                <h4 className="font-bold text-amber-900 mb-2">Common Pitfall #{i + 1}</h4>
                <p className="text-amber-800 text-sm leading-relaxed">{doubt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ onReset }: { onReset: () => void }) {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Settings</h2>
        <p className="mt-2 text-[#1A1A1A]/60">Customize your learning experience.</p>
      </header>

      <div className="bg-white p-10 rounded-[40px] border border-[#1A1A1A]/10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold">Brutal Feedback Mode</h4>
            <p className="text-xs text-[#1A1A1A]/40">Get direct, un-sugarcoated AI feedback on your mistakes.</p>
          </div>
          <button className="w-12 h-6 bg-emerald-500 rounded-full relative">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold">Minimal Focus Mode</h4>
            <p className="text-xs text-[#1A1A1A]/40">Hide all sidebar and navigation during quizzes.</p>
          </div>
          <button className="w-12 h-6 bg-[#1A1A1A]/10 rounded-full relative">
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
          </button>
        </div>

        <div className="pt-8 border-t border-[#1A1A1A]/5">
          <button
            onClick={onReset}
            className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold text-sm hover:bg-rose-100 transition-colors"
          >
            Reset All Progress Data
          </button>
        </div>
      </div>
    </div>
  );
}


function PredictorView({ syllabus, prePredictions, onClear, onApiLimit }: {
  syllabus: string;
  prePredictions?: any[];
  onClear?: () => void;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [predictions, setPredictions] = useState<any[]>(prePredictions || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownAnswers, setShownAnswers] = useState<Record<number, boolean>>({});

  // Update if pre-generated data arrives
  React.useEffect(() => { if (prePredictions && prePredictions.length > 0) setPredictions(prePredictions); }, [prePredictions]);

  if (!syllabus && !prePredictions?.length) return <EmptyState />;

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use a v2 cache key — different schema from old predictor
      const cacheKey = `predictor_v2_${simpleHash(syllabus)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length && parsed[0].marks) {
          setPredictions(parsed);
          setLoading(false);
          return;
        }
      }
      const res = await AIService.predictExamQuestions(syllabus);
      if (!res?.length) throw new Error('No questions generated. Please try again.');
      setPredictions(res);
      localStorage.setItem(cacheKey, JSON.stringify(res));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "Rate limit reached.");
      } else {
        setError(msg || 'Failed to generate predictions.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleAnswer = (idx: number) =>
    setShownAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));

  const probStyle: Record<string, string> = {
    High: 'bg-rose-100 text-rose-700 border-rose-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  // Group by marks value
  const markGroups: Record<number, { q: any; globalIdx: number }[]> = {};
  predictions.forEach((q, idx) => {
    const m = Number(q.marks) || 2;
    if (!markGroups[m]) markGroups[m] = [];
    markGroups[m].push({ q, globalIdx: idx });
  });
  const sortedMarks = Object.keys(markGroups).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Exam Predictor AI</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Predicted exam questions with model answers — grouped by marks.</p>
        </div>
        {onClear && predictions.length > 0 && <button onClick={() => { setPredictions([]); setShownAnswers({}); onClear(); }} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      {!predictions.length ? (
        <div className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 text-center">
          <Target className="w-16 h-16 mx-auto mb-6 text-[#1A1A1A]/20" />
          <h3 className="text-xl font-bold mb-2">Generate Predicted Questions</h3>
          <p className="text-[#1A1A1A]/60 mb-6 max-w-md mx-auto text-sm">
            AI will extract probable 2-mark, 5-mark, and 10-mark exam questions with complete model answers based on your study content.
          </p>
          {error && (
            <div className="mb-6 mx-auto max-w-md bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={handlePredict}
            disabled={loading}
            className="px-10 py-4 bg-[#1A1A1A] text-white rounded-full font-bold flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Generating Questions...' : error ? 'Try Again' : 'Start Prediction Engine'}
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {sortedMarks.map(mark => (
            <div key={mark}>
              {/* Mark group header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center font-black text-base shadow-lg">
                  {mark}M
                </div>
                <div>
                  <h3 className="text-xl font-bold">{mark}-Mark Questions</h3>
                  <p className="text-xs text-[#1A1A1A]/40 font-medium">{markGroups[mark].length} question{markGroups[mark].length !== 1 ? 's' : ''} predicted</p>
                </div>
              </div>

              <div className="space-y-4">
                {markGroups[mark].map(({ q, globalIdx }, i) => (
                  <div key={i} className="bg-white rounded-3xl border border-[#1A1A1A]/10 overflow-hidden shadow-sm">
                    <div className="p-7">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 bg-[#F5F5F0] px-3 py-1 rounded-full">
                          {q.topic}
                        </span>
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border',
                          probStyle[q.probability] || 'bg-gray-100 text-gray-600 border-gray-200'
                        )}>
                          {q.probability} Probability
                        </span>
                      </div>

                      {/* Question */}
                      <p className="font-bold text-base mb-5 leading-snug">{i + 1}. {q.question}</p>

                      {/* Toggle answer */}
                      <button
                        onClick={() => toggleAnswer(globalIdx)}
                        className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        {shownAnswers[globalIdx]
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                        {shownAnswers[globalIdx] ? 'Hide Answer' : 'Show Answer'}
                      </button>
                    </div>

                    {/* Answer panel */}
                    <AnimatePresence>
                      {shownAnswers[globalIdx] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-7 pb-7 pt-4 border-t border-[#1A1A1A]/5">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Model Answer</p>
                              <p className="text-sm text-[#1A1A1A]/80 leading-relaxed whitespace-pre-wrap">{q.answer}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => { setPredictions([]); setShownAnswers({}); }}
            className="text-xs font-bold text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:underline flex items-center gap-1 mx-auto transition-colors"
          >
            ← Regenerate Predictions
          </button>
        </div>
      )}
    </div>
  );
}

function ExportView({ data }: { data: any }) {
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("StudySnap AI - Learning Report", 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);

    if (data.summary) {
      doc.setFontSize(16);
      doc.text("Summary", 20, 50);
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(data.summary.detailed, 170);
      doc.text(splitText, 20, 60);
    }

    doc.save("studysnap-report.pdf");
  };

  const exportTXT = () => {
    const content = `
STUDYSNAP AI REPORT
===================
Generated: ${new Date().toLocaleString()}

SUMMARY:
${data.summary?.detailed || 'N/A'}

KEY POINTS:
${data.keyPoints?.join('\n') || 'N/A'}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studysnap-report.txt';
    a.click();
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Export System</h2>
        <p className="mt-2 text-[#1A1A1A]/60">Take your knowledge offline in multiple formats.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={exportPDF}
          className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 text-center hover:bg-[#1A1A1A] hover:text-white transition-all group"
        >
          <FileText className="w-16 h-16 mx-auto mb-6 text-[#1A1A1A]/20 group-hover:text-emerald-400 transition-colors" />
          <h3 className="text-xl font-bold">Download PDF</h3>
          <p className="text-sm opacity-60 mt-2">Formatted report with summaries and Q&A.</p>
        </button>

        <button
          onClick={exportTXT}
          className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 text-center hover:bg-[#1A1A1A] hover:text-white transition-all group"
        >
          <Edit3 className="w-16 h-16 mx-auto mb-6 text-[#1A1A1A]/20 group-hover:text-emerald-400 transition-colors" />
          <h3 className="text-xl font-bold">Download TXT</h3>
          <p className="text-sm opacity-60 mt-2">Raw text version for easy copy-pasting.</p>
        </button>
      </div>
    </div>
  );
}

function VisualExplainView({ text, preSteps, onClear, onApiLimit }: {
  text: string;
  preSteps?: { title: string; description: string }[];
  onClear?: () => void;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [steps, setSteps] = useState<any[]>(preSteps || []);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2000);
  const [loading, setLoading] = useState(false);

  // Update if pre-generated data arrives
  React.useEffect(() => { if (preSteps && preSteps.length > 0) { setSteps(preSteps); setCurrentStep(0); } }, [preSteps]);

  useEffect(() => {
    let interval: any;
    if (isPlaying && steps.length > 0) {
      interval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % steps.length);
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, steps, speed]);

  if (!text && !preSteps?.length) return <EmptyState />;

  const analyze = async () => {
    setLoading(true);
    try {
      const cacheKey = `visual_cache_${simpleHash(text)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setSteps(JSON.parse(cached));
        setCurrentStep(0);
        return;
      }

      const res = await AIService.generateVisualSteps(text);
      setSteps(res);
      setCurrentStep(0);
      localStorage.setItem(cacheKey, JSON.stringify(res));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "You've hit the Gemini rate limit. Please wait 60s.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Visual Explain</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Step-by-step animated visual breakdown.</p>
        </div>
        <div className="flex items-center gap-3">
          {onClear && steps.length > 0 && <button onClick={() => { setSteps([]); setIsPlaying(false); onClear(); }} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
          {steps.length > 0 && (
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-[#1A1A1A]/10">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 hover:bg-[#F5F5F0] rounded-xl transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <div className="flex items-center gap-2 px-2 border-l border-[#1A1A1A]/5">
                <FastForward className="w-4 h-4 text-[#1A1A1A]/40" />
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="text-xs font-bold bg-transparent outline-none"
                >
                  <option value={3000}>Slow</option>
                  <option value={2000}>Normal</option>
                  <option value={1000}>Fast</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </header>

      {!steps.length ? (
        <div className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 text-center">
          <Eye className="w-16 h-16 mx-auto mb-6 text-emerald-500" />
          <h3 className="text-xl font-bold mb-4">Generate Visual Breakdown</h3>
          <p className="text-[#1A1A1A]/60 mb-8 max-w-md mx-auto">We'll break down the concept into logical steps for an animated explanation.</p>
          <button
            onClick={analyze}
            disabled={loading}
            className="px-10 py-4 bg-[#1A1A1A] text-white rounded-full font-bold flex items-center gap-2 mx-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Start Visual Analysis
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 py-10">
          <div className="relative flex flex-col items-center gap-12 w-full max-w-2xl">
            {steps.map((step, i) => (
              <React.Fragment key={i}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: currentStep >= i ? 1 : 0.3,
                    scale: currentStep === i ? 1.05 : 1,
                    borderColor: currentStep === i ? '#10b981' : '#1A1A1A1a'
                  }}
                  className={cn(
                    "w-full bg-white p-8 rounded-3xl border-2 transition-all duration-500 shadow-sm relative z-10",
                    currentStep === i && "shadow-xl shadow-emerald-500/10"
                  )}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white transition-colors duration-500",
                      currentStep >= i ? "bg-emerald-500" : "bg-[#1A1A1A]/10"
                    )}>
                      {i + 1}
                    </div>
                    <h4 className="text-xl font-bold">{step.title}</h4>
                  </div>
                  <p className="text-[#1A1A1A]/60 leading-relaxed">{step.description}</p>
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-[#1A1A1A]/5" style={{
                    top: `${(i * 100 / steps.length) + (50 / steps.length)}%`,
                    height: '60px'
                  }}>
                    <motion.div
                      animate={{ height: currentStep > i ? '100%' : '0%' }}
                      className="w-full bg-emerald-500"
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  currentStep === i ? "bg-emerald-500 w-8" : "bg-[#1A1A1A]/10"
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConceptEvolutionView({ text, preEvolution, onClear, onApiLimit }: {
  text: string;
  preEvolution?: any[];
  onClear?: () => void;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [evolution, setEvolution] = useState<any[]>(preEvolution || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Update if pre-generated data arrives
  React.useEffect(() => { if (preEvolution && preEvolution.length > 0) { setEvolution(preEvolution); setCurrentIndex(0); } }, [preEvolution]);

  if (!text && !preEvolution?.length) return <EmptyState />;

  const analyze = async () => {
    setLoading(true);
    try {
      const cacheKey = `evolution_cache_${simpleHash(text)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setEvolution(JSON.parse(cached));
        setCurrentIndex(0);
        return;
      }

      const res = await AIService.generateConceptEvolution(text);
      setEvolution(res);
      setCurrentIndex(0);
      localStorage.setItem(cacheKey, JSON.stringify(res));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "Rate limit reached. Please wait a minute.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Concept Evolution</h2>
          <p className="mt-2 text-[#1A1A1A]/60">Historical progression and refinement of the concept.</p>
        </div>
        {onClear && evolution.length > 0 && <button onClick={() => { setEvolution([]); onClear(); }} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
      </header>

      {!evolution.length ? (
        <div className="bg-white p-12 rounded-[40px] border border-[#1A1A1A]/10 text-center">
          <History className="w-16 h-16 mx-auto mb-6 text-indigo-500" />
          <h3 className="text-xl font-bold mb-4">Trace Evolution</h3>
          <p className="text-[#1A1A1A]/60 mb-8 max-w-md mx-auto">We'll analyze how this concept evolved over time, from its origins to current understanding.</p>
          <button
            onClick={analyze}
            disabled={loading}
            className="px-10 py-4 bg-[#1A1A1A] text-white rounded-full font-bold flex items-center gap-2 mx-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Analyze Progression
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Horizontal Timeline */}
          <div className="relative" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
            {/* Center line */}
            <div className="absolute left-0 right-0 h-0.5 bg-[#1A1A1A]/5" style={{ top: '50%' }} />
            <div className="relative flex justify-between items-center px-4">
              {evolution.map((stage, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className="relative flex flex-col items-center group"
                >
                  {/* Alternating labels: even = above dot, odd = below */}
                  <div className={cn(
                    "absolute text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-all max-w-[80px] text-center leading-tight",
                    i % 2 === 0 ? 'bottom-[18px]' : 'top-[18px]',
                    currentIndex === i ? "text-indigo-600" : "text-[#1A1A1A]/40"
                  )}>
                    {stage.period}
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all duration-500 z-10 bg-white",
                    currentIndex === i ? "bg-indigo-600 border-indigo-600 scale-150" : "border-[#1A1A1A]/20 group-hover:border-indigo-400"
                  )} />
                </button>
              ))}
            </div>
          </div>

          {/* Content Panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-10 rounded-[40px] border border-[#1A1A1A]/10 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-10">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">{evolution[currentIndex].period}</div>
                  <h3 className="text-3xl font-bold mb-6">{evolution[currentIndex].concept}</h3>
                  <p className="text-[#1A1A1A]/70 leading-relaxed mb-8">{evolution[currentIndex].explanation}</p>

                  <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <h4 className="text-emerald-900 font-bold text-sm mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      What Changed?
                    </h4>
                    <p className="text-emerald-800 text-sm italic">"{evolution[currentIndex].change}"</p>
                  </div>
                </div>

                <div className="w-full md:w-64 shrink-0 space-y-4">
                  <div className="p-6 bg-[#F5F5F0] rounded-2xl border border-[#1A1A1A]/5">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-4">Progression</h5>
                    <div className="space-y-3">
                      {evolution.map((stage, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            i <= currentIndex ? "bg-indigo-600" : "bg-[#1A1A1A]/10"
                          )} />
                          <span className={cn(
                            "text-[10px] font-bold truncate",
                            i === currentIndex ? "text-indigo-600" : "text-[#1A1A1A]/40"
                          )}>{stage.concept}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 bg-[#1A1A1A]/5 rounded-full flex items-center justify-center mb-6">
        <FileText className="w-8 h-8 text-[#1A1A1A]/20" />
      </div>
      <h3 className="text-2xl font-bold">No Content Analyzed</h3>
      <p className="mt-2 text-[#1A1A1A]/40 max-w-xs">Please go to the Input tab and upload your study material to generate this view.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FEATURE 1: Previous Year Question Paper Analyzer
// ─────────────────────────────────────────────────────────────────
function PastPaperAnalyzerView({ onApiLimit }: { onApiLimit?: (title?: string, message?: string) => void }) {
  const [papersText, setPapersText] = useState('');
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'patterns' | 'topics' | 'concepts' | 'strategy'>('topics');
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList) => {
    const names: string[] = [];
    const texts: string[] = [];
    setLoading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      names.push(file.name);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const { text } = await res.json();
        texts.push(`\n--- ${file.name} ---\n${text}`);
      } catch {
        texts.push(`\n--- ${file.name} ---\n[Error reading file]`);
      }
    }
    setFileNames(prev => [...prev, ...names]);
    setPapersText(prev => prev + texts.join('\n'));
    setLoading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const analyze = async () => {
    if (!papersText) return;
    setLoading(true);
    try {
      const cacheKey = `pyq_cache_${simpleHash(papersText)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setAnalysis(JSON.parse(cached)); setLoading(false); return; }
      const result = await AIService.analyzePastPapers(papersText);
      setAnalysis(result);
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        onApiLimit?.('API Limit', "Question paper analysis reached limit. Please wait 60s.");
      }
    }
    finally { setLoading(false); }
  };

  const importanceColor: Record<string, string> = {
    High: 'bg-rose-100 text-rose-700 border-rose-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const sectionTabs = [
    { id: 'topics', label: 'Hot Topics', icon: TrendingUp },
    { id: 'patterns', label: 'Repeated Qs', icon: Repeat },
    { id: 'concepts', label: 'Freq. Map', icon: BarChart2 },
    { id: 'strategy', label: 'Strategy', icon: Star },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight">PYQ Analyzer</h2>
            <p className="text-[#1A1A1A]/60">Upload old papers — detect repeated patterns & hot topics.</p>
          </div>
        </div>
      </header>

      {!analysis ? (
        <div className="space-y-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "relative bg-white rounded-[40px] border-2 border-dashed transition-all p-12 text-center",
              isDragging ? "border-rose-500 bg-rose-50 scale-[1.01]" : "border-[#1A1A1A]/20 hover:border-rose-300"
            )}
          >
            <FileSearch className="w-16 h-16 mx-auto mb-6 text-rose-400" />
            <h3 className="text-2xl font-bold mb-2">Drop Question Papers Here</h3>
            <p className="text-[#1A1A1A]/50 mb-8">Upload multiple PDFs, DOCX, or TXT files at once</p>
            <label className="px-10 py-4 bg-rose-600 text-white rounded-full font-bold cursor-pointer hover:bg-rose-700 transition-colors inline-block">
              Browse Files
              <input type="file" multiple className="hidden" onChange={handleFileInput} accept=".pdf,.docx,.txt" />
            </label>
            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-[40px]">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-rose-500 mx-auto mb-3" />
                  <p className="font-bold">Extracting text from papers...</p>
                </div>
              </div>
            )}
          </div>

          {fileNames.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-[#1A1A1A]/10">
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider text-[#1A1A1A]/40">Papers Loaded ({fileNames.length})</h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {fileNames.map((name, i) => (
                  <span key={i} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-100 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> {name}
                  </span>
                ))}
              </div>
              <button onClick={analyze} disabled={loading}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors shadow-xl shadow-rose-600/20">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                Analyze All Papers for Patterns
              </button>
            </div>
          )}

          <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10">
            <h4 className="font-bold mb-3 flex items-center gap-2"><Edit3 className="w-4 h-4" /> Or Paste Questions Directly</h4>
            <textarea value={papersText} onChange={e => setPapersText(e.target.value)}
              placeholder="Paste questions from multiple years here (e.g. 2020: Q1... 2021: Q1...)"
              className="w-full h-32 p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-rose-300 resize-none text-sm"
            />
            {papersText && !fileNames.length && (
              <button onClick={analyze} disabled={loading}
                className="mt-4 px-8 py-3 bg-rose-600 text-white rounded-full font-bold flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Analyze Patterns
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex bg-white p-1 rounded-2xl border border-[#1A1A1A]/10 gap-1">
            {sectionTabs.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id as any)}
                className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  activeSection === s.id ? "bg-rose-600 text-white shadow" : "text-[#1A1A1A]/50 hover:text-[#1A1A1A]")}>
                <s.icon className="w-4 h-4" /> {s.label}
              </button>
            ))}
          </div>

          {activeSection === 'topics' && (
            <div className="space-y-4">
              {analysis.hotTopics?.map((t: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="bg-white p-6 rounded-3xl border border-[#1A1A1A]/10 flex gap-5 items-start">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0",
                    i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-[#F5F5F0]")}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h4 className="text-lg font-bold">{t.topic}</h4>
                      <span className={cn("px-3 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", importanceColor[t.importance] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                        {t.importance}
                      </span>
                      <span className="px-3 py-0.5 bg-[#F5F5F0] rounded-full text-[10px] font-bold text-[#1A1A1A]/50">Asked {t.frequency}×</span>
                    </div>
                    <p className="text-sm text-[#1A1A1A]/60 leading-relaxed">{t.tip}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {activeSection === 'patterns' && (
            <div className="space-y-4">
              {analysis.repeatedPatterns?.map((p: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="bg-white p-6 rounded-3xl border border-[#1A1A1A]/10">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <p className="font-bold text-base flex-1">{p.question}</p>
                    <div className={cn("shrink-0 px-4 py-2 rounded-full text-sm font-black",
                      p.frequency >= 3 ? "bg-rose-600 text-white" : p.frequency >= 2 ? "bg-amber-400 text-white" : "bg-[#F5F5F0] text-[#1A1A1A]")}>
                      ×{p.frequency}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.years?.map((y: string, j: number) => (
                      <span key={j} className="px-3 py-1 bg-[#F5F5F0] rounded-full text-xs font-bold border border-[#1A1A1A]/5">{y}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {activeSection === 'concepts' && (
            <div className="space-y-3">
              {analysis.conceptFrequency?.sort((a: any, b: any) => b.count - a.count).map((c: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="bg-white p-5 rounded-2xl border border-[#1A1A1A]/10">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="flex-1 font-bold">{c.concept}</span>
                    <span className="text-xs font-bold px-3 py-1 bg-[#F5F5F0] rounded-full text-[#1A1A1A]/50">{c.category}</span>
                    <span className="font-black text-rose-600">{c.count}×</span>
                  </div>
                  <div className="h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (c.count / (analysis.conceptFrequency[0]?.count || 1)) * 100)}%` }}
                      transition={{ delay: i * 0.05 + 0.2, duration: 0.6 }}
                      className="h-full bg-rose-500 rounded-full" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {activeSection === 'strategy' && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-[#1A1A1A]/40 uppercase tracking-widest">AI-Generated Exam Strategy 🎯</p>
              {analysis.examStrategy?.map((tip: string, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="bg-white p-6 rounded-3xl border border-[#1A1A1A]/10 flex gap-5 items-start">
                  <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-lg shadow-rose-600/20">
                    {i + 1}
                  </div>
                  <p className="font-medium text-[#1A1A1A]/80 leading-relaxed pt-1">{tip}</p>
                </motion.div>
              ))}
            </div>
          )}

          <button onClick={() => { setAnalysis(null); setPapersText(''); setFileNames([]); }}
            className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 mx-auto">
            ← Analyze More Papers
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FEATURE 2: Concept Linking Mode
// ─────────────────────────────────────────────────────────────────
function ConceptLinkingView({ text, preLinks, onClear, onApiLimit }: {
  text: string;
  preLinks?: {
    prerequisites: { name: string; reason: string; importance: string }[];
    relatedConcepts: { name: string; connection: string }[];
    leadsTo: { name: string; description: string }[];
    studyOrder: string[];
  };
  onClear?: () => void;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [topic, setTopic] = useState('');
  const [links, setLinks] = useState<any>(preLinks || null);
  const [loading, setLoading] = useState(false);
  const [apiLimitErr, setApiLimitErr] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('prerequisites');
  const [extractedTopics, setExtractedTopics] = useState<string[]>([]);

  // Derived display topic — use the typed topic, or the middle item in the studyOrder when showing preLinks
  const displayTopic = topic || (links?.studyOrder?.[Math.floor((links.studyOrder.length - 1) / 2)] ?? 'Analyzed from your notes');

  // Sync pre-generated data
  React.useEffect(() => { if (preLinks) setLinks(preLinks); }, [preLinks]);

  useEffect(() => {
    if (!text) return;
    const words = text.replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/).filter(w => w.length > 4);
    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w.toLowerCase()] = (freq[w.toLowerCase()] || 0) + 1; });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
    setExtractedTopics(sorted);
  }, [text]);

  if (!text && !preLinks) return <EmptyState />;

  const analyze = async (t?: string) => {
    const topicToSearch = t || topic;
    if (!topicToSearch.trim()) return;
    setTopic(topicToSearch);
    setLoading(true);
    setApiLimitErr(false);
    try {
      const cacheKey = `conceptlink_cache_${simpleHash(topicToSearch)}_${simpleHash(text || '')}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setLinks(JSON.parse(cached)); setLoading(false); return; }
      const result = await AIService.generateConceptLinks(topicToSearch, text || topicToSearch);
      setLinks(result);
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('resource_exhausted')) {
        setApiLimitErr(true);
        onApiLimit?.();
      } else {
        console.error(err);
      }
    }
    finally { setLoading(false); }
  };

  const importanceBadge: Record<string, string> = {
    Essential: 'bg-rose-100 text-rose-700',
    Helpful: 'bg-amber-100 text-amber-700',
    Optional: 'bg-emerald-100 text-emerald-700',
  };

  const sections: any[] = [
    {
      id: 'prerequisites', label: 'Prerequisites', desc: 'Know these BEFORE this topic', icon: ChevronLeft,
      items: links?.prerequisites,
      render: (item: any) => (
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
            <ChevronLeft className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold">{item.name}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", importanceBadge[item.importance] || 'bg-gray-100 text-gray-500')}>{item.importance}</span>
            </div>
            <p className="text-sm text-[#1A1A1A]/60">{item.reason}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'related', label: 'Related Concepts', desc: 'Parallel concepts that connect', icon: Link2,
      items: links?.relatedConcepts,
      render: (item: any) => (
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div><span className="font-bold">{item.name}</span><p className="text-sm text-[#1A1A1A]/60 mt-1">{item.connection}</p></div>
        </div>
      ),
    },
    {
      id: 'leadsTo', label: 'This Topic Unlocks', desc: 'Advanced topics this unlocks', icon: ChevronRight,
      items: links?.leadsTo,
      render: (item: any) => (
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <ChevronRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div><span className="font-bold">{item.name}</span><p className="text-sm text-[#1A1A1A]/60 mt-1">{item.description}</p></div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-bold tracking-tight">Concept Linker</h2>
              <p className="text-[#1A1A1A]/60">Prerequisite map — see what to know before &amp; what this unlocks.</p>
            </div>
            {onClear && links && <button onClick={() => { setLinks(null); onClear(); }} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-full text-xs font-bold hover:bg-rose-50 transition-colors">Clear</button>}
          </div>
        </div>
      </header>

      <div className="bg-white p-6 rounded-3xl border border-[#1A1A1A]/10 space-y-4">
        <div className="flex gap-3">
          <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="Type any concept from your notes..."
            className="flex-1 px-6 py-4 bg-[#F5F5F0] rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button onClick={() => analyze()} disabled={loading || !topic.trim()}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold disabled:opacity-40 hover:bg-indigo-700 transition-colors flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Map It
          </button>
        </div>
        {apiLimitErr && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">API rate limit reached. Please wait ~60s and try again.</p>
            <button onClick={() => setApiLimitErr(false)} className="ml-auto text-amber-400 hover:text-amber-600">✕</button>
          </div>
        )}
        {extractedTopics.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-wider mb-2">Quick pick from your notes:</p>
            <div className="flex flex-wrap gap-2">
              {extractedTopics.map((t, i) => (
                <button key={i} onClick={() => analyze(t)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white p-16 rounded-[40px] border border-[#1A1A1A]/10 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="font-bold text-lg">Mapping links for "<span className="text-indigo-600">{topic}</span>"...</p>
        </div>
      )}

      {links && !loading && (
        <div className="space-y-4">
          <div className="bg-indigo-600 text-white p-6 rounded-3xl flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Current Topic</p>
              <h3 className="text-2xl font-black">{displayTopic}</h3>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-3xl border border-[#1A1A1A]/10 overflow-hidden">
              <button onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full flex items-center gap-4 p-6 hover:bg-[#F5F5F0] transition-colors">
                <div className="w-10 h-10 rounded-2xl bg-[#F5F5F0] flex items-center justify-center shrink-0">
                  <section.icon className="w-5 h-5 text-[#1A1A1A]/50" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-bold">{section.label}</h4>
                  <p className="text-xs text-[#1A1A1A]/50">{section.desc}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-[#F5F5F0] rounded-full text-[#1A1A1A]/50 mr-2">
                  {section.items?.length || 0}
                </span>
                {expandedSection === section.id ? <ChevronUp className="w-5 h-5 text-[#1A1A1A]/30" /> : <ChevronDown className="w-5 h-5 text-[#1A1A1A]/30" />}
              </button>
              <AnimatePresence>
                {expandedSection === section.id && section.items?.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-6 pb-6 space-y-4 border-t border-[#1A1A1A]/5 pt-4">
                      {section.items.map((item: any, i: number) => <div key={i}>{section.render(item)}</div>)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {links.studyOrder?.length > 0 && (
            <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl">
              <h4 className="font-black text-lg mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" /> Recommended Study Order
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                {links.studyOrder.map((s: string, i: number) => (
                  <React.Fragment key={i}>
                    <span className={cn("px-4 py-2 rounded-full text-sm font-bold",
                      s.toLowerCase() === displayTopic.toLowerCase() ? "bg-indigo-500 text-white" : "bg-white/10 text-white/70")}>
                      {i + 1}. {s}
                    </span>
                    {i < links.studyOrder.length - 1 && <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => { setLinks(null); setTopic(''); }}
            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 mx-auto">
            ← Search Another Concept
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FEATURE 3: Audio Revision Mode (Web Speech API — 100% Free)
// ─────────────────────────────────────────────────────────────────
function AudioRevisionView({ text, summary, onApiLimit }: {
  text: string;
  summary?: any;
  onApiLimit?: (title?: string, message?: string) => void;
}) {
  const [script, setScript] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [speed, setSpeed] = useState(1.5);
  const [pitch, setPitch] = useState(1.0);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      setAvailableVoices(voices);
      if (voices.length) setVoice(prev => prev || voices[0]);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      speechSynthesis.cancel();
    };
  }, []);

  if (!text) return <EmptyState />;

  const generateScript = async () => {
    setLoading(true);
    setAudioError(null);
    try {
      const summaryText = summary?.medium || summary?.detailed || undefined;
      const cacheKey = `audio_cache_${simpleHash(text)}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.segments?.length > 0) { setScript(parsed); setLoading(false); return; }
      }
      const result = await AIService.generateAudioScript(text, summaryText);
      if (!result?.segments?.length) throw new Error('No audio segments generated. Please try again.');
      setScript(result);
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (err: any) {
      console.error('Audio script generation failed:', err);
      setAudioError(err.message || 'Failed to generate the audio script. Check your API key and internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const speakSegment = (index: number) => {
    if (!script || index >= script.segments.length) {
      setIsPlaying(false); setCurrentSegment(0); isSpeakingRef.current = false; return;
    }
    const seg = script.segments[index];
    setCurrentSegment(index);
    const utterance = new SpeechSynthesisUtterance(seg.text);
    utterance.rate = speed;
    utterance.pitch = pitch;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (!isSpeakingRef.current) return;
      setTimeout(() => { if (isSpeakingRef.current) speakSegment(index + 1); }, (seg.pause || 0.5) * 1000);
    };
    speechSynthesis.speak(utterance);
  };

  const handlePlay = () => { speechSynthesis.cancel(); isSpeakingRef.current = true; setIsPlaying(true); speakSegment(currentSegment); };
  const handlePause = () => { isSpeakingRef.current = false; setIsPlaying(false); speechSynthesis.cancel(); };
  const handleStop = () => { isSpeakingRef.current = false; setIsPlaying(false); setCurrentSegment(0); speechSynthesis.cancel(); };
  const jump = (idx: number) => {
    speechSynthesis.cancel();
    const next = Math.max(0, Math.min(idx, (script?.segments?.length || 1) - 1));
    setCurrentSegment(next);
    if (isPlaying) setTimeout(() => speakSegment(next), 150);
  };

  const segTypeStyle: Record<string, string> = {
    'intro': 'bg-indigo-100 text-indigo-700', 'topic': 'bg-emerald-100 text-emerald-700',
    'key-point': 'bg-rose-100 text-rose-700', 'example': 'bg-amber-100 text-amber-700',
    'recap': 'bg-purple-100 text-purple-700', 'outro': 'bg-[#F5F5F0] text-[#1A1A1A]/50',
  };
  const segTypeIcon: Record<string, string> = {
    'intro': '🎙️', 'topic': '📖', 'key-point': '⚡', 'example': '💡', 'recap': '🔁', 'outro': '🎤',
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-4xl font-bold tracking-tight">Audio Revision</h2>
            <p className="text-[#1A1A1A]/60">Podcast-style revision — powered by your browser's free speech engine.</p>
          </div>
        </div>
      </header>

      {!script ? (
        <div className="bg-white p-16 rounded-[60px] border border-[#1A1A1A]/10 text-center space-y-8">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-30" />
            <div className="relative w-32 h-32 bg-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-600/30">
              <Radio className="w-16 h-16 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black mb-3">Convert to Podcast</h3>
            <p className="text-[#1A1A1A]/50 max-w-md mx-auto">AI rewrites your notes into an engaging revision podcast, then reads it aloud at 1.5× using Web Speech API — 100% free.</p>
          </div>
          {audioError && (
            <div className="mx-auto max-w-md bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm text-left">
              <strong className="block mb-1">Generation Failed</strong>
              {audioError}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#1A1A1A]/40 font-medium">
            <span className="flex items-center gap-1"><Headphones className="w-4 h-4 text-purple-500" /> Podcast Style</span>
            <span className="flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500" /> 1.5× Speed</span>
            <span className="flex items-center gap-1"><Volume2 className="w-4 h-4 text-emerald-500" /> 100% Free</span>
          </div>
          <button onClick={generateScript} disabled={loading}
            className="px-12 py-5 bg-purple-600 text-white rounded-full font-bold text-lg hover:bg-purple-700 transition-all hover:scale-105 flex items-center gap-3 mx-auto shadow-xl shadow-purple-600/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Radio className="w-6 h-6" />}
            {loading ? 'Generating Script...' : audioError ? 'Try Again' : 'Generate Podcast Script'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] text-white p-8 rounded-[40px] space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center shrink-0">
                <Radio className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Now Playing</p>
                <h3 className="font-black text-xl truncate">{script.title}</h3>
                <p className="text-white/40 text-sm">{script.segments?.length} segments</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/40 font-bold mb-2">
                <span>Segment {currentSegment + 1} / {script.segments?.length}</span>
                <span>{Math.round(((currentSegment + 1) / script.segments?.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div animate={{ width: `${((currentSegment + 1) / script.segments?.length) * 100}%` }}
                  className="h-full bg-purple-500 rounded-full" transition={{ duration: 0.3 }} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button onClick={() => jump(currentSegment - 1)}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <SkipBack className="w-5 h-5" />
              </button>
              <button onClick={isPlaying ? handlePause : handlePlay}
                className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center hover:bg-purple-500 transition-all hover:scale-105 shadow-xl shadow-purple-600/40">
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
              <button onClick={() => jump(currentSegment + 1)}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Speed</p>
                <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
                  className="w-full bg-transparent text-white text-sm font-bold outline-none">
                  <option value={0.75} className="text-black">0.75×</option>
                  <option value={1.0} className="text-black">1.0×</option>
                  <option value={1.25} className="text-black">1.25×</option>
                  <option value={1.5} className="text-black">1.5× ✓</option>
                  <option value={2.0} className="text-black">2.0×</option>
                </select>
              </div>
              <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Pitch</p>
                <select value={pitch} onChange={e => setPitch(Number(e.target.value))}
                  className="w-full bg-transparent text-white text-sm font-bold outline-none">
                  <option value={0.8} className="text-black">Low</option>
                  <option value={1.0} className="text-black">Normal</option>
                  <option value={1.2} className="text-black">High</option>
                </select>
              </div>
              <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Voice</p>
                <select value={voice?.name || ''} onChange={e => setVoice(availableVoices.find(v => v.name === e.target.value) || null)}
                  className="w-full bg-transparent text-white text-sm font-bold outline-none">
                  {availableVoices.map(v => (
                    <option key={v.name} value={v.name} className="text-black">{v.name.split(' ')[0]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Script Transcript</p>
              <button onClick={handleStop} className="text-xs font-bold text-rose-500 hover:underline">Stop & Reset</button>
            </div>
            {script.segments?.map((seg: any, i: number) => (
              <motion.div key={i}
                animate={{ borderColor: currentSegment === i ? '#7c3aed' : 'rgba(26,26,26,0.1)', backgroundColor: currentSegment === i ? '#faf5ff' : '#ffffff' }}
                onClick={() => jump(i)}
                className="bg-white p-5 rounded-2xl border-2 cursor-pointer hover:border-purple-200 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-xl bg-[#F5F5F0] flex items-center justify-center text-lg shrink-0 mt-0.5">
                  {segTypeIcon[seg.type] || '🎙️'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 inline-block", segTypeStyle[seg.type] || 'bg-gray-100 text-gray-500')}>
                    {seg.type}
                  </span>
                  <p className={cn("text-sm leading-relaxed", currentSegment === i ? "font-bold text-purple-900" : "text-[#1A1A1A]/70")}>
                    {seg.text}
                  </p>
                </div>
                {currentSegment === i && isPlaying && (
                  <div className="flex gap-1 items-center mt-2 shrink-0">
                    {[0, 1, 2].map(j => (
                      <motion.div key={j} className="w-1.5 h-4 bg-purple-500 rounded-full"
                        animate={{ scaleY: [1, 2, 0.5, 1.5, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: j * 0.15 }} />
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <button onClick={() => { setScript(null); setCurrentSegment(0); handleStop(); }}
            className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 mx-auto">
            ← Regenerate Script
          </button>
        </div>
      )}
    </div>
  );
}
