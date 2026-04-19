"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookA,
  BookOpen,
  Download,
  FileQuestion,
  List,
  LogOut,
  MessageCircle,
  MessageSquareQuote,
  Network,
  Send,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import jsPDF from "jspdf";

import "./ai-tutor.css";

function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n$1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "  • $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(ul|ol|div|section|article|blockquote|pre|code|span|strong|em|b|i|a|table|tr|td|th|thead|tbody)[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function GenericBookReader({
  documentTitle,
  tocTitle = "Curriculum",
  tocItems = [],
  pageIndex,
  totalPages,
  isTocPage,
  currentPageId,
  currentPageTitle,
  currentPageContent,
  initialChatHistory = [],
  currentPageLoading = false,
  nextPageLoading = false,
  disablePrev,
  disableNext,
  onPrevPage,
  onNextPage,
  onBack,
  onExit,
  toolAdapter,
  downloadConfig,
  assistantLabel = "AI Tutor",
  sidebarItems = [],
  sidebarTitle = "Questions",
  onSelectSidebarItem,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadOption, setDownloadOption] = useState("content");

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

  const [chatHistoryMap, setChatHistoryMap] = useState({});
  const chatEndRef = useRef(null);

  const pageKey = currentPageId || currentPageTitle || `page-${pageIndex}`;
  const activeChatHistory = useMemo(() => {
    if (isTocPage) return [];
    return chatHistoryMap[pageKey] || initialChatHistory || [];
  }, [chatHistoryMap, pageKey, isTocPage, initialChatHistory]);

  useEffect(() => {
    if (!isTocPage && pageKey && !chatHistoryMap[pageKey] && initialChatHistory.length > 0) {
      setChatHistoryMap((prev) => ({ ...prev, [pageKey]: initialChatHistory }));
    }
  }, [chatHistoryMap, initialChatHistory, isTocPage, pageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatHistory, chatLoading, chatOpen]);

  useEffect(() => {
    document.body.classList.add("book-reader-open");
    return () => {
      document.body.classList.remove("book-reader-open");
    };
  }, []);

  const currentPage = {
    id: pageKey,
    title: currentPageTitle || "",
    content: currentPageContent || "",
  };

  const appendChatMessages = (messages) => {
    setChatHistoryMap((prev) => ({
      ...prev,
      [pageKey]: [...(prev[pageKey] || initialChatHistory || []), ...messages],
    }));
  };

  const handleChatSubmit = async () => {
    if (!chatMessage.trim() || isTocPage || currentPageLoading) return;
    const userMessage = chatMessage.trim();
    appendChatMessages([{ role: "user", content: userMessage }]);
    setChatMessage("");
    setChatLoading(true);

    try {
      const response = await toolAdapter.sendChat({
        page: currentPage,
        message: userMessage,
        history: activeChatHistory,
      });
      appendChatMessages([{ role: "assistant", content: response }]);
    } catch (error) {
      console.error("Chat failed", error);
      appendChatMessages([{ role: "assistant", content: "Failed to get a response for this page." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (isTocPage || currentPageLoading) return;
    setSummaryModalOpen(true);
    setSummaryLoading(true);
    setCurrentSummary([]);
    try {
      const bullets = await toolAdapter.summarize({ page: currentPage });
      setCurrentSummary(bullets || []);
    } catch (error) {
      console.error(error);
      setCurrentSummary(["Failed to load summary."]);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleMindmap = async () => {
    if (isTocPage || currentPageLoading) return;
    setMindmapModalOpen(true);
    setMindmapLoading(true);
    setCurrentMindmap("");
    try {
      const tree = await toolAdapter.mindmap({ page: currentPage });
      setCurrentMindmap(tree || "");
    } catch (error) {
      console.error(error);
      setCurrentMindmap("Failed to load concept tree.");
    } finally {
      setMindmapLoading(false);
    }
  };

  const handleVocab = async () => {
    if (isTocPage || currentPageLoading) return;
    setVocabModalOpen(true);
    setVocabLoading(true);
    setCurrentVocab([]);
    try {
      const vocab = await toolAdapter.vocab({ page: currentPage });
      setCurrentVocab(vocab || []);
    } catch (error) {
      console.error(error);
      setCurrentVocab([{ word: "Error", definition: "Failed to load vocabulary." }]);
    } finally {
      setVocabLoading(false);
    }
  };

  const handleGenerateMcq = async ({ isInitialLoad = false } = {}) => {
    if (isTocPage || currentPageLoading) return;
    setMcqGenerating(true);
    try {
      const mcq = await toolAdapter.mcq({
        page: currentPage,
        existingMcqs: currentMcqs.map((item) => item.question),
      });
      if (mcq) {
        setCurrentMcqs([mcq]);
        setSelectedMcqOption("");
        setMcqAnswered(false);
      }
    } catch (error) {
      console.error(error);
      if (isInitialLoad) {
        setCurrentMcqs([
          {
            question: "Error",
            options: [],
            answer: "",
            explanation: "Failed to generate MCQ for this page.",
          },
        ]);
      }
    } finally {
      if (isInitialLoad) {
        setMcqLoading(false);
      }
      setMcqGenerating(false);
    }
  };

  const handleMcq = async () => {
    if (isTocPage || currentPageLoading) return;
    setMcqModalOpen(true);
    setMcqLoading(true);
    setCurrentMcqs([]);
    setSelectedMcqOption("");
    setMcqAnswered(false);
    await handleGenerateMcq({ isInitialLoad: true });
  };

  const handleQuestionAnswer = async () => {
    if (isTocPage || currentPageLoading) return;
    setQuestionAnswerModalOpen(true);
    setQuestionAnswerLoading(true);
    setCurrentQuestionAnswers([]);
    try {
      const result = await toolAdapter.questionAnswer({ page: currentPage });
      setCurrentQuestionAnswers(result || []);
    } catch (error) {
      console.error(error);
      setCurrentQuestionAnswers([{ question: "Error", answer: "Failed to load page questions and answers." }]);
    } finally {
      setQuestionAnswerLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloadModalOpen(false);
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 25;
    const marginRight = 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const bottomMargin = 25;
    const maxY = pageHeight - bottomMargin;
    let yPos = 30;

    const sourceConfig = downloadConfig || {
      documentTitle: documentTitle || currentPageTitle || "AI Lesson",
      tocTitle,
      tocItems,
      pages: isTocPage
        ? []
        : [
            {
              title: currentPageTitle,
              content: currentPageContent,
              chatHistory: activeChatHistory,
            },
          ],
      currentPageNumber: pageIndex + 1,
    };

    const checkPageBreak = (neededHeight) => {
      if (yPos + neededHeight > maxY) {
        doc.addPage();
        yPos = 25;
      }
    };

    const renderText = (text, fontSize, lineHeight = 1.4, color = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, contentWidth);
      const lineSpacing = fontSize * 0.353 * lineHeight;
      lines.forEach((line) => {
        checkPageBreak(lineSpacing + 2);
        doc.text(line, marginLeft, yPos);
        yPos += lineSpacing;
      });
    };

    yPos = 60;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(40, 40, 40);
    const titleLines = doc.splitTextToSize(sourceConfig.documentTitle || "AI Lesson", contentWidth);
    titleLines.forEach((line) => {
      doc.text(line, pageWidth / 2, yPos, { align: "center" });
      yPos += 12;
    });

    yPos += 8;
    doc.setDrawColor(160, 140, 110);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos);

    if (sourceConfig.tocItems?.length) {
      doc.addPage();
      yPos = 30;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(sourceConfig.tocTitle || "Table of Contents", marginLeft, yPos);
      yPos += 12;

      doc.setFont("helvetica", "normal");
      sourceConfig.tocItems.forEach((item, index) => {
        renderText(`${index + 1}. ${item}`, 11, 1.6, [60, 60, 60]);
        yPos += 2;
      });
    }

    sourceConfig.pages.forEach((pageData, index) => {
      doc.addPage();
      yPos = 30;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(140, 140, 140);
      doc.text(`PAGE ${index + 1}`, marginLeft, yPos);
      yPos += 8;
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      renderText(pageData.title || `Page ${index + 1}`, 18, 1.4, [40, 40, 40]);
      yPos += 4;
      const textContent = htmlToText(pageData.content);
      const paragraphs = textContent.split(/\n\n+/);
      doc.setFont("helvetica", "normal");
      paragraphs.forEach((paragraph) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return;
        renderText(trimmed, 10.5, 1.5, [60, 60, 60]);
        yPos += 3;
      });

      if (downloadOption === "chat" && pageData.chatHistory?.length > 0) {
        yPos += 8;
        pageData.chatHistory.forEach((message) => {
          const role = message.role === "user" ? "You" : assistantLabel;
          const roleColor = message.role === "user" ? [40, 80, 160] : [60, 120, 80];
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...roleColor);
          checkPageBreak(12);
          doc.text(role, marginLeft, yPos);
          yPos += 5;
          doc.setFont("helvetica", "normal");
          renderText(message.content, 10, 1.4, [60, 60, 60]);
          yPos += 4;
        });
      }
    });

    const total = doc.internal.getNumberOfPages();
    for (let i = 2; i <= total; i += 1) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text(`${i - 1}`, pageWidth / 2, pageHeight - 12, { align: "center" });
    }

    doc.save(`${sourceConfig.documentTitle || "AI Lesson"}.pdf`);
  };

  return (
    <>
      <button onClick={onBack} className="ai-back-btn ai-back-btn-learning">
        <ArrowLeft size={18} className="mr-1" />
        <span className="back-text">Back</span>
      </button>

      <motion.div
        key="generic-learning-book"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`book-container book-container--immersive ${chatOpen ? "with-chat" : ""}`}
        style={{ padding: "3px" }}
      >
        <div className="book-layout-shell">
          <div className="book-margin-left">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="binding-hole"></div>
            ))}
          </div>

          {sidebarItems.length > 0 ? (
            <aside className="book-sidebar">
              <div className="book-sidebar__header">{sidebarTitle}</div>
              <div className="book-sidebar__list">
                {sidebarItems.map((item, index) => {
                  const isActive = item.pageIndex === pageIndex
                  return (
                    <button
                      key={item.id || `${item.title}-${index}`}
                      type="button"
                      className={`book-sidebar__item ${isActive ? "is-active" : ""}`}
                      onClick={() => onSelectSidebarItem?.(item)}
                    >
                      <span className="book-sidebar__item-index">{item.number || index + 1}</span>
                      <span className="book-sidebar__item-title">{item.title}</span>
                    </button>
                  )
                })}
              </div>
            </aside>
          ) : null}

          <div className="book-page-stack"></div>

          <div className="book-page" style={{ paddingTop: "20px", paddingBottom: "20px" }}>
          {currentPageLoading ? (
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
          ) : isTocPage ? (
            <AnimatePresence mode="wait">
              <motion.div
                key="toc-page"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4 font-serif">{tocTitle}</h2>
                <ul className="space-y-2 pl-4">
                  {tocItems.map((item, index) => (
                    <li key={`${item}-${index}`} className="text-gray-800 list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPageId || pageIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4 font-serif">{currentPageTitle}</h2>
                <div dangerouslySetInnerHTML={{ __html: currentPageContent || "" }} className="space-y-6 text-gray-800 leading-relaxed text-lg content-html" />
              </motion.div>
            </AnimatePresence>
          )}

          <div style={{ height: "60px" }}></div>
          </div>
        </div>

        <div className="book-bottom-nav position-absolute bottom-0 p-3 d-flex justify-content-between align-items-center" style={{ background: "linear-gradient(to top, #fdfbf7 90%, transparent)", zIndex: 20 }}>
          <button onClick={onPrevPage} disabled={disablePrev} className="ai-btn ai-btn-ghost text-sm d-flex align-items-center" style={{ width: "auto", opacity: disablePrev ? 0.5 : 1, padding: "8px 12px", color: "black" }}>
            <ArrowLeft size={24} className="mr-1" />
          </button>

          <span className="text-xs text-gray-400 font-mono">
            {pageIndex + 1} / {totalPages}
          </span>

          <button onClick={onNextPage} disabled={disableNext} className="ai-btn ai-btn-ghost text-sm d-flex align-items-center" style={{ width: "auto", opacity: disableNext ? 0.3 : 1, padding: "8px 12px", color: "black" }}>
            {nextPageLoading ? (
              <>
                <span className="next-page-loader" aria-hidden="true"></span>
                <span className="next-page-loading-text">Loading next page...</span>
              </>
            ) : null}
            <ArrowRight size={24} className="ml-1" />
          </button>
        </div>

        <div className="floating-controls">
          <div className="control-btn" onClick={() => setChatOpen((prev) => !prev)} title="Discuss about this topic">
            <MessageCircle size={24} />
          </div>
          <div className="control-btn" onClick={handleSummarize} title="Chapter Summary">
            <List size={24} />
          </div>
          <div className="control-btn" onClick={handleMindmap} title="Concept Tree">
            <Network size={24} />
          </div>
          <div className="control-btn" onClick={handleVocab} title="Key Vocabulary">
            <BookA size={24} />
          </div>
          <div className="control-btn" onClick={handleMcq} title="Multiple Choice Questions">
            <FileQuestion size={24} />
          </div>
          <div className="control-btn" onClick={handleQuestionAnswer} title="Page Questions & Answers">
            <MessageSquareQuote size={24} />
          </div>
          <div className="control-btn" onClick={() => setDownloadModalOpen(true)} title="Download as PDF">
            <Download size={24} />
          </div>
          <div className="control-btn" onClick={onExit || onBack} title="Exit Lesson">
            <LogOut size={24} />
          </div>
        </div>

        <div className={`chat-sidebar ${chatOpen ? "open" : ""}`}>
          <div className="chat-header">
            <span>{assistantLabel}</span>
            <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          <div className="chat-body space-y-4">
            <div className="chat-bubble-ai">
              Hello! I can answer questions about <strong>{isTocPage ? "the selected page once you open it" : currentPageTitle}</strong>.
            </div>

            {activeChatHistory.map((msg, index) => (
              <div key={`${msg.role}-${index}`} className={`d-flex ${msg.role === "user" ? "justify-content-end" : ""}`}>
                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} style={{ maxWidth: "85%" }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {chatLoading ? (
              <div className="chat-bubble-ai">
                <span className="jumping-dots">Thinking...</span>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-footer">
            <div className="d-flex gap-2">
              <input
                type="text"
                placeholder="Ask a question..."
                className="ai-input mb-0"
                style={{ marginBottom: 0, background: "white" }}
                value={chatMessage}
                onChange={(event) => setChatMessage(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleChatSubmit()}
                disabled={isTocPage || currentPageLoading}
              />
              <button onClick={handleChatSubmit} className="ai-btn" style={{ width: "auto", padding: "0.5rem 1rem" }} disabled={chatLoading || isTocPage || currentPageLoading}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {downloadModalOpen ? (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <h3 className="text-xl font-bold mb-2">Download Lesson</h3>
            <p className="text-sm text-gray-500 mb-4">Save the current progress as a PDF document.</p>

            <div className="space-y-4 mb-4">
              <div className={`p-3 border rounded-lg cursor-pointer d-flex align-items-center gap-3 ${downloadOption === "content" ? "border-primary bg-blue-50" : ""}`} onClick={() => setDownloadOption("content")} style={{ cursor: "pointer", borderColor: downloadOption === "content" ? "#2563eb" : "#e5e7eb", background: downloadOption === "content" ? "#eff6ff" : "white" }}>
                <BookOpen size={20} className={downloadOption === "content" ? "text-primary" : "text-gray-400"} />
                <div>
                  <div className="font-semibold text-gray-800">Lesson Content Only</div>
                  <div className="text-xs text-gray-500">Clean PDF with pages and code</div>
                </div>
              </div>

              <div className={`p-3 border rounded-lg cursor-pointer d-flex align-items-center gap-3 ${downloadOption === "chat" ? "border-primary bg-blue-50" : ""}`} onClick={() => setDownloadOption("chat")} style={{ cursor: "pointer", borderColor: downloadOption === "chat" ? "#2563eb" : "#e5e7eb", background: downloadOption === "chat" ? "#eff6ff" : "white" }}>
                <MessageCircle size={20} className={downloadOption === "chat" ? "text-primary" : "text-gray-400"} />
                <div>
                  <div className="font-semibold text-gray-800">Include Tutor Chat</div>
                  <div className="text-xs text-gray-500">Appends your Q&A session to the PDF</div>
                </div>
              </div>
            </div>

            <div className="ai-modal-footer">
              <button onClick={() => setDownloadModalOpen(false)} className="ai-btn ai-btn-secondary" style={{ width: "auto" }}>
                Cancel
              </button>
              <button onClick={handleDownload} className="ai-btn" style={{ width: "auto" }}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {summaryModalOpen ? (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Chapter Summary</h3>
              <button onClick={() => setSummaryModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {summaryLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>
                  Generating Summary
                </span>
                <p className="text-sm text-gray-400">Extracting key points from the chapter...</p>
              </div>
            ) : (
              <ul className="space-y-3 pl-6 pr-2 max-h-96 overflow-y-auto">
                {currentSummary.map((bullet, index) => (
                  <li key={index} className="text-gray-800" style={{ listStyleType: "disc", paddingLeft: "4px", lineHeight: "1.5" }}>
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            <div className="ai-modal-footer mt-6">
              <button onClick={() => setSummaryModalOpen(false)} className="ai-btn ai-btn-secondary" style={{ width: "100%" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mindmapModalOpen ? (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content" style={{ maxWidth: "800px", width: "90%" }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Concept Tree</h3>
              <button onClick={() => setMindmapModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {mindmapLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>
                  Generating Concept Tree
                </span>
                <p className="text-sm text-gray-400">Mapping out the ideas from this chapter...</p>
              </div>
            ) : (
              <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", maxHeight: "60vh", overflowY: "auto" }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{currentMindmap}</pre>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {vocabModalOpen ? (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Key Vocabulary</h3>
              <button onClick={() => setVocabModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {vocabLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>
                  Extracting Vocabulary
                </span>
                <p className="text-sm text-gray-400">Finding important terms from this chapter...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {currentVocab.map((item, index) => (
                  <div key={`${item.word}-${index}`} className="border rounded-lg p-3">
                    <div className="font-semibold text-gray-900">{item.word}</div>
                    <div className="text-sm text-gray-600 mt-1">{item.definition}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {mcqModalOpen ? (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Multiple Choice Question</h3>
              <button onClick={() => setMcqModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {mcqLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>
                  Generating MCQ
                </span>
                <p className="text-sm text-gray-400">Creating a self-test for this chapter...</p>
              </div>
            ) : (
              currentMcqs.map((mcq, index) => (
                <div key={index}>
                  <div className="font-semibold text-gray-900 mb-3">{mcq.question}</div>
                  <div className="space-y-2">
                    {(mcq.options || []).map((option) => {
                      const isSelected = selectedMcqOption === option;
                      const isCorrect = mcq.answer === option;
                      let borderColor = "#e5e7eb";
                      let background = "#ffffff";

                      if (mcqAnswered && isCorrect) {
                        borderColor = "#22c55e";
                        background = "#f0fdf4";
                      } else if (mcqAnswered && isSelected && !isCorrect) {
                        borderColor = "#ef4444";
                        background = "#fef2f2";
                      } else if (isSelected) {
                        borderColor = "#3b82f6";
                        background = "#eff6ff";
                      }

                      return (
                        <button
                          key={option}
                          type="button"
                          className="mcq-option-button border rounded-lg p-3"
                          onClick={() => {
                            if (!mcqAnswered) {
                              setSelectedMcqOption(option);
                              setMcqAnswered(true);
                            }
                          }}
                          disabled={mcqAnswered}
                          style={{ borderColor, background }}
                        >
                          <div className="mcq-option-row">
                            <span className="mcq-option-label">{option}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {mcqAnswered ? (
                    <div className="mt-4 p-3 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="font-semibold text-gray-900 mb-1">Explanation</div>
                      <div className="text-sm text-gray-700">{mcq.explanation}</div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
            <div className="ai-modal-footer">
              <button onClick={() => handleGenerateMcq()} className="ai-btn ai-btn-secondary" style={{ width: "auto" }} disabled={mcqGenerating}>
                {mcqGenerating ? "Generating..." : "New MCQ"}
              </button>
              <button onClick={() => setMcqModalOpen(false)} className="ai-btn" style={{ width: "auto" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {questionAnswerModalOpen ? (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Page Questions & Answers</h3>
              <button onClick={() => setQuestionAnswerModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {questionAnswerLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>
                  Generating Q&A
                </span>
                <p className="text-sm text-gray-400">Preparing likely interview questions for this page...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {currentQuestionAnswers.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="border rounded-lg p-3">
                    <div className="font-semibold text-gray-900">{item.question}</div>
                    <div className="text-sm text-gray-600 mt-2">{item.answer}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
