"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FolderPlus, Plus, Save, Tags, Trash2 } from "lucide-react";

import "./ai-tutor.css";

const BACKEND_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_TUTOR_API) ||
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AI_TUTOR_API) ||
  "http://localhost:8000";

function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ai_tutor_token");
  }
  return null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function markdownToHtml(text) {
  const lines = text.split("\n");
  const chunks = [];
  let inCode = false;
  let codeBuffer = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length) {
      chunks.push(`<ul>${listBuffer.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  const flushCode = () => {
    if (codeBuffer.length) {
      const safe = codeBuffer
        .join("\n")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      chunks.push(`<pre><code>${safe}</code></pre>`);
      codeBuffer = [];
    }
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      flushList();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      listBuffer.push(line.trim().slice(2));
      return;
    }

    flushList();

    if (!line.trim()) {
      return;
    }

    if (line.startsWith("### ")) {
      chunks.push(`<h3>${line.slice(4)}</h3>`);
    } else if (line.startsWith("## ")) {
      chunks.push(`<h2>${line.slice(3)}</h2>`);
    } else if (line.startsWith("# ")) {
      chunks.push(`<h1>${line.slice(2)}</h1>`);
    } else {
      chunks.push(`<p>${line}</p>`);
    }
  });

  flushList();
  flushCode();
  return chunks.join("");
}

function normalizeAnswerHtml(html) {
  if (!html?.trim()) return "";
  if (typeof window === "undefined") return html.trim();

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html.trim();

  const blockTags = new Set(["P", "DIV", "H1", "H2", "H3", "UL", "OL", "PRE", "BLOCKQUOTE"]);
  const preserveEmptyTags = new Set(["IMG", "VIDEO", "IFRAME", "PRE", "UL", "OL", "BLOCKQUOTE"]);

  Array.from(root.querySelectorAll("div")).forEach((node) => {
    if (node.closest("pre")) return;
    const hasBlockChildren = Array.from(node.children).some((child) => blockTags.has(child.tagName));
    if (!hasBlockChildren) {
      const paragraph = doc.createElement("p");
      paragraph.innerHTML = node.innerHTML.trim() || "<br>";
      node.replaceWith(paragraph);
    }
  });

  Array.from(root.querySelectorAll("p, div")).forEach((node) => {
    const hasMeaningfulChild = Array.from(node.children).some((child) => preserveEmptyTags.has(child.tagName));
    const text = (node.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!hasMeaningfulChild && !text && node.innerHTML.replace(/<br\s*\/?>/gi, "").trim() === "") {
      node.remove();
    }
  });

  return root.innerHTML
    .replace(/(<p><br><\/p>\s*){2,}/gi, "<p><br></p>")
    .trim();
}

function RichHtmlEditor({ value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (command, commandValue = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  };

  const wrapSelectionAsCode = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const text = selection.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    document.execCommand("insertHTML", false, `<pre><code>${text}</code></pre>`);
    onChange(editorRef.current?.innerHTML || "");
  };

  const handlePaste = (event) => {
    const html = event.clipboardData.getData("text/html");
    const plain = event.clipboardData.getData("text/plain");
    if (html) {
      event.preventDefault();
      document.execCommand("insertHTML", false, html);
      onChange(editorRef.current?.innerHTML || "");
      return;
    }

    if (plain) {
      event.preventDefault();
      const normalized = plain.includes("```") ? markdownToHtml(plain) : plain.replace(/\n/g, "<br />");
      document.execCommand("insertHTML", false, normalized);
      onChange(editorRef.current?.innerHTML || "");
    }
  };

  return (
    <div className="admin-editor">
      <div className="admin-editor__toolbar">
        <button type="button" onClick={() => exec("bold")}>Bold</button>
        <button type="button" onClick={() => exec("italic")}>Italic</button>
        <button type="button" onClick={() => exec("formatBlock", "<h3>")}>H3</button>
        <button type="button" onClick={() => exec("insertUnorderedList")}>Bullet</button>
        <button type="button" onClick={wrapSelectionAsCode}>Code Block</button>
        <button type="button" onClick={() => exec("removeFormat")}>Clear</button>
      </div>
      <div
        ref={editorRef}
        className="admin-editor__surface content-html"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || "")}
        onPaste={handlePaste}
      />
    </div>
  );
}

