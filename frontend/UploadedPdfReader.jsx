"use client";
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookA, FileQuestion, List, MessageCircle, MessageSquareQuote, Network, Send, X, LogOut } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

import "./ai-tutor.css";

GlobalWorkerOptions.workerSrc = pdfWorker;

function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ai_tutor_token");
  }
  return null;
}

export default function UploadedPdfReader({ lesson, backendUrl, onExit }) {
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

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
  const [currentMcq, setCurrentMcq] = useState(null);
  const [selectedMcqOption, setSelectedMcqOption] = useState("");
  const [mcqAnswered, setMcqAnswered] = useState(false);

  const [questionAnswerModalOpen, setQuestionAnswerModalOpen] = useState(false);
  const [questionAnswerLoading, setQuestionAnswerLoading] = useState(false);
  const [currentQuestionAnswers, setCurrentQuestionAnswers] = useState([]);

  const chatEndRef = useRef(null);
  const pdfShellRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfRenderLoading, setPdfRenderLoading] = useState(true);
  const [pdfRenderError, setPdfRenderError] = useState("");
  const [pdfContainerWidth, setPdfContainerWidth] = useState(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pageData, chatOpen, chatLoading]);

  useEffect(() => {
    const shell = pdfShellRef.current;
    if (!shell) return;

    const updateWidth = () => {
      const measuredWidth = Math.floor(shell.getBoundingClientRect().width || shell.clientWidth || 0);
      setPdfContainerWidth(measuredWidth || Math.max(window.innerWidth - 180, 320));
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(shell);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task = null;
    const abortController = new AbortController();

    const loadPdf = async () => {
      setPdfRenderLoading(true);
      setPdfRenderError("");
      try {
        const res = await fetch(`${backendUrl}${lesson.fileUrl}`, {
          headers: {
            ...(getAuthToken() && { Authorization: `Bearer ${getAuthToken()}` }),
          },
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch PDF file.");

        const data = await res.arrayBuffer();
        if (cancelled) return;

        task = getDocument({ data });
        const doc = await task.promise;
        if (!cancelled) {
          setPdfDoc(doc);
        }
      } catch (err) {
        const message = err?.message || "";
        const isCancelledLoad =
          cancelled ||
          err?.name === "AbortError" ||
          message.includes("Worker was destroyed") ||
          message.includes("Loading aborted");

        if (isCancelledLoad) {
          return;
        }
        console.error("Failed to load PDF document", err);
        if (!cancelled) {
          setPdfDoc(null);
          setPdfRenderError(message || "Failed to load PDF page.");
          setPdfRenderLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      abortController.abort();
      task?.destroy();
    };
  }, [backendUrl, lesson.fileUrl]);

  useEffect(() => {
    let cancelled = false;

    const renderPage = async () => {
      if (!pdfDoc || !pdfCanvasRef.current) return;

      setPdfRenderLoading(true);
      setPdfRenderError("");
      try {
        const pdfPage = await pdfDoc.getPage(page);
        if (cancelled) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const shellWidth =
          Math.floor(pdfShellRef.current?.getBoundingClientRect().width || 0) ||
          pdfContainerWidth ||
          Math.max(window.innerWidth - 180, 320);
        const availableWidth = Math.max(shellWidth - 24, 240);
        const scale = availableWidth / baseViewport.width;
        const outputScale = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale });
        const renderViewport = pdfPage.getViewport({ scale: scale * outputScale });

        const canvas = pdfCanvasRef.current;
        if (!canvas) {
          return;
        }
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas rendering context unavailable.");
        }
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        await pdfPage.render({
          canvasContext: context,
          viewport: renderViewport,
        }).promise;
      } catch (err) {
        console.error("Failed to render PDF page", err);
        if (!cancelled) {
          setPdfRenderError(err?.message || "Failed to render this PDF page.");
        }
      } finally {
        if (!cancelled) {
          setPdfRenderLoading(false);
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [page, pdfDoc, pdfContainerWidth]);

  useEffect(() => {
    const loadPage = async () => {
      setPageLoading(true);
      try {
        const params = new URLSearchParams({
          lesson_id: lesson._id,
          page_number: String(page),
        });
        const res = await fetch(`${backendUrl}/api/ai-tutor/uploaded-pdf/page?${params.toString()}`, {
          headers: {
            ...(getAuthToken() && { Authorization: `Bearer ${getAuthToken()}` }),
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load page.");
        setPageData(data);
      } catch (err) {
        console.error(err);
        setPageData(null);
      } finally {
        setPageLoading(false);
      }
    };

    loadPage();
  }, [backendUrl, lesson._id, page]);

  const pageCount = lesson.pageCount || pageData?.pageCount || 1;
  const postPageTool = async (path, setter, fallback) => {
    const token = getAuthToken();
    const res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        lesson_id: lesson._id,
        page_number: page,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || fallback);
    setter(data);
  };

  const handleSummarize = async () => {
    setSummaryModalOpen(true);
    setSummaryLoading(true);
    try {
      await postPageTool("/api/ai-tutor/uploaded-pdf/summary", (data) => setCurrentSummary(data.bullets || []), "Failed to generate summary");
    } catch (err) {
      console.error(err);
      setCurrentSummary(["Failed to load summary."]);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleMindmap = async () => {
    setMindmapModalOpen(true);
    setMindmapLoading(true);
    try {
      await postPageTool("/api/ai-tutor/uploaded-pdf/mindmap", (data) => setCurrentMindmap(data.tree || ""), "Failed to generate mindmap");
    } catch (err) {
      console.error(err);
      setCurrentMindmap("Failed to load mindmap.");
    } finally {
      setMindmapLoading(false);
    }
  };

  const handleVocab = async () => {
    setVocabModalOpen(true);
    setVocabLoading(true);
    try {
      await postPageTool("/api/ai-tutor/uploaded-pdf/vocab", (data) => setCurrentVocab(data.vocab || []), "Failed to generate vocab");
    } catch (err) {
      console.error(err);
      setCurrentVocab([{ word: "Error", definition: "Failed to load vocabulary." }]);
    } finally {
      setVocabLoading(false);
    }
  };

  const handleGenerateMcq = async (openModal = false) => {
    if (openModal) {
      setMcqModalOpen(true);
      setMcqLoading(true);
    }
    setMcqGenerating(true);
    try {
      await postPageTool("/api/ai-tutor/uploaded-pdf/mcq", (data) => {
        setCurrentMcq(data.mcq || null);
        setSelectedMcqOption("");
        setMcqAnswered(false);
      }, "Failed to generate MCQ");
    } catch (err) {
      console.error(err);
      setCurrentMcq({
        question: "Error",
        options: [],
        answer: "",
        explanation: "Failed to generate MCQ for this page.",
      });
    } finally {
      if (openModal) {
        setMcqLoading(false);
      }
      setMcqGenerating(false);
    }
  };

  const handleMcq = async () => {
    await handleGenerateMcq(true);
  };

  const handleMcqOptionSelect = (option) => {
    if (mcqAnswered) return;
    setSelectedMcqOption(option);
    setMcqAnswered(true);
  };

  const handleQuestionAnswer = async () => {
    setQuestionAnswerModalOpen(true);
    setQuestionAnswerLoading(true);
    try {
      await postPageTool("/api/ai-tutor/uploaded-pdf/question-answer", (data) => setCurrentQuestionAnswers(data.question_answers || []), "Failed to generate Q&A");
    } catch (err) {
      console.error(err);
      setCurrentQuestionAnswers([{ question: "Error", answer: "Failed to load page questions and answers." }]);
    } finally {
      setQuestionAnswerLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatMessage.trim()) return;
    const message = chatMessage;
    setChatMessage("");
    setChatLoading(true);

    const optimisticHistory = [
      ...(pageData?.chatHistory || []),
      { role: "user", content: message },
    ];
    setPageData((prev) => prev ? { ...prev, chatHistory: optimisticHistory } : prev);

    try {
      const token = getAuthToken();
      const res = await fetch(`${backendUrl}/api/ai-tutor/uploaded-pdf/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          lesson_id: lesson._id,
          page_number: page,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send message.");
      setPageData((prev) =>
        prev
          ? {
              ...prev,
              chatHistory: [...optimisticHistory, { role: "assistant", content: data.content }],
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      setPageData((prev) =>
        prev
          ? {
              ...prev,
              chatHistory: [...optimisticHistory, { role: "assistant", content: "Failed to respond for this page." }],
            }
          : prev
      );
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="ai-tutor-container ai-tutor-learning-padding">
      <button onClick={onExit} className="ai-back-btn ai-back-btn-learning">
        <ArrowLeft size={18} className="mr-1" />
        <span className="back-text">Back</span>
      </button>

      <div className={`book-container ${chatOpen ? "with-chat" : ""}`} style={{ padding: "3px" }}>
        <div className="book-margin-left">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="binding-hole"></div>
          ))}
        </div>

        <div className="book-page-stack"></div>

        <div className="book-page pdf-book-page" style={{ paddingTop: "20px", paddingBottom: "20px" }}>
          <div ref={pdfShellRef} className="pdf-frame-shell">
            {(pdfRenderLoading || !pdfDoc || pageLoading) && (
              <div className="pdf-render-loading">
                <div className="writing-chapter-wrap">
                  <div className="writing-chapter-book" aria-hidden="true">
                    <span className="writing-pen"></span>
                    <span className="writing-line line-1"></span>
                    <span className="writing-line line-2"></span>
                    <span className="writing-line line-3"></span>
                  </div>
                  <div className="writing-chapter-text">
                    Loading PDF Page
                    <span className="writing-dots" aria-hidden="true"></span>
                  </div>
                </div>
              </div>
            )}
            {pdfRenderError && !pdfRenderLoading && !pageLoading && (
              <div className="pdf-render-error text-center">
                <p className="text-danger m-0">{pdfRenderError}</p>
              </div>
            )}
            <div className="pdf-canvas-wrap">
              <canvas ref={pdfCanvasRef} className="pdf-canvas" />
            </div>
          </div>

          <div style={{ height: "60px" }}></div>
        </div>

        <div className="book-bottom-nav position-absolute bottom-0 p-3 d-flex justify-content-between align-items-center" style={{ background: "linear-gradient(to top, #fdfbf7 90%, transparent)", zIndex: 20 }}>
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="ai-btn ai-btn-ghost text-sm d-flex align-items-center"
            style={{ width: "auto", opacity: page === 1 ? 0.5 : 1, padding: "8px 12px", color: "black" }}
          >
            <ArrowLeft size={24} className="mr-1" />
          </button>

          <span className="text-xs text-gray-400 font-mono">{page} / {pageCount}</span>

          <button
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={page >= pageCount}
            className="ai-btn ai-btn-ghost text-sm d-flex align-items-center"
            style={{ width: "auto", opacity: page >= pageCount ? 0.3 : 1, padding: "8px 12px", color: "black" }}
          >
            <ArrowRight size={24} className="ml-1" />
          </button>
        </div>

        <div className="floating-controls">
          <div className="control-btn" onClick={() => setChatOpen((prev) => !prev)} title="Discuss about this page">
            <MessageCircle size={24} />
          </div>
          <div className="control-btn" onClick={handleSummarize} title="Page Summary">
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
          <div className="control-btn" onClick={onExit} title="Exit PDF Reader">
            <LogOut size={24} />
          </div>
        </div>

        <div className={`chat-sidebar ${chatOpen ? "open" : ""}`}>
          <div className="chat-header">
            <span>AI Tutor · Page {page}</span>
            <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          <div className="chat-body space-y-4">
            <div className="chat-bubble-ai">
              Hello! I can answer questions about <strong>{pageData?.title || `page ${page}`}</strong> from this PDF.
            </div>

            {pageData?.chatHistory?.map((msg, idx) => (
              <div key={idx} className={`d-flex ${msg.role === "user" ? "justify-content-end" : ""}`}>
                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} style={{ maxWidth: "85%" }}>
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
                style={{ marginBottom: 0, background: "white" }}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSubmit()}
              />
              <button onClick={handleChatSubmit} className="ai-btn" style={{ width: "auto", padding: "0.5rem 1rem" }} disabled={chatLoading}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {summaryModalOpen && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Page Summary</h3>
              <button onClick={() => setSummaryModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {summaryLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>Generating Summary</span>
                <p className="text-sm text-gray-400">Extracting key points from this page...</p>
              </div>
            ) : (
              <ul className="space-y-3 pl-6 pr-2 max-h-96 overflow-y-auto">
                {currentSummary.map((bullet, idx) => (
                  <li key={idx} className="text-gray-800" style={{ listStyleType: "disc", paddingLeft: "4px", lineHeight: "1.5" }}>
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            <div className="ai-modal-footer mt-6">
              <button onClick={() => setSummaryModalOpen(false)} className="ai-btn ai-btn-secondary" style={{ width: "100%" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {mindmapModalOpen && (
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
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>Generating Concept Tree</span>
                <p className="text-sm text-gray-400">Mapping out the ideas from this page...</p>
              </div>
            ) : (
              <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", maxHeight: "60vh", overflowY: "auto" }}>
                <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "14px", whiteSpace: "pre-wrap", background: "transparent", color: "#1f2937", padding: 0 }}>
                  {currentMindmap}
                </pre>
              </div>
            )}
            <div className="ai-modal-footer mt-6">
              <button onClick={() => setMindmapModalOpen(false)} className="ai-btn ai-btn-secondary" style={{ width: "100%" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {vocabModalOpen && (
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
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>Extracting Words</span>
                <p className="text-sm text-gray-400">Finding unusual and advanced vocabulary...</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {currentVocab.length > 0 ? currentVocab.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
                    <h4 className="font-bold text-gray-900 mb-1" style={{ color: "#a37548" }}>{item.word}</h4>
                    <p className="text-sm text-gray-700 m-0">{item.definition}</p>
                  </div>
                )) : (
                  <p className="text-gray-500 text-center italic py-4">No advanced vocabulary found on this page.</p>
                )}
              </div>
            )}
            <div className="ai-modal-footer mt-6">
              <button onClick={() => setVocabModalOpen(false)} className="ai-btn ai-btn-secondary" style={{ width: "100%" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {mcqModalOpen && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content" style={{ maxWidth: "860px", width: "90%" }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">MCQ</h3>
              <button onClick={() => setMcqModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {mcqLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>Generating MCQ</span>
                <p className="text-sm text-gray-400">Preparing a question for this page...</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {currentMcq ? (
                  <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-3">{currentMcq.question}</h4>
                    <div className="space-y-2">
                      {(currentMcq.options || []).map((option, optionIdx) => {
                        const isCorrect = option === currentMcq.answer;
                        const isSelected = option === selectedMcqOption;
                        let borderColor = "#e5e7eb";
                        let background = "#f9fafb";
                        let color = "#1f2937";
                        if (mcqAnswered && isCorrect) {
                          borderColor = "#86efac";
                          background = "#f0fdf4";
                          color = "#166534";
                        } else if (mcqAnswered && isSelected && !isCorrect) {
                          borderColor = "#fca5a5";
                          background = "#fef2f2";
                          color = "#991b1b";
                        }
                        return (
                          <button
                            type="button"
                            key={optionIdx}
                            className="mcq-option-row mcq-option-button border rounded-lg px-3 py-2 text-sm"
                            onClick={() => handleMcqOptionSelect(option)}
                            disabled={mcqAnswered || mcqGenerating}
                            style={{ borderColor, background, color }}
                          >
                            <span className="mcq-option-label font-semibold">{String.fromCharCode(65 + optionIdx)}.</span>
                            <span className="mcq-option-text">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                    {mcqAnswered && (
                      <div className="mt-3 p-3 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <p className="text-sm m-0" style={{ color: "#166534" }}>
                          <strong>{selectedMcqOption === currentMcq.answer ? "Correct." : "Not quite."}</strong> The right answer is {currentMcq.answer}.
                        </p>
                        {currentMcq.explanation && (
                          <p className="text-sm text-gray-700 m-0 mt-2" style={{ lineHeight: "1.6" }}>
                            <strong>Explanation:</strong> {currentMcq.explanation}
                          </p>
                        )}
                      </div>
                    )}
                    {mcqAnswered && currentMcq.options?.length > 0 && (
                      <button type="button" onClick={() => handleGenerateMcq(false)} className="ai-btn mt-4" disabled={mcqGenerating}>
                        {mcqGenerating ? "Generating..." : "Next Question"}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center italic py-4">Generating MCQ for this page...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {questionAnswerModalOpen && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-content" style={{ maxWidth: "860px", width: "90%" }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="text-xl font-bold mb-0">Q&A</h3>
              <button onClick={() => setQuestionAnswerModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {questionAnswerLoading ? (
              <div className="space-y-4 py-8 d-flex flex-column align-items-center">
                <span className="jumping-dots font-semibold" style={{ fontSize: "18px", color: "#6366f1" }}>Generating Q&amp;A</span>
                <p className="text-sm text-gray-400">Preparing likely questions from this page...</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {currentQuestionAnswers.length > 0 ? currentQuestionAnswers.map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2">{item.question}</h4>
                    <p className="text-sm text-gray-700 m-0" style={{ lineHeight: "1.6" }}>{item.answer}</p>
                  </div>
                )) : (
                  <p className="text-gray-500 text-center italic py-4">No questions were generated for this page.</p>
                )}
              </div>
            )}
            <div className="ai-modal-footer mt-6">
              <button onClick={() => setQuestionAnswerModalOpen(false)} className="ai-btn ai-btn-secondary" style={{ width: "100%" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
