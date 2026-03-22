
"use client";
import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, MessageSquareQuote, FileQuestion, Download, X, Send, ArrowRight, ArrowLeft, BookOpen, Edit2, RotateCcw, LogOut, Library, List, Network, BookA } from "lucide-react";
import BookCard from './BookCard';
import { ShimmerBlock } from '../Common/Shimmer';
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";

import Header from "../Layout/Header/Header";
import './ai-tutor.css';

// ── Backend configuration ──────────────────────────────────────────────────────
const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_TUTOR_API) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_TUTOR_API) ||
  'http://localhost:8000';

/**
 * Returns the current auth token for FastAPI requests.
 */
function getAuthToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ai_tutor_token');
  }
  return null;
}

export default function AITutorMain() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [topic, setTopic] = useState("");
  const [lessonSource, setLessonSource] = useState("ai");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [learningMode, setLearningMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [page, setPage] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadOption, setDownloadOption] = useState("content"); // 'content' or 'chat'
  
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [currentSummary, setCurrentSummary] = useState([]);
  
  const [mindmapModalOpen, setMindmapModalOpen] = useState(false);
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [currentMindmap, setCurrentMindmap] = useState("");
  
  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [currentVocab, setCurrentVocab] = useState([]);

  const [mcqModalOpen, setMcqModalOpen] = useState(false);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [mcqGenerating, setMcqGenerating] = useState(false);
  const [currentMcqs, setCurrentMcqs] = useState([]);
  const [selectedMcqOption, setSelectedMcqOption] = useState("");
  const [mcqAnswered, setMcqAnswered] = useState(false);

  const [questionAnswerModalOpen, setQuestionAnswerModalOpen] = useState(false);
  const [questionAnswerLoading, setQuestionAnswerLoading] = useState(false);
  const [currentQuestionAnswers, setCurrentQuestionAnswers] = useState([]);
  
  const [lessonVibe, setLessonVibe] = useState("Thinker");
  const [customVibe, setCustomVibe] = useState("");
  const [bookSize, setBookSize] = useState("small");

  // Dynamic Data State
  const [lessonId, setLessonId] = useState(null);
  const [curriculum, setCurriculum] = useState([]); // Array of strings (titles)
  const [chapterData, setChapterData] = useState({}); // Map: index -> { title, content, chatHistory }
  const [chapterLoadingMap, setChapterLoadingMap] = useState({}); // Map: index -> boolean
  const [loading, setLoading] = useState(false); // General loading
  const [generateError, setGenerateError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  const [myLessons, setMyLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);

  const chatEndRef = useRef(null);

  const formatLessonDate = (dateValue) => {
    return new Date(dateValue).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getChapterCountForSize = (size) => {
    if (size === "medium") return 10;
    if (size === "long") return 15;
    return 5;
  };

  // Auth & URL Parsing logic
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      
      if (tokenFromUrl) {
        localStorage.setItem('ai_tutor_token', tokenFromUrl);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsAuthenticated(true);
      } else {
        const existingToken = localStorage.getItem('ai_tutor_token');
        if (existingToken) {
           setIsAuthenticated(true);
        }
      }
    }
  }, []);

  const handleLogin = () => {
      // Force through localhost:3000 proxy down to the backend so the origin matches the Google whitelist
      window.location.href = `/api/auth/login`;
  };

  const handleLogout = () => {
      localStorage.removeItem('ai_tutor_token');
      setIsAuthenticated(false);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadedFile(file);
    setUploadStatus(null);
  };

  const handleUploadFile = async () => {
    if (!uploadedFile) return;

    setUploadingFile(true);
    setGenerateError("");
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/upload-file`, {
        method: "POST",
        headers: {
          ...(getAuthToken() && { Authorization: `Bearer ${getAuthToken()}` })
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to upload file.");

      setUploadStatus({
        type: "success",
        message: `Uploaded to ${data.path}`
      });
    } catch (err) {
      console.error("Failed to upload file", err);
      setUploadStatus({
        type: "error",
        message: err?.message || "Failed to upload file."
      });
    } finally {
      setUploadingFile(false);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chapterData, page, chatOpen, chatLoading]);

  // Fetch Lessons on Mount
  useEffect(() => {
    if (isAuthenticated) {
        fetchLessons();
    }
  }, [isAuthenticated]);

  const fetchLessons = async () => {
    setLessonsLoading(true);
    try {
        const res = await fetch(`${BACKEND_URL}/api/ai-tutor/my-lessons`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        if (res.ok) {
            setMyLessons(await res.json());
        } else if (res.status === 401) {
            handleLogout();
        }
    } catch (e) {
        console.error("Failed to fetch lessons", e);
    } finally {
        setLessonsLoading(false);
    }
  };

  // Generate Curriculum
  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setGenerateError("");
    setCurriculum([]);
    setChapterData({});
    setChapterLoadingMap({});
    try {
        const res = await fetch(`${BACKEND_URL}/api/ai-tutor/curriculum`, {
            method: 'POST',
            body: JSON.stringify({
              topic,
              vibe: lessonVibe,
              custom_vibe: customVibe,
              chapter_count: getChapterCountForSize(bookSize),
            }),
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        // Check content type before parsing
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server returned non-JSON response. Please check logs.");
        }

        const data = await res.json();
        
        if (!res.ok) {
            const parsedError = typeof data?.error === "string"
              ? data.error
              : "Failed to generate curriculum. Please try again.";
            throw new Error(parsedError);
        }

        if (data.lesson_id || data.lessonId) {
            setLessonId(data.lesson_id || data.lessonId);
            setCurriculum(data.curriculum);
            setGenerated(true);
            fetchLessons(); // Refresh list
        } else {
            throw new Error("Curriculum generation failed. Please try again.");
        }
    } catch (err) {
        console.error("Failed to generate curriculum", err);
        setGenerateError(err?.message || "Failed to generate curriculum. Please check your OpenAI API Key.");
    } finally {
        setLoading(false);
    }
  };

  // Fetch Chapter Content
  const fetchChapter = async (index, isBackground = false) => {
      // If already has content, don't fetch
      if (chapterData[index]?.content) return;
      if (chapterLoadingMap[index]) return;
      if (index >= curriculum.length) return;

      setChapterLoadingMap(prev => ({ ...prev, [index]: true }));
      if (!isBackground) setLoading(true);
      try {
          const res = await fetch(`${BACKEND_URL}/api/ai-tutor/chapter`, {
              method: 'POST',
              body: JSON.stringify({ lesson_id: lessonId, chapter_index: index }),
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getAuthToken()}`
              }
          });
          const data = await res.json();
          
          if (!res.ok) return;

          setChapterData(prev => ({
              ...prev,
              [index]: {
                  title: data.title,
                  content: data.content,
                  chatHistory: data.chat_history || data.chatHistory || []
              }
          }));
      } catch (err) {
          console.error("Failed to fetch chapter", err);
      } finally {
          setChapterLoadingMap(prev => ({ ...prev, [index]: false }));
          if (!isBackground) setLoading(false);
      }
  };

  const handleStartLearning = async () => {
    setLearningMode(true);
    setPage(0);
    // Preload first two chapter pages so first navigation feels immediate.
    fetchChapter(0, true);
    fetchChapter(1, true);
  };

  const handleNextPage = () => {
      const totalPages = curriculum.length + 1; // page 0 = curriculum
      setPage((prevPage) => {
        if (prevPage >= totalPages - 1) return prevPage;
        const nextPageValue = prevPage + 1;
        const chapterIndex = nextPageValue - 1;

        if (chapterIndex >= 0) {
          fetchChapter(chapterIndex, true);
        }

        // Keep two pages preloaded ahead while reading.
        fetchChapter(nextPageValue, true);
        fetchChapter(nextPageValue + 1, true);

        return nextPageValue;
      });
  };

  const handlePrevPage = () => {
      if (page > 0) {
          setPage(page - 1);
      }
  };

  useEffect(() => {
    if (!learningMode || curriculum.length === 0) return;
    const firstPrefetchIndex = Math.max(page, 0);
    fetchChapter(firstPrefetchIndex, true);
    fetchChapter(firstPrefetchIndex + 1, true);
  }, [learningMode, page, curriculum.length]);

  const handleLoadLesson = async (id) => {
    setLoading(true);
    setCurriculum([]);
    setChapterData({});
    setChapterLoadingMap({});
    try {
        const res = await fetch(`${BACKEND_URL}/api/ai-tutor/get-lesson?id=${id}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        
        setLessonId(data._id);
        setTopic(data.topic);
        setLessonVibe(data.vibe);
        setCurriculum(data.curriculum);
        if (data.curriculum?.length === 10) setBookSize("medium");
        else if (data.curriculum?.length === 15) setBookSize("long");
        else setBookSize("small");
        
        const loadedChapters = {};
        if (data.chapters) {
            data.chapters.forEach((ch) => {
                const currIdx = data.curriculum.indexOf(ch.title);
                if (currIdx !== -1) {
                    loadedChapters[currIdx] = {
                        title: ch.title,
                        content: ch.content,
                        chatHistory: ch.chat_history || ch.chatHistory || []
                    };
                }
            });
        }
        setChapterData(loadedChapters);
        setChapterLoadingMap({});
        setGenerated(true);
        setLearningMode(false);
        setPage(0);
        setChatOpen(false);
    } catch (e) {
        console.error(e);
        alert("Failed to load lesson.");
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteLesson = async (e, id) => {
      e.stopPropagation();
      if (!confirm("Delete this lesson?")) return;
      try {
          await fetch(`${BACKEND_URL}/api/ai-tutor/my-lessons?id=${id}`, { 
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${getAuthToken()}` }
          });
          setMyLessons(prev => prev.filter(l => l._id !== id));
      } catch (e) { console.error(e); }
  };

  // Chat Logic
  const handleChatSubmit = async () => {
      if (!chatMessage.trim()) return;
      const chapterIndex = page - 1;
      if (chapterIndex < 0) return;

      const currentChapter = chapterData[chapterIndex];
      if (!currentChapter?.title) return;
      const userMsg = { role: 'user', content: chatMessage };
      
      // Optimistic update
      setChapterData(prev => ({
          ...prev,
          [chapterIndex]: {
              ...prev[chapterIndex],
              chatHistory: [...(prev[chapterIndex]?.chatHistory || []), userMsg]
          }
      }));
      setChatMessage("");
      setChatLoading(true);

      try {
          const res = await fetch(`${BACKEND_URL}/api/ai-tutor/chat`, {
              method: 'POST',
              body: JSON.stringify({ 
                  lesson_id: lessonId, 
                  chapter_title: currentChapter.title, 
                  message: userMsg.content 
              }),
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${getAuthToken()}`
              }
          });
          const data = await res.json();
          
          setChapterData(prev => ({
              ...prev,
              [chapterIndex]: {
                  ...prev[chapterIndex],
                  chatHistory: [...(prev[chapterIndex]?.chatHistory || []), { role: 'assistant', content: data.content }]
              }
          }));
      } catch (err) {
          console.error("Chat Failed", err);
          // could undo optimistic update here
      } finally {
          setChatLoading(false);
      }
  };

  // PDF Download Logic
  const handleDownload = async () => {
      setDownloadModalOpen(false);
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 25;
      const marginRight = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      const bottomMargin = 25;
      const maxY = pageHeight - bottomMargin;
      
      let yPos = 30;

      // Helper: check if we need a new page
      const checkPageBreak = (neededHeight) => {
        if (yPos + neededHeight > maxY) {
          doc.addPage();
          yPos = 25;
          return true;
        }
        return false;
      };

      // Helper: render wrapped text and advance yPos
      const renderText = (text, fontSize, lineHeight = 1.4, color = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, contentWidth);
        const lineSpacing = fontSize * 0.353 * lineHeight; // mm per line
        lines.forEach(line => {
          checkPageBreak(lineSpacing + 2);
          doc.text(line, marginLeft, yPos);
          yPos += lineSpacing;
        });
      };

      // Helper: strip HTML to clean text, preserving structure
      const htmlToText = (html) => {
        if (!html) return '';
        return html
          .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n')
          .replace(/<li[^>]*>(.*?)<\/li>/gi, '  • $1\n')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?(ul|ol|div|section|article|blockquote|pre|code|span|strong|em|b|i|a|table|tr|td|th|thead|tbody)[^>]*>/gi, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#039;/gi, "'")
          .replace(/<[^>]+>/g, '') // catch any remaining tags
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      };

      // ===== COVER PAGE =====
      yPos = 60;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(40, 40, 40);
      const titleLines = doc.splitTextToSize(topic || "AI Lesson", contentWidth);
      titleLines.forEach(line => {
        doc.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;
      });
      
      yPos += 8;
      doc.setDrawColor(160, 140, 110);
      doc.setLineWidth(0.5);
      doc.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos);
      yPos += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(`${lessonVibe === 'Custom' ? customVibe : lessonVibe} Mode`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      doc.setFontSize(11);
      doc.text(`Generated by AI Tutor`, pageWidth / 2, yPos, { align: 'center' });

      // ===== CURRICULUM PAGE =====
      doc.addPage();
      yPos = 30;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("Table of Contents", marginLeft, yPos);
      yPos += 6;
      doc.setDrawColor(160, 140, 110);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, yPos, marginLeft + 50, yPos);
      yPos += 12;

      doc.setFont('helvetica', 'normal');
      curriculum.forEach((item, idx) => {
        const line = `${idx + 1}.  ${item}`;
        renderText(line, 11, 1.6, [60, 60, 60]);
        yPos += 2; // extra gap between items
      });

      // ===== CHAPTER PAGES =====
      const chapterIndices = Object.keys(chapterData).map(Number).sort((a, b) => a - b);
      
      for (const idx of chapterIndices) {
          const chapter = chapterData[idx];
          doc.addPage();
          yPos = 30;

          // Chapter header
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(140, 140, 140);
          doc.text(`CHAPTER ${idx + 1}`, marginLeft, yPos);
          yPos += 8;

          doc.setFontSize(18);
          doc.setTextColor(40, 40, 40);
          const chTitleLines = doc.splitTextToSize(chapter.title, contentWidth);
          chTitleLines.forEach(line => {
            doc.text(line, marginLeft, yPos);
            yPos += 8;
          });
          
          yPos += 2;
          doc.setDrawColor(180, 160, 130);
          doc.setLineWidth(0.3);
          doc.line(marginLeft, yPos, marginLeft + 40, yPos);
          yPos += 10;

          // Chapter content as clean text
          const textContent = htmlToText(chapter.content);
          const paragraphs = textContent.split(/\n\n+/);

          doc.setFont('helvetica', 'normal');
          for (const paragraph of paragraphs) {
            const trimmed = paragraph.trim();
            if (!trimmed) continue;

            // Check if it looks like a heading (short, no bullet)
            if (trimmed.length < 60 && !trimmed.startsWith('•') && !trimmed.startsWith('-')) {
              yPos += 3;
              doc.setFont('helvetica', 'bold');
              renderText(trimmed, 12, 1.5, [50, 50, 50]);
              doc.setFont('helvetica', 'normal');
              yPos += 1;
            } else {
              renderText(trimmed, 10.5, 1.5, [60, 60, 60]);
              yPos += 3;
            }
          }
          
          // Optional Chat Log
          if (downloadOption === 'chat' && chapter.chatHistory?.length > 0) {
              yPos += 8;
              checkPageBreak(20);
              
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(13);
              doc.setTextColor(80, 80, 80);
              doc.text("💬 Discussion", marginLeft, yPos);
              yPos += 4;
              doc.setDrawColor(200, 200, 200);
              doc.line(marginLeft, yPos, marginLeft + 30, yPos);
              yPos += 8;
              
              doc.setFont('helvetica', 'normal');
              chapter.chatHistory.forEach(msg => {
                  const role = msg.role === 'user' ? "You" : "AI Tutor";
                  const roleColor = msg.role === 'user' ? [40, 80, 160] : [60, 120, 80];
                  const textColor = msg.role === 'user' ? [50, 50, 50] : [40, 40, 40];
                  
                  checkPageBreak(12);
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(9);
                  doc.setTextColor(...roleColor);
                  doc.text(role, marginLeft, yPos);
                  yPos += 5;
                  
                  doc.setFont('helvetica', 'normal');
                  renderText(msg.content, 10, 1.4, textColor);
                  yPos += 4;
              });
          }
      }

      // Add page numbers
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(180, 180, 180);
        doc.text(`${i - 1}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
      }

      // Save with proper .pdf filename
      const safeTitle = (topic || 'AI Lesson').trim();
      doc.save(`${safeTitle}.pdf`);
  };

  const handleApplySuggestion = async () => {
    if (!lessonId || !suggestion.trim()) return;
    setLoading(true);
    setGenerateError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/refine-curriculum`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          suggestion,
          chapter_count: curriculum.length || getChapterCountForSize(bookSize),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Failed to refine curriculum");

      setCurriculum(data.curriculum || []);
      setChapterData({});
      setChapterLoadingMap({});
      setPage(0);
      setLearningMode(false);
      setChatOpen(false);
      setModalOpen(false);
      setSuggestion("");
      fetchLessons();
    } catch (err) {
      console.error("Failed to refine curriculum", err);
      setGenerateError(err?.message || "Failed to refine curriculum");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (isCurriculumPage) return;
    const token = getAuthToken();
    const currentChapter = chapterData[page - 1]; // active chapter
    if (!currentChapter?.title) return;

    setSummaryModalOpen(true);
    setSummaryLoading(true);
    setCurrentSummary([]);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          chapter_title: currentChapter.title
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate summary");
      
      setCurrentSummary(data.bullets || []);
    } catch (err) {
      console.error(err);
      setCurrentSummary(["Failed to load summary."]);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleMindmap = async () => {
    if (isCurriculumPage) return;
    const token = getAuthToken();
    const currentChapter = chapterData[page - 1];
    if (!currentChapter?.title) return;

    setMindmapModalOpen(true);
    setMindmapLoading(true);
    setCurrentMindmap("");
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/mindmap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          chapter_title: currentChapter.title
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate mindmap");
      
      setCurrentMindmap(data.tree || "");
    } catch (err) {
      console.error(err);
      setCurrentMindmap("Failed to load mindmap.");
    } finally {
      setMindmapLoading(false);
    }
  };

  const handleVocab = async () => {
    if (isCurriculumPage) return;
    const token = getAuthToken();
    const currentChapter = chapterData[page - 1];
    if (!currentChapter?.title) return;

    setVocabModalOpen(true);
    setVocabLoading(true);
    setCurrentVocab([]);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/vocab`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          chapter_title: currentChapter.title
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to extract vocab");
      
      setCurrentVocab(data.vocab || []);
    } catch (err) {
      console.error(err);
      setCurrentVocab([{ word: "Error", definition: "Failed to load vocabulary." }]);
    } finally {
      setVocabLoading(false);
    }
  };

  const handleMcq = async () => {
    if (isCurriculumPage) return;
    const currentChapter = chapterData[page - 1];
    if (!currentChapter?.title) return;

    setMcqModalOpen(true);
    setMcqLoading(true);
    setCurrentMcqs([]);
    setSelectedMcqOption("");
    setMcqAnswered(false);
    await handleGenerateMcq(currentChapter.title, { isInitialLoad: true });
  };

  const handleGenerateMcq = async (chapterTitleOverride = null, options = {}) => {
    if (isCurriculumPage) return;
    const token = getAuthToken();
    const currentChapter = chapterData[page - 1];
    const chapterTitle = chapterTitleOverride || currentChapter?.title;
    if (!chapterTitle) return;
    const { isInitialLoad = false } = options;

    setMcqGenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/mcq`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          chapter_title: chapterTitle
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate MCQ");

      if (data.mcq) {
        setCurrentMcqs([data.mcq]);
        setSelectedMcqOption("");
        setMcqAnswered(false);
      }
    } catch (err) {
      console.error(err);
      if (isInitialLoad) {
        setCurrentMcqs([
          {
            question: "Error",
            options: [],
            answer: "",
            explanation: "Failed to generate MCQ for this chapter."
          }
        ]);
        setSelectedMcqOption("");
        setMcqAnswered(false);
      }
    } finally {
      if (isInitialLoad) {
        setMcqLoading(false);
      }
      setMcqGenerating(false);
    }
  };

  const handleMcqOptionSelect = (option) => {
    if (mcqAnswered) return;
    setSelectedMcqOption(option);
    setMcqAnswered(true);
  };

  const handleQuestionAnswer = async () => {
    if (isCurriculumPage) return;
    const token = getAuthToken();
    const currentChapter = chapterData[page - 1];
    if (!currentChapter?.title) return;

    setQuestionAnswerModalOpen(true);
    setQuestionAnswerLoading(true);
    setCurrentQuestionAnswers([]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai-tutor/question-answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          chapter_title: currentChapter.title
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate Q&A");

      setCurrentQuestionAnswers(data.question_answers || []);
    } catch (err) {
      console.error(err);
      setCurrentQuestionAnswers([
        { question: "Error", answer: "Failed to load page questions and answers." }
      ]);
    } finally {
      setQuestionAnswerLoading(false);
    }
  };

  const handleBack = () => {
    if (learningMode) {
      setChatOpen(false);
      setLearningMode(false);
      return;
    }

    if (generated) {
      setGenerated(false);
      setChatOpen(false);
      return;
    }

    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    }
  };

  const totalBookPages = curriculum.length + 1; // curriculum page + chapter pages
  const isCurriculumPage = page === 0;
  const activeChapterIndex = page - 1;
  const activeChapter = activeChapterIndex >= 0 ? chapterData[activeChapterIndex] : null;
  const nextPage = page + 1;
  const nextChapterIndex = nextPage - 1;
  const isLastPage = page >= totalBookPages - 1;
  const isNextChapterLoading = nextChapterIndex >= 0 && !!chapterLoadingMap[nextChapterIndex];
  const disableNext = isLastPage;


  if (!isAuthenticated) {
      return (
        <div className="ai-tutor-container ai-tutor-main-padding d-flex align-items-center justify-content-center" style={{minHeight: '100vh', flexDirection: 'column'}}>
            <BookOpen size={64} className="text-primary mb-4" />
            <h2 className="text-3xl text-gray-800 font-bold mb-2">Welcome to AI Tutor</h2>
            <p className="text-gray-500 mb-8 max-w-md text-center">Your personal, AI-powered learning environment. Sign in to generate custom curriculum and interactive books.</p>
            <button onClick={handleLogin} className="ai-btn" style={{width: 'auto', padding: '12px 32px', fontSize: '18px'}}>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
            </button>
        </div>
      );
  }

  return (
    <>
    {!learningMode && <Header />}
    <div className={`ai-tutor-container ${!learningMode ? 'ai-tutor-main-padding' : 'ai-tutor-learning-padding'}`}>
      <AnimatePresence mode="wait">
        {!learningMode ? (
          <motion.div
            key="config-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="ai-card"
          >
            {generated && (
              <button onClick={handleBack} className="ai-back-btn">
                <ArrowLeft size={18} className="mr-1" />
                Back
              </button>
            )}
            <div className="text-center mb-6">
              <div className="d-flex justify-content-center mb-4">
                  <div style={{width: '60px', height: '60px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'}}>
                      <BookOpen size={32} />
                  </div>
              </div>
              <div className="d-flex justify-content-center align-items-center mb-2 gap-3">
                  <h2 className="text-2xl text-gray-800 m-0">AI Tutor</h2>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors" title="Log Out">
                      <LogOut size={20} />
                  </button>
              </div>
              <p className="text-gray-500">What do you want to master today?</p>
            </div>

            {!generated ? (
              <div className="space-y-6">
                <div className="lesson-source-tabs" role="tablist" aria-label="Lesson source">
                  <button
                    type="button"
                    className={`lesson-source-tab ${lessonSource === 'ai' ? 'active' : ''}`}
                    onClick={() => setLessonSource('ai')}
                  >
                    AI Generated
                  </button>
                  <button
                    type="button"
                    className={`lesson-source-tab ${lessonSource === 'upload' ? 'active' : ''}`}
                    onClick={() => setLessonSource('upload')}
                  >
                    Upload File
                  </button>
                </div>

                {lessonSource === 'ai' ? (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-800">Topic</label>
                      <input
                        type="text"
                        placeholder="e.g. Life of Tigers, Quantum Physics, React Hooks..."
                        className="ai-input"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      />
                    </div>
                    
                    <div>
                       <label className="text-sm font-semibold text-gray-800 mb-2 d-block">Lesson Vibe</label>
                       <div className="d-flex gap-2">
                           {['Thinker', 'Simple', 'Custom'].map((vibe) => (
                               <button 
                                    key={vibe} 
                                    className={`ai-btn ai-btn-secondary ${lessonVibe === vibe ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}
                                    style={lessonVibe === vibe ? {borderColor: '#3b82f6', background: '#eff6ff', color: '#1d4ed8'} : {}}
                                    onClick={() => setLessonVibe(vibe)}
                               >
                                   {vibe}
                               </button>
                           ))}
                       </div>
                       {lessonVibe === 'Custom' && (
                           <input 
                                type="text" 
                                placeholder="Describe your vibe..." 
                                className="ai-input mt-2"
                                value={customVibe}
                                onChange={(e) => setCustomVibe(e.target.value)}
                            />
                       )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-800 mb-2 d-block">What size of book do you need?</label>
                      <div className="d-flex gap-2">
                        {[
                          { key: "small", label: "Small" },
                          { key: "medium", label: "Medium" },
                          { key: "long", label: "Long" },
                        ].map((size) => (
                          <button
                            key={size.key}
                            className={`ai-btn ai-btn-secondary ${bookSize === size.key ? 'bg-blue-50 border-blue-500 text-blue-700' : ''}`}
                            style={bookSize === size.key ? { borderColor: '#3b82f6', background: '#eff6ff', color: '#1d4ed8' } : {}}
                            onClick={() => setBookSize(size.key)}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                        onClick={handleGenerate} 
                        className="ai-btn"
                        disabled={!topic || loading}
                        style={{opacity: !topic || loading ? 0.6 : 1}}
                    >
                      {loading ? 'Generating...' : <>Generate Curriculum <ArrowRight className="ml-2 w-4 h-4" /></>}
                    </button>
                  </>
                ) : (
                  <div className="upload-panel">
                    <div className="upload-dropzone">
                      <label htmlFor="lesson-file-upload" className="upload-dropzone-label">
                        <span className="upload-dropzone-title">Upload Your File</span>
                        <span className="upload-dropzone-subtitle">Choose a document from your computer to use as the lesson source.</span>
                      </label>
                      <input
                        id="lesson-file-upload"
                        type="file"
                        className="upload-file-input"
                        onChange={handleFileSelect}
                      />
                    </div>

                    {uploadedFile ? (
                      <div className="upload-file-card">
                        <div className="font-semibold text-gray-800">{uploadedFile.name}</div>
                        <div className="text-sm text-gray-500">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-0">No file selected yet.</p>
                    )}

                    <button
                      type="button"
                      onClick={handleUploadFile}
                      className="ai-btn"
                      disabled={!uploadedFile || uploadingFile}
                      style={{opacity: !uploadedFile || uploadingFile ? 0.6 : 1}}
                    >
                      {uploadingFile ? "Uploading..." : <>Upload File <ArrowRight className="ml-2 w-4 h-4" /></>}
                    </button>

                    {uploadStatus && (
                      <p className={`text-sm mb-0 ${uploadStatus.type === 'error' ? 'text-danger' : 'text-success'}`}>
                        {uploadStatus.message}
                      </p>
                    )}
                  </div>
                )}

                {generateError && (
                  <p className="text-danger text-sm mb-0">{generateError}</p>
                )}

                {/* Past Lessons Section */}
                {(lessonsLoading || myLessons.length > 0) && (
                    <div className="mt-8 border-t pt-6">
                        <div className="d-flex align-items-center gap-2 mb-4 text-gray-700">
                             <Library size={20} />
                             <h3 className="text-lg font-semibold m-0">Your Library</h3>
                        </div>
                        {lessonsLoading ? (
                          <div className="library-grid">
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <div key={idx} className="book-shimmer-card">
                                <ShimmerBlock style={{ width: '100%', height: '100%', borderRadius: '6px' }} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="library-grid">
                            {myLessons.map((lesson, idx) => (
                                <BookCard
                                    key={lesson._id}
                                    title={lesson.topic}
                                    subtitle={`${lesson.vibe} • ${formatLessonDate(lesson.createdAt)}`}
                                    colorIndex={idx}
                                    onClick={() => handleLoadLesson(lesson._id)}
                                    onDelete={(e) => handleDeleteLesson(e, lesson._id)}
                                />
                            ))}
                          </div>
                        )}
                    </div>
                )}

              </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                >
                    <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3 className="text-xl text-gray-800">Proposed Curriculum</h3>
                    <div className="d-flex gap-2">
                        <button onClick={() => setGenerated(false)} className="ai-btn ai-btn-ghost">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Regenerate
                        </button>
                    </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        {lessonVibe && <div className="mb-3 badge bg-light text-dark border">{lessonVibe === 'Custom' ? customVibe : lessonVibe} Mode</div>}
                        {loading && curriculum.length === 0 ? (
                          <div className="space-y-2">
                            {Array.from({ length: getChapterCountForSize(bookSize) }).map((_, idx) => (
                              <ShimmerBlock key={`curriculum-shimmer-${idx}`} style={{ height: '18px', borderRadius: '6px' }} />
                            ))}
                          </div>
                        ) : (
                          <ul className="space-y-2 pl-4">
                              {curriculum.map((item, idx) => (
                                  <li key={idx} className="text-gray-800 list-disc">{typeof item === "string" ? item : `Chapter ${idx + 1}`}</li>
                              ))}
                          </ul>
                        )}
                    </div>

                    <div className="grid-cols-2">
                    <button onClick={() => setModalOpen(true)} className="ai-btn ai-btn-secondary">
                        <Edit2 className="w-4 h-4 mr-2" />
                        Suggest Changes
                    </button>
                    <button onClick={handleStartLearning} className="ai-btn" disabled={loading}>
                        {loading ? 'Loading...' : <>Start Learning <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </button>
                    </div>
                </motion.div>
            )}
          </motion.div>
        ) : (
          /* Learning Mode - Book View */
          <>
            <button onClick={handleBack} className="ai-back-btn ai-back-btn-learning">
              <ArrowLeft size={18} className="mr-1" />
              <span className="back-text">Back</span>
            </button>
          <motion.div
            key="learning-book"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`book-container ${chatOpen ? 'with-chat' : ''}`}
            style={{ padding: '3px' }} // Tighter padding request
          >
             {/* Left Margin Strip with Binding visual */}
             <div className="book-margin-left">
                  {[...Array(24)].map((_, i) => (
                      <div key={i} className="binding-hole"></div>
                  ))}
              </div>
              
              <div className="book-page-stack"></div>

              {/* Main Page Content */}
              <div className="book-page" style={{ paddingTop: '20px', paddingBottom: '20px' }}> {/* Reduced margins */}
                   
                   {!isCurriculumPage && !activeChapter ? (
                       <div className="d-flex justify-content-center align-items-center h-100">
                            <div className="writing-chapter-wrap">
                              <div className="writing-chapter-book" aria-hidden="true">
                                <span className="writing-pen"></span>
                                <span className="writing-line line-1"></span>
                                <span className="writing-line line-2"></span>
                                <span className="writing-line line-3"></span>
                              </div>
                              <div className="writing-chapter-text">
                                Writing Chapter
                                <span className="writing-dots" aria-hidden="true"></span>
                              </div>
                            </div>
                       </div>
                   ) : isCurriculumPage ? (
                       <AnimatePresence mode="wait">
                           <motion.div
                               key="curriculum-page"
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               transition={{ duration: 0.3 }}
                           >
                               <h2 className="text-xl font-bold text-gray-900 mb-4 font-serif">Curriculum</h2>
                               <ul className="space-y-2 pl-4">
                                   {curriculum.map((item, idx) => (
                                       <li key={idx} className="text-gray-800 list-disc">{typeof item === "string" ? item : `Chapter ${idx + 1}`}</li>
                                   ))}
                               </ul>
                           </motion.div>
                       </AnimatePresence>
                   ) : (
                       <AnimatePresence mode="wait">
                           <motion.div
                               key={page}
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               transition={{ duration: 0.3 }}
                           >
                               {/* Smaller Header */}
                               <h2 className="text-xl font-bold text-gray-900 mb-4 font-serif">{activeChapter?.title}</h2>
                               <div dangerouslySetInnerHTML={{ __html: activeChapter?.content || "" }} className="space-y-6 text-gray-800 leading-relaxed text-lg content-html" />
                           </motion.div>
                       </AnimatePresence>
                   )}
                   
                   <div style={{height: '60px'}}></div> {/* Smaller Spacer */}
              </div>

              {/* Bottom Navigation (Floating) */}
              <div className="book-bottom-nav position-absolute bottom-0 p-3 d-flex justify-content-between align-items-center" style={{ background: 'linear-gradient(to top, #fdfbf7 90%, transparent)', zIndex: 20 }}>
                   <button 
                        onClick={handlePrevPage} 
                        disabled={page === 0}
                        className="ai-btn ai-btn-ghost text-sm d-flex align-items-center"
                        style={{width: 'auto', opacity: page === 0 ? 0.5 : 1, padding: '8px 12px', color: 'black'}}
                   >
                       <ArrowLeft size={24} className="mr-1" />
                   </button>

                   <span className="text-xs text-gray-400 font-mono">{page + 1} / {totalBookPages}</span>

                   <button 
                        onClick={handleNextPage} 
                        disabled={disableNext}
                        className="ai-btn ai-btn-ghost text-sm d-flex align-items-center"
                        style={{width: 'auto', opacity: disableNext ? 0.3 : 1, padding: '8px 12px', color: 'black'}}
                   >
                       {isNextChapterLoading && (
                         <>
                           <span className="next-page-loader" aria-hidden="true"></span>
                           <span className="next-page-loading-text">Loading next page...</span>
                         </>
                       )}
                       <ArrowRight size={24} className="ml-1" />
                   </button>
              </div>


              {/* Floating Controls (Right Side - Outside Book) */}
              {learningMode && (
                  <div className="floating-controls">
                      <div className="control-btn" onClick={() => setChatOpen(prev => !prev)} title="Discuss about this topic">
                          <MessageCircle size={24} />
                      </div>
                      <div className="control-btn" onClick={handleSummarize} title="Chapter Summary" disabled={isCurriculumPage}>
                          <List size={24} />
                      </div>
                      <div className="control-btn" onClick={handleMindmap} title="Concept Tree" disabled={isCurriculumPage}>
                          <Network size={24} />
                      </div>
                      <div className="control-btn" onClick={handleVocab} title="Key Vocabulary" disabled={isCurriculumPage}>
                          <BookA size={24} />
                      </div>
                      <div className="control-btn" onClick={handleMcq} title="Multiple Choice Questions" disabled={isCurriculumPage}>
                          <FileQuestion size={24} />
                      </div>
                      <div className="control-btn" onClick={handleQuestionAnswer} title="Page Questions & Answers" disabled={isCurriculumPage}>
                          <MessageSquareQuote size={24} />
                      </div>
                      <div className="control-btn" onClick={() => setDownloadModalOpen(true)} title="Download as PDF">
                          <Download size={24} />
                      </div>
                      <div className="control-btn" onClick={() => setLearningMode(false)} title="Exit Lesson">
                          <LogOut size={24} />
                      </div>
                  </div>
              )}

              {/* Chat Sidebar (Fixed - Outside Book) */}
              {learningMode && (
                <div className={`chat-sidebar ${chatOpen ? 'open' : ''}`}>
                    <div className="chat-header">
                        <span>AI Tutor</span>
                        <button onClick={() => setChatOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                    <div className="chat-body space-y-4">
                         
                        <div className="chat-bubble-ai">
                            Hello! I can answer questions about <strong>{isCurriculumPage ? 'the current chapter once you open it' : (activeChapter?.title || 'this topic')}</strong>.
                        </div>
                        
                        {activeChapter?.chatHistory?.map((msg, idx) => (
                             <div key={idx} className={`d-flex ${msg.role === 'user' ? 'justify-content-end' : ''}`}>
                                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'} style={{maxWidth: '85%'}}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        
                        {chatLoading && (
                             <div className="chat-bubble-ai">
                                 <span className="jumping-dots">Thinking...</span>
                             </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="chat-footer">
                        <div className="d-flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Ask a question..." 
                                className="ai-input mb-0" 
                                style={{marginBottom: 0, background: 'white'}} 
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                disabled={isCurriculumPage}
                            />
                            <button onClick={handleChatSubmit} className="ai-btn" style={{width: 'auto', padding: '0.5rem 1rem'}} disabled={chatLoading || isCurriculumPage}>
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
              )}

          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Suggestion Modal */}
      {modalOpen && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <h3 className="text-xl font-bold mb-4">Refine Curriculum</h3>
            <textarea
              className="ai-textarea"
              rows={4}
              placeholder="e.g. Add a section about Tiger mythology, or make it more advanced..."
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
            />
            <div className="ai-modal-footer">
              <button onClick={() => setModalOpen(false)} className="ai-btn ai-btn-secondary" style={{width: 'auto'}}>Cancel</button>
              <button onClick={handleApplySuggestion} className="ai-btn" style={{width: 'auto'}} disabled={loading || !suggestion.trim()}>
                {loading ? "Updating..." : "Apply Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {downloadModalOpen && (
        <div className="ai-modal-overlay">
           <div className="ai-modal-content">
               <h3 className="text-xl font-bold mb-2">Download Lesson</h3>
               <p className="text-sm text-gray-500 mb-4">Save the current progress as a PDF document.</p>
               
               <div className="space-y-4 mb-4">
                   <div 
                        className={`p-3 border rounded-lg cursor-pointer d-flex align-items-center gap-3 ${downloadOption === 'content' ? 'border-primary bg-blue-50' : ''}`}
                        onClick={() => setDownloadOption('content')}
                        style={{cursor: 'pointer', borderColor: downloadOption === 'content' ? '#2563eb' : '#e5e7eb', background: downloadOption === 'content' ? '#eff6ff' : 'white'}}
                   >
                       <BookOpen size={20} className={downloadOption === 'content' ? 'text-primary' : 'text-gray-400'} />
                       <div>
                           <div className="font-semibold text-gray-800">Lesson Content Only</div>
                           <div className="text-xs text-gray-500">Clean PDF with chapters and code</div>
                       </div>
                   </div>

                   <div 
                        className={`p-3 border rounded-lg cursor-pointer d-flex align-items-center gap-3 ${downloadOption === 'chat' ? 'border-primary bg-blue-50' : ''}`}
                        onClick={() => setDownloadOption('chat')}
                        style={{cursor: 'pointer', borderColor: downloadOption === 'chat' ? '#2563eb' : '#e5e7eb', background: downloadOption === 'chat' ? '#eff6ff' : 'white'}}
                   >
                       <MessageCircle size={20} className={downloadOption === 'chat' ? 'text-primary' : 'text-gray-400'} />
                       <div>
                           <div className="font-semibold text-gray-800">Include Tutor Chat</div>
                           <div className="text-xs text-gray-500">Appends your Q&A session to the PDF</div>
                       </div>
                   </div>
               </div>

               <p className="text-xs text-gray-400 mb-4">Note: Only content up to the current page {page + 1} will be downloaded.</p>

               <div className="ai-modal-footer">
                   <button onClick={() => setDownloadModalOpen(false)} className="ai-btn ai-btn-secondary" style={{width: 'auto'}}>Cancel</button>
                   <button onClick={handleDownload} className="ai-btn" style={{width: 'auto'}}>Download PDF</button>
               </div>
           </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="ai-modal-overlay">
           <div className="ai-modal-content">
               <div className="d-flex justify-content-between align-items-center mb-4">
                 <h3 className="text-xl font-bold mb-0">Chapter Summary</h3>
                 <button onClick={() => setSummaryModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                     <X size={20} className="text-gray-500" />
                 </button>
               </div>
               
               {summaryLoading ? (
                 <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                    <span className="jumping-dots font-semibold" style={{fontSize: '18px', color: '#6366f1'}}>Generating Summary</span>
                    <p className="text-sm text-gray-400">Extracting key points from the chapter...</p>
                 </div>
               ) : (
                 <ul className="space-y-3 pl-6 pr-2 max-h-96 overflow-y-auto">
                    {currentSummary.map((bullet, idx) => (
                        <li key={idx} className="text-gray-800" style={{listStyleType: 'disc', paddingLeft: '4px', lineHeight: '1.5'}}>
                          {bullet}
                        </li>
                    ))}
                 </ul>
               )}

               <div className="ai-modal-footer mt-6">
                   <button onClick={() => setSummaryModalOpen(false)} className="ai-btn ai-btn-secondary" style={{width: '100%'}}>Close</button>
               </div>
           </div>
        </div>
      )}

      {/* Mindmap Modal */}
      {mindmapModalOpen && (
        <div className="ai-modal-overlay">
           <div className="ai-modal-content" style={{ maxWidth: '800px', width: '90%' }}>
               <div className="d-flex justify-content-between align-items-center mb-4">
                 <h3 className="text-xl font-bold mb-0">Concept Tree</h3>
                 <button onClick={() => setMindmapModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                     <X size={20} className="text-gray-500" />
                 </button>
               </div>
               
               {mindmapLoading ? (
                 <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                    <span className="jumping-dots font-semibold" style={{fontSize: '18px', color: '#6366f1'}}>Generating Concept Tree</span>
                    <p className="text-sm text-gray-400">Mapping out the ideas from this chapter...</p>
                 </div>
               ) : (
                 <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
                    <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap', background: 'transparent', color: '#1f2937', padding: 0 }}>
                      {currentMindmap}
                    </pre>
                 </div>
               )}

               <div className="ai-modal-footer mt-6">
                   <button onClick={() => setMindmapModalOpen(false)} className="ai-btn ai-btn-secondary" style={{width: '100%'}}>Close</button>
               </div>
           </div>
        </div>
      )}

      {/* Vocab Modal */}
      {vocabModalOpen && (
        <div className="ai-modal-overlay">
           <div className="ai-modal-content">
               <div className="d-flex justify-content-between align-items-center mb-4">
                 <h3 className="text-xl font-bold mb-0">Key Vocabulary</h3>
                 <button onClick={() => setVocabModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                     <X size={20} className="text-gray-500" />
                 </button>
               </div>
               
               {vocabLoading ? (
                 <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                    <span className="jumping-dots font-semibold" style={{fontSize: '18px', color: '#6366f1'}}>Extracting Words</span>
                    <p className="text-sm text-gray-400">Finding unusual and advanced vocabulary...</p>
                 </div>
               ) : (
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {currentVocab.length > 0 ? currentVocab.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
                            <h4 className="font-bold text-gray-900 mb-1" style={{color: '#a37548'}}>{item.word}</h4>
                            <p className="text-sm text-gray-700 m-0">{item.definition}</p>
                        </div>
                    )) : (
                        <p className="text-gray-500 text-center italic py-4">No advanced vocabulary found in this chapter.</p>
                    )}
                 </div>
               )}

               <div className="ai-modal-footer mt-6">
                   <button onClick={() => setVocabModalOpen(false)} className="ai-btn ai-btn-secondary" style={{width: '100%'}}>Close</button>
               </div>
           </div>
        </div>
      )}

      {mcqModalOpen && (
        <div className="ai-modal-overlay">
           <div className="ai-modal-content" style={{ maxWidth: '860px', width: '90%' }}>
               <div className="d-flex justify-content-between align-items-center mb-4">
                 <h3 className="text-xl font-bold mb-0">MCQ</h3>
                 <button onClick={() => setMcqModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                     <X size={20} className="text-gray-500" />
                 </button>
               </div>

               {mcqLoading ? (
                 <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                    <span className="jumping-dots font-semibold" style={{fontSize: '18px', color: '#6366f1'}}>Generating MCQ</span>
                    <p className="text-sm text-gray-400">Preparing a question for this chapter...</p>
                 </div>
               ) : (
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {currentMcqs.length > 0 ? currentMcqs.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                            <h4 className="font-bold text-gray-900 mb-3">{item.question}</h4>
                            <div className="space-y-2">
                                {(item.options || []).map((option, optionIdx) => {
                                  const isCorrect = option === item.answer;
                                  const isSelected = option === selectedMcqOption;
                                  let borderColor = '#e5e7eb';
                                  let background = '#f9fafb';
                                  let color = '#1f2937';

                                  if (mcqAnswered && isCorrect) {
                                    borderColor = '#86efac';
                                    background = '#f0fdf4';
                                    color = '#166534';
                                  } else if (mcqAnswered && isSelected && !isCorrect) {
                                    borderColor = '#fca5a5';
                                    background = '#fef2f2';
                                    color = '#991b1b';
                                  }

                                  return (
                                    <button
                                      type="button"
                                      key={optionIdx}
                                      className="mcq-option-row mcq-option-button border rounded-lg px-3 py-2 text-sm"
                                      onClick={() => handleMcqOptionSelect(option)}
                                      disabled={mcqAnswered || mcqGenerating}
                                      style={{
                                        borderColor,
                                        background,
                                        color
                                      }}
                                    >
                                      <span className="mcq-option-label font-semibold">{String.fromCharCode(65 + optionIdx)}.</span>
                                      <span className="mcq-option-text">{option}</span>
                                    </button>
                                  );
                                })}
                            </div>
                            {mcqAnswered && item.answer && (
                              <div className="mt-3 p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <p className="text-sm m-0" style={{color: '#166534'}}>
                                  <strong>{selectedMcqOption === item.answer ? "Correct." : "Not quite."}</strong> The right answer is {item.answer}.
                                </p>
                                {item.explanation && (
                                  <p className="text-sm text-gray-700 m-0 mt-2" style={{lineHeight: '1.6'}}>
                                    <strong>Explanation:</strong> {item.explanation}
                                  </p>
                                )}
                              </div>
                            )}
                            {mcqAnswered && item.options?.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleGenerateMcq()}
                                className="ai-btn mt-4"
                                disabled={mcqGenerating}
                              >
                                {mcqGenerating ? "Generating..." : "Next Question"}
                              </button>
                            )}
                        </div>
                    )) : (
                        <p className="text-gray-500 text-center italic py-4">Generating MCQ for this chapter...</p>
                    )}
                 </div>
               )}
           </div>
        </div>
      )}

      {questionAnswerModalOpen && (
        <div className="ai-modal-overlay">
           <div className="ai-modal-content" style={{ maxWidth: '860px', width: '90%' }}>
               <div className="d-flex justify-content-between align-items-center mb-4">
                 <h3 className="text-xl font-bold mb-0">Q&A</h3>
                 <button onClick={() => setQuestionAnswerModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>
                     <X size={20} className="text-gray-500" />
                 </button>
               </div>

               {questionAnswerLoading ? (
                 <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                    <span className="jumping-dots font-semibold" style={{fontSize: '18px', color: '#6366f1'}}>Generating Q&amp;A</span>
                    <p className="text-sm text-gray-400">Preparing likely questions from this page...</p>
                 </div>
               ) : (
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {currentQuestionAnswers.length > 0 ? currentQuestionAnswers.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                            <h4 className="font-bold text-gray-900 mb-2">{item.question}</h4>
                            <p className="text-sm text-gray-700 m-0" style={{lineHeight: '1.6'}}>{item.answer}</p>
                        </div>
                    )) : (
                        <p className="text-gray-500 text-center italic py-4">No questions were generated for this chapter.</p>
                    )}
                 </div>
               )}

               <div className="ai-modal-footer mt-6">
                   <button onClick={() => setQuestionAnswerModalOpen(false)} className="ai-btn ai-btn-secondary" style={{width: '100%'}}>Close</button>
               </div>
           </div>
        </div>
      )}

    </div>
    </>
  );
}