export default function AdminPanel({ activeTrackSlug, onSelectTrack, onBackHome }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackSubtitle, setNewTrackSubtitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionDifficulty, setQuestionDifficulty] = useState("Medium");
  const [questionCategory, setQuestionCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [newInlineTag, setNewInlineTag] = useState("");
  const [answerHtml, setAnswerHtml] = useState("<p>Paste answer content here.</p>");
  const [saving, setSaving] = useState(false);
  const [editingQuestionNumber, setEditingQuestionNumber] = useState(null);
  const normalizedAnswerHtml = useMemo(() => normalizeAnswerHtml(answerHtml), [answerHtml]);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.slug === activeTrackSlug) || null,
    [tracks, activeTrackSlug]
  );

  const adminRequest = async (path, options = {}) => {
    const token = getAuthToken();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      setUnauthorized(true);
      throw new Error("Sign in required");
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Request failed");
    }
    return data;
  };

  const loadTracks = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest("/api/admin/interview-tracks");
      setTracks(data.tracks || []);
    } catch (err) {
      console.error(err);
      if (err.message !== "Sign in required") {
        setError(err.message || "Failed to load tracks");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  useEffect(() => {
    if (activeTrack) {
      setQuestionCategory(activeTrack.categories?.[0] || "");
      setSelectedTags([]);
    }
  }, [activeTrack]);

  const resetQuestionForm = () => {
    setEditingQuestionNumber(null);
    setQuestionTitle("");
    setQuestionDifficulty("Medium");
    setQuestionCategory(activeTrack?.categories?.[0] || "");
    setSelectedTags([]);
    setNewInlineTag("");
    setAnswerHtml("<p>Paste answer content here.</p>");
  };

  const loadQuestionIntoEditor = (question) => {
    setEditingQuestionNumber(question.number);
    setQuestionTitle(question.title || "");
    setQuestionDifficulty(question.difficulty || "Medium");
    setQuestionCategory(question.category || activeTrack?.categories?.[0] || "");
    setSelectedTags(question.tags || []);
    setNewInlineTag("");
    setAnswerHtml(question.answer_html || "<p>Paste answer content here.</p>");
  };

  const createTrack = async () => {
    if (!newTrackTitle.trim()) return;
    setSaving(true);
    try {
      await adminRequest("/api/admin/interview-tracks", {
        method: "POST",
        body: JSON.stringify({
          title: newTrackTitle.trim(),
          slug: slugify(newTrackTitle),
          subtitle: newTrackSubtitle.trim(),
          accent: "cyan",
        }),
      });
      setNewTrackTitle("");
      setNewTrackSubtitle("");
      await loadTracks();
    } catch (err) {
      setError(err.message || "Failed to create track");
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!activeTrack || !newCategory.trim()) return;
    setSaving(true);
    try {
      const data = await adminRequest(`/api/admin/interview-tracks/${activeTrack.slug}/categories`, {
        method: "POST",
        body: JSON.stringify({ value: newCategory.trim() }),
      });
      setTracks((prev) => prev.map((track) => (track.slug === activeTrack.slug ? data.track : track)));
      setQuestionCategory(data.track.categories?.[0] || "");
      setNewCategory("");
    } catch (err) {
      setError(err.message || "Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  const addTag = async (value = newTag) => {
    if (!activeTrack || !value.trim()) return;
    setSaving(true);
    try {
      const data = await adminRequest(`/api/admin/interview-tracks/${activeTrack.slug}/tags`, {
        method: "POST",
        body: JSON.stringify({ value: value.trim() }),
      });
      setTracks((prev) => prev.map((track) => (track.slug === activeTrack.slug ? data.track : track)));
      setNewTag("");
      setNewInlineTag("");
    } catch (err) {
      setError(err.message || "Failed to add tag");
    } finally {
      setSaving(false);
    }
  };

  const submitQuestion = async () => {
    if (!activeTrack || !questionTitle.trim() || !questionCategory || !normalizedAnswerHtml.trim()) return;
    const mergedTags = Array.from(new Set([...selectedTags, ...(newInlineTag ? [newInlineTag.trim()] : [])].filter(Boolean)));
    setSaving(true);
    try {
      if (newInlineTag.trim()) {
        await addTag(newInlineTag.trim());
      }

      const path = editingQuestionNumber
        ? `/api/admin/interview-tracks/${activeTrack.slug}/questions/${editingQuestionNumber}`
        : `/api/admin/interview-tracks/${activeTrack.slug}/questions`;
      const method = editingQuestionNumber ? "PUT" : "POST";

      const data = await adminRequest(path, {
        method,
        body: JSON.stringify({
          ...(editingQuestionNumber ? { number: editingQuestionNumber } : {}),
          category: questionCategory,
          difficulty: questionDifficulty,
          title: questionTitle.trim(),
          tags: mergedTags,
          answer_html: normalizedAnswerHtml,
        }),
      });
      setTracks((prev) => prev.map((track) => (track.slug === activeTrack.slug ? data.track : track)));
      resetQuestionForm();
    } catch (err) {
      setError(err.message || `Failed to ${editingQuestionNumber ? "update" : "add"} question`);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async () => {
    if (!activeTrack || !editingQuestionNumber) return;
    const confirmed = window.confirm(`Delete question ${editingQuestionNumber}?`);
    if (!confirmed) return;
    setSaving(true);
    try {
      const data = await adminRequest(`/api/admin/interview-tracks/${activeTrack.slug}/questions/${editingQuestionNumber}`, {
        method: "DELETE",
      });
      setTracks((prev) => prev.map((track) => (track.slug === activeTrack.slug ? data.track : track)));
      resetQuestionForm();
    } catch (err) {
      setError(err.message || "Failed to delete question");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="home-shell"><div className="admin-shell"><p>Loading admin panel...</p></div></div>;
  }

  if (unauthorized) {
    return (
      <div className="home-shell">
        <div className="admin-shell">
          <h1>Admin Panel</h1>
          <p>Sign in with Google first. The admin routes use the same token as AI Tutor.</p>
        </div>
      </div>
    );
  }

  if (!activeTrack) {
    return (
      <div className="home-shell">
        <section className="admin-shell">
          <div className="admin-header">
            <div>
              <span className="admin-eyebrow">Admin</span>
              <h1>Interview Track Manager</h1>
              <p>Select a course first, then manage categories, tags, and questions inside it.</p>
            </div>
            <button className="track-page__back" type="button" onClick={onBackHome}>
              <ArrowLeft size={18} />
              Back to site
            </button>
          </div>

          {error ? <div className="admin-alert">{error}</div> : null}

          <div className="admin-create-track">
            <div className="admin-field">
              <label>Course title</label>
              <input value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)} placeholder="Agentic AI" />
            </div>
            <div className="admin-field">
              <label>Subtitle</label>
              <input value={newTrackSubtitle} onChange={(e) => setNewTrackSubtitle(e.target.value)} placeholder="Short course subtitle" />
            </div>
            <button type="button" className="admin-primary-btn" onClick={createTrack} disabled={saving}>
              <FolderPlus size={16} />
              Add Course
            </button>
          </div>

          <div className="admin-course-grid">
            {tracks.map((track) => (
              <button key={track.slug} className="admin-course-card" type="button" onClick={() => onSelectTrack(track.slug)}>
                <span>{track.slug}</span>
                <strong>{track.title}</strong>
                <p>{track.subtitle}</p>
                <small>{track.question_count} questions</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="home-shell">
      <section className="admin-shell">
        <div className="admin-header">
          <div>
            <span className="admin-eyebrow">Admin</span>
            <h1>{activeTrack.title}</h1>
            <p>Manage questions, categories, tags, and the exact answer HTML rendered in the user-facing book UI.</p>
          </div>
          <div className="admin-header__actions">
            <button className="track-page__back" type="button" onClick={() => onSelectTrack(null)}>
              <ArrowLeft size={18} />
              Change course
            </button>
          </div>
        </div>

        {error ? <div className="admin-alert">{error}</div> : null}

        <div className="admin-layout">
          <div className="admin-side">
            <div className="admin-card">
              <div className="admin-card__title">Questions</div>
              <div className="admin-question-list">
                {activeTrack.questions?.map((question) => (
                  <button
                    key={`${question.number}-${question.title}`}
                    type="button"
                    className={`admin-question-list__item ${editingQuestionNumber === question.number ? "is-active" : ""}`}
                    onClick={() => loadQuestionIntoEditor(question)}
                  >
                    <strong>{question.number}. {question.title}</strong>
                    <span>{question.category} • {question.difficulty}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card__title">Categories</div>
              <div className="admin-chip-row">
                {(activeTrack.categories || []).map((item) => <span key={item} className="admin-chip">{item}</span>)}
              </div>
              <div className="admin-inline-form">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Add category" />
                <button type="button" onClick={addCategory}><Plus size={16} /></button>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card__title">Tags</div>
              <div className="admin-chip-row">
                {(activeTrack.tags || []).map((item) => <span key={item} className="admin-chip admin-chip--tag">{item}</span>)}
              </div>
              <div className="admin-inline-form">
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag" />
                <button type="button" onClick={() => addTag()}><Tags size={16} /></button>
              </div>
            </div>
          </div>

          <div className="admin-main">
            <div className="admin-card">
              <div className="admin-card__title">{editingQuestionNumber ? `Edit Question ${editingQuestionNumber}` : "Add Question"}</div>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Question title</label>
                  <input value={questionTitle} onChange={(e) => setQuestionTitle(e.target.value)} placeholder="How do you..." />
                </div>
                <div className="admin-field">
                  <label>Difficulty</label>
                  <select value={questionDifficulty} onChange={(e) => setQuestionDifficulty(e.target.value)}>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label>Category</label>
                  <select value={questionCategory} onChange={(e) => setQuestionCategory(e.target.value)}>
                    <option value="">Select category</option>
                    {(activeTrack.categories || []).map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
                <div className="admin-field">
                  <label>Extra tag</label>
                  <input value={newInlineTag} onChange={(e) => setNewInlineTag(e.target.value)} placeholder="Optional new tag" />
                </div>
              </div>

              <div className="admin-field">
                <label>Select existing tags</label>
                <div className="admin-chip-row">
                  {(activeTrack.tags || []).map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`admin-chip admin-chip--selectable ${selected ? "is-active" : ""}`}
                        onClick={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag])}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="admin-field">
                <label>Answer content</label>
                <RichHtmlEditor value={answerHtml} onChange={setAnswerHtml} />
              </div>

              <div className="admin-preview">
                <div className="admin-card__title">Live Preview</div>
                <div className="admin-preview__surface content-html" dangerouslySetInnerHTML={{ __html: normalizedAnswerHtml }} />
              </div>

              <div className="admin-footer">
                {editingQuestionNumber ? (
                  <button type="button" className="admin-danger-btn" onClick={deleteQuestion} disabled={saving}>
                    <Trash2 size={16} />
                    Delete
                  </button>
                ) : null}
                {editingQuestionNumber ? (
                  <button type="button" className="admin-secondary-btn" onClick={resetQuestionForm} disabled={saving}>
                    Cancel
                  </button>
                ) : null}
                <button type="button" className="admin-primary-btn" onClick={submitQuestion} disabled={saving}>
                  <Save size={16} />
                  {editingQuestionNumber ? "Update Question" : "Save Question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
