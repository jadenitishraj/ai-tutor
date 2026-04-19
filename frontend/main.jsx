import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BrainCircuit, CloudCog, Heart, MessageSquareQuote, Search, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import AdminPanel from './AdminPanel.jsx'
import AITutorMain from './AITutorMain.jsx'
import GenericBookReader from './GenericBookReader.jsx'
import Header from '../Layout/Header/Header.jsx'
import './ai-tutor.css'

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_TUTOR_API) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_TUTOR_API) ||
  'http://localhost:8000'

function getAuthToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ai_tutor_token')
  }
  return null
}

function buildAnswerHtml(sections) {
  return sections
    .map((section) => {
      if (section.type === 'heading') return `<h3>${section.text}</h3>`
      if (section.type === 'list') return `<ul>${section.items.map((item) => `<li>${item}</li>`).join('')}</ul>`
      return `<p>${section.text}</p>`
    })
    .join('')
}

const featuredTracks = [
  {
    id: 'agentic-ai',
    eyebrow: 'Track 01',
    title: 'Agentic AI',
    subtitle: 'Master tools, memory, orchestration, safety, and real multi-agent architecture tradeoffs.',
    bullets: ['Tool use and planning', 'Agent loops', 'Observability', 'Failure handling'],
    accent: 'cyan',
  },
  {
    id: 'aws-ai',
    eyebrow: 'Track 02',
    title: 'AWS for AI',
    subtitle: 'Architect production-grade GenAI systems on AWS with interviewer-focused depth.',
    bullets: ['RAG on AWS', 'Bedrock patterns', 'PDF pipelines', 'Evaluation and scaling'],
    accent: 'orange',
  },
]

const testimonials = [
  {
    quote: 'This feels closer to how senior AI interviews are actually discussed. The answers are structured, opinionated, and practical.',
    name: 'Priya S.',
    role: 'Applied AI Engineer',
  },
  {
    quote: 'The curated track approach is the difference. I can revise architecture questions fast instead of prompting a bot from scratch every time.',
    name: 'Marcus T.',
    role: 'Staff Candidate, Platform AI',
  },
  {
    quote: 'The format is strong for last-minute prep. You jump straight into high-frequency questions and test yourself immediately.',
    name: 'Ananya R.',
    role: 'ML Engineer',
  },
]

const ROUTES = {
  home: '/',
  free: '/',
  tutor: '/ai-tutor',
  admin: '/admin/interview-prep',
  'track-agentic-ai': '/tracks/agentic-ai',
  'track-aws-ai': '/tracks/aws-for-ai',
}

function getTrackSlugFromView(view) {
  if (view === 'track-aws-ai') return 'aws-for-ai'
  if (view === 'track-agentic-ai') return 'agentic-ai'
  return ''
}

function getViewFromTrackSlug(trackSlug) {
  if (trackSlug === 'aws-for-ai') return 'track-aws-ai'
  if (trackSlug === 'agentic-ai') return 'track-agentic-ai'
  return 'home'
}

function getQuestionPath(trackId, questionNumber) {
  const basePath = trackId === 'aws-for-ai' ? '/tracks/aws-for-ai' : '/tracks/agentic-ai'
  return `${basePath}/questions/${questionNumber}`
}

function getRouteStateFromPath(pathname) {
  const adminTrackMatch = pathname.match(/^\/admin\/interview-prep\/([^/]+)$/)
  if (adminTrackMatch) {
    return { view: 'admin', questionNumber: null, adminTrackSlug: adminTrackMatch[1] }
  }

  if (pathname === '/admin/interview-prep') {
    return { view: 'admin', questionNumber: null, adminTrackSlug: null }
  }

  const agenticQuestionMatch = pathname.match(/^\/tracks\/agentic-ai\/questions\/(\d+)$/)
  if (agenticQuestionMatch) {
    return { view: 'track-agentic-ai', questionNumber: Number(agenticQuestionMatch[1]), adminTrackSlug: null }
  }

  const awsQuestionMatch = pathname.match(/^\/tracks\/aws-for-ai\/questions\/(\d+)$/)
  if (awsQuestionMatch) {
    return { view: 'track-aws-ai', questionNumber: Number(awsQuestionMatch[1]), adminTrackSlug: null }
  }

  return { view: getViewFromPath(pathname), questionNumber: null, adminTrackSlug: null }
}

const trackFilters = {
  'agentic-ai': ['All', 'Planning', 'Tools', 'Memory', 'Evaluation', 'Safety', 'Multi-Agent', 'Observability'],
  'aws-ai': ['All', 'RAG', 'Bedrock', 'Pipelines', 'Evaluation', 'Security', 'Scaling', 'OCR'],
}

const trackQuestions = {
  'agentic-ai': [
    { id: 'AA-001', title: 'How do you design an agent loop for reliable task execution?', difficulty: 'Medium', tags: ['Planning', 'Tools', 'Reliability'], favorite: true, content: buildAnswerHtml([{ text: 'A reliable agent loop should separate planning, execution, observation, and retry decisions instead of letting one prompt do everything.' }, { type: 'heading', text: 'Recommended structure' }, { type: 'list', items: ['Accept a user goal and convert it into a bounded task plan.', 'Run one step at a time through explicit tool calls.', 'Capture tool output as structured observations.', 'Decide whether to continue, recover, or stop.', 'Log every transition for replay and debugging.'] }, { text: 'The key interview point is control. The loop must have guardrails for retries, timeouts, bad tool outputs, and stop conditions so the agent does not drift forever.' }]) },
    { id: 'AA-002', title: 'When should an agent use tools vs answer directly from context?', difficulty: 'Easy', tags: ['Tools', 'Prompting'], favorite: false, content: buildAnswerHtml([{ text: 'An agent should answer directly when the available context is sufficient and stable. It should use tools when the answer depends on fresh data, private systems, calculations, or side effects.' }, { type: 'heading', text: 'Interview framing' }, { type: 'list', items: ['Use direct reasoning for summarization, explanation, and synthesis.', 'Use tools for search, retrieval, actions, or verification.', 'Prefer tool use when correctness matters more than latency.', 'Avoid unnecessary tool calls to reduce cost and failure surface area.'] }]) },
    { id: 'AA-003', title: 'How would you add memory to an agent without polluting future decisions?', difficulty: 'Medium', tags: ['Memory', 'Context'], favorite: false, content: buildAnswerHtml([{ text: 'Memory should be selective, typed, and scoped. If you dump raw history into every turn, the agent becomes noisy and starts amplifying stale assumptions.' }, { type: 'list', items: ['Separate working memory from long-term memory.', 'Store only durable facts, preferences, and important outcomes.', 'Attach timestamps and confidence scores.', 'Retrieve memory by relevance, not by dumping everything into the prompt.'] }, { text: 'In interviews, mention memory hygiene: summarization, expiration, and conflict resolution matter as much as retrieval itself.' }]) },
    { id: 'AA-004', title: 'What failure modes matter most in multi-agent orchestration?', difficulty: 'Hard', tags: ['Multi-Agent', 'Observability', 'Safety'], favorite: true, content: buildAnswerHtml([{ text: 'Multi-agent systems fail when coordination is ambiguous. Agents can duplicate work, contradict each other, or pass low-quality outputs downstream without validation.' }, { type: 'heading', text: 'High-risk failure modes' }, { type: 'list', items: ['No single source of truth for task state.', 'Recursive delegation loops.', 'Unclear ownership between planner and worker agents.', 'Tool-call storms caused by poor stopping criteria.', 'Difficult debugging because traces are fragmented across agents.'] }, { text: 'A strong answer should propose central orchestration, explicit contracts between agents, and traceable handoffs.' }]) },
    { id: 'AA-005', title: 'How do you evaluate whether an agent is actually improving task completion?', difficulty: 'Medium', tags: ['Evaluation', 'Metrics'], favorite: false, content: buildAnswerHtml([{ text: 'You need task-level evaluation, not just model-level evaluation. The real question is whether the system completes user goals more accurately, faster, and with fewer escalations.' }, { type: 'list', items: ['Measure success rate on representative tasks.', 'Track number of tool calls and retries.', 'Capture latency, cost, and human escalation rate.', 'Evaluate failure recovery and instruction following.', 'Use golden tasks and adversarial tasks together.'] }]) },
    { id: 'AA-006', title: 'How do you prevent tool misuse and unsafe autonomous behavior?', difficulty: 'Hard', tags: ['Safety', 'Governance'], favorite: false, content: buildAnswerHtml([{ text: 'Safety is a systems problem. The model prompt alone is not a sufficient control plane for autonomous behavior.' }, { type: 'list', items: ['Enforce allowlists for tools and arguments.', 'Require confirmation for high-impact actions.', 'Run policy checks before execution.', 'Limit recursion depth, budgets, and session duration.', 'Audit every action with traceable metadata.'] }, { text: 'Interviewers usually want to hear about layered controls: prompt, policy, runtime, and human approval.' }]) },
    { id: 'AA-007', title: 'How do planners, executors, and critics differ in an agentic system?', difficulty: 'Easy', tags: ['Planning', 'Multi-Agent'], favorite: false, content: buildAnswerHtml([{ text: 'These roles exist to reduce cognitive overload. Instead of one model handling everything, you split responsibilities.' }, { type: 'list', items: ['Planner: decomposes the goal into steps.', 'Executor: performs the actual tool calls or transformations.', 'Critic: reviews outputs for quality, risk, or completeness.'] }, { text: 'The value of this split is controllability. Each role can have a narrower prompt, better evaluation, and clearer accountability.' }]) },
    { id: 'AA-008', title: 'How would you observe and debug an agent that intermittently fails?', difficulty: 'Medium', tags: ['Observability', 'Tracing'], favorite: true, content: buildAnswerHtml([{ text: 'Intermittent failures require full-fidelity traces. Without structured logs, you will not know whether the issue came from retrieval, planning, tools, or prompts.' }, { type: 'list', items: ['Trace every prompt, tool input, tool output, and stop reason.', 'Attach request IDs to every agent step.', 'Record latency and token usage per node.', 'Store replayable sessions for debugging.', 'Compare successful vs failed traces side by side.'] }]) },
  ],
  'aws-ai': [
    { id: 'AWS-001', title: 'How would you build a Bedrock-based RAG system on AWS?', difficulty: 'Medium', tags: ['RAG', 'Bedrock', 'Architecture'], favorite: true, content: buildAnswerHtml([{ text: 'A strong AWS RAG answer usually starts with ingestion, indexing, retrieval, orchestration, and monitoring as distinct layers.' }, { type: 'list', items: ['Ingest documents into S3.', 'Extract text and metadata through a processing pipeline.', 'Store embeddings in a vector-capable store.', 'Use a Bedrock model for response generation.', 'Add evaluation and observability around retrieval quality and latency.'] }, { text: 'Interviewers also expect tradeoffs: managed services speed delivery, but custom retrieval and ranking may be needed at scale.' }]) },
    { id: 'AWS-002', title: 'How do you handle PDF parsing and OCR for enterprise knowledge ingestion?', difficulty: 'Hard', tags: ['Pipelines', 'OCR'], favorite: false, content: buildAnswerHtml([{ text: 'Enterprise PDFs are messy. They include tables, images, scanned pages, headers, and inconsistent structure, so parsing must be staged instead of naive.' }, { type: 'list', items: ['Classify the document type first.', 'Use OCR only where text extraction fails.', 'Preserve layout-aware chunks for tables and forms.', 'Store page-level provenance and confidence scores.', 'Route low-confidence pages for fallback or review.'] }]) },
    { id: 'AWS-003', title: 'What services would you choose for secure GenAI workloads on AWS?', difficulty: 'Medium', tags: ['Security', 'Bedrock'], favorite: false, content: buildAnswerHtml([{ text: 'Security should be described as identity, network, data, and audit controls around the full GenAI workflow.' }, { type: 'list', items: ['Use IAM for scoped access control.', 'Keep private data inside VPC-connected services where possible.', 'Encrypt data at rest and in transit.', 'Separate ingestion, serving, and admin roles.', 'Log prompts, outputs, and access events with compliance in mind.'] }]) },
    { id: 'AWS-004', title: 'How do you evaluate retrieval and generation quality in production?', difficulty: 'Medium', tags: ['Evaluation', 'RAG'], favorite: true, content: buildAnswerHtml([{ text: 'Production evaluation should measure both retrieval quality and answer quality, because a good model cannot recover from bad context.' }, { type: 'list', items: ['Track hit rate and relevance for retrieved chunks.', 'Measure groundedness and hallucination frequency.', 'Use offline golden datasets plus online feedback.', 'Evaluate by document type, tenant, and query class.', 'Monitor drift when the corpus changes.'] }]) },
    { id: 'AWS-005', title: 'How would you scale ingestion pipelines for image-heavy documents?', difficulty: 'Hard', tags: ['Pipelines', 'Scaling', 'OCR'], favorite: false, content: buildAnswerHtml([{ text: 'Scaling image-heavy ingestion requires asynchronous pipelines, backpressure control, and cost-aware OCR strategies.' }, { type: 'list', items: ['Split ingestion into queue-based stages.', 'Separate OCR, parsing, enrichment, and chunking workers.', 'Cache intermediate outputs to avoid repeat OCR.', 'Prioritize documents by business value or freshness.', 'Add dead-letter handling for low-quality files.'] }]) },
    { id: 'AWS-006', title: 'How do you reduce latency in an AWS-hosted GenAI architecture?', difficulty: 'Easy', tags: ['Scaling', 'Architecture'], favorite: false, content: buildAnswerHtml([{ text: 'Latency usually comes from retrieval, network hops, large prompts, and model generation time. A good answer isolates each contributor.' }, { type: 'list', items: ['Shrink prompt context through better retrieval.', 'Cache frequent results.', 'Precompute embeddings and metadata.', 'Reduce cross-region calls.', 'Use lighter models for routing, ranking, or simple responses.'] }]) },
  ],
}

function getViewFromPath(pathname) {
  if (pathname === '/ai-tutor') return 'tutor'
  if (pathname === '/tracks/agentic-ai') return 'track-agentic-ai'
  if (pathname === '/tracks/aws-for-ai') return 'track-aws-ai'
  return 'home'
}

function HomePage({ onNavigate }) {
  const openTrack = (trackId) => onNavigate(`track-${trackId}`)

  return (
    <div className="home-shell">
      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="hero-kicker">
            <Sparkles size={16} />
            Premium conceptual interview prep
          </span>
          <h1>LeetCode for AI architecture interviews.</h1>
          <p>
            Curated tracks, admin-verified answers, community proof, and AI study tools built for high-signal preparation.
          </p>
          <div className="hero-actions">
            <button className="hero-btn hero-btn--primary" type="button" onClick={() => onNavigate('home')}>
              Explore Courses
              <ArrowRight size={18} />
            </button>
            <button className="hero-btn hero-btn--secondary" type="button" onClick={() => onNavigate('tutor')}>
              Open AI Tutor
            </button>
          </div>
          <div className="hero-metrics">
            <div>
              <strong>2</strong>
              <span>Featured tracks live</span>
            </div>
            <div>
              <strong>25+</strong>
              <span>Question-ready format</span>
            </div>
            <div>
              <strong>Free</strong>
              <span>Everything available now</span>
            </div>
          </div>
        </div>

        <motion.div
          className="hero-spotlight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="spotlight-orb spotlight-orb--orange" />
          <div className="spotlight-orb spotlight-orb--blue" />
          <div className="hero-preview-card">
            <div className="hero-preview-card__header">
              <span>Interview prep OS</span>
              <span className="hero-preview-card__free">Completely free</span>
            </div>
            <div className="hero-preview-card__body">
              <button className="preview-pill preview-pill--clickable" type="button" onClick={() => openTrack('agentic-ai')}>
                <BrainCircuit size={16} />
                Agentic AI
                <span className="preview-pill__free">Free</span>
              </button>
              <button className="preview-pill preview-pill--clickable" type="button" onClick={() => openTrack('aws-ai')}>
                <CloudCog size={16} />
                AWS for AI
                <span className="preview-pill__free">Free</span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span>Courses</span>
          <h2>Featured tracks on the homepage</h2>
          <p>Built with space for more tracks later. For now, these are the two flagship courses.</p>
        </div>

        <div className="course-grid">
          {featuredTracks.map((track, index) => (
            <motion.article
              key={track.id}
              className={`course-card course-card--${track.accent} course-card--interactive`}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              onClick={() => openTrack(track.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openTrack(track.id)
                }
              }}
            >
              <div className="course-card__glow" />
              <div className="course-card__content">
                <span className="course-card__eyebrow">{track.eyebrow}</span>
                <h3>{track.title}</h3>
                <p>{track.subtitle}</p>
                <ul>
                  {track.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="course-card__footer">
                  <span className="course-card__free">Free</span>
                  <span className="course-card__hint">
                    Open track
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </motion.article>
          ))}

          <article className="course-card course-card--placeholder">
            <div className="course-card__content">
              <span className="course-card__eyebrow">Future Tracks</span>
              <h3>React, Node.js, System Design</h3>
              <p>The layout already leaves room for more curated interview courses as you expand the catalog.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section-block section-block--split">
        <div className="value-card">
          <span className="value-card__icon"><MessageSquareQuote size={18} /></span>
          <h3>Community-backed prep</h3>
          <p>Pair curated answers with future discussion threads, interview reports, and popularity signals.</p>
        </div>
        <div className="value-card">
          <span className="value-card__icon"><Users size={18} /></span>
          <h3>Free right now</h3>
          <p>Every course on the homepage is clearly marked free so the offer feels immediate and easy to try.</p>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span>Testimonials</span>
          <h2>Positioned like a serious prep product</h2>
        </div>

        <div className="testimonial-grid">
          {testimonials.map((item) => (
            <article key={item.name} className="testimonial-card">
              <p>"{item.quote}"</p>
              <strong>{item.name}</strong>
              <span>{item.role}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function getDifficultyClass(difficulty) {
  if (difficulty === 'Easy') return 'is-easy'
  if (difficulty === 'Hard') return 'is-hard'
  return 'is-medium'
}

function TrackPage({ onBack, track, onReaderStateChange, selectedQuestionNumber, onOpenQuestion, onCloseQuestion }) {
  const fallbackQuestions = trackQuestions[track.id] || []
  const fallbackFilters = trackFilters[track.id] || ['All']
  const [trackData, setTrackData] = useState(null)
  const [trackLoading, setTrackLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(fallbackQuestions.filter((item) => item.favorite).map((item) => item.id)))
  const [readerPage, setReaderPage] = useState(selectedQuestionNumber ? Math.max(1, Math.min(fallbackQuestions.length || 1, selectedQuestionNumber)) : null)

  const trackSlug = track.id === 'aws-ai' ? 'aws-for-ai' : track.id

  useEffect(() => {
    let ignore = false
    const loadTrack = async () => {
      setTrackLoading(true)
      try {
        const res = await fetch(`${BACKEND_URL}/api/interview-tracks/${trackSlug}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to load track')
        if (!ignore) {
          setTrackData(data.track)
          setFavoriteIds(new Set((data.track.questions || []).filter((item) => item.favorite).map((item) => item.id)))
        }
      } catch (error) {
        console.error(error)
        if (!ignore) setTrackData(null)
      } finally {
        if (!ignore) setTrackLoading(false)
      }
    }

    loadTrack()
    return () => {
      ignore = true
    }
  }, [trackSlug])

  const questions = (trackData?.questions || []).map((question, index) => ({
    id: question.id || `${trackSlug}-${question.number || index + 1}`,
    number: question.number || index + 1,
    title: question.title,
    difficulty: question.difficulty,
    category: question.category || question.tags?.[0] || 'General',
    tags: question.tags || [],
    favorite: question.favorite || false,
    content: question.answer_html || question.content || '',
  }))

  const filters = trackData
    ? ['All', ...Array.from(new Set([...(trackData.categories || []), ...(trackData.tags || [])]))]
    : fallbackFilters

  const effectiveQuestions = questions.length ? questions : fallbackQuestions.map((question, index) => ({
    ...question,
    number: index + 1,
    category: question.category || question.tags?.[0] || 'General',
  }))

  useEffect(() => {
    if (selectedQuestionNumber) {
      setReaderPage(Math.max(1, Math.min(effectiveQuestions.length || 1, selectedQuestionNumber)))
    } else {
      setReaderPage(null)
    }
  }, [effectiveQuestions.length, selectedQuestionNumber])

  useEffect(() => {
    onReaderStateChange?.(readerPage !== null)
  }, [onReaderStateChange, readerPage])

  const filteredQuestions = effectiveQuestions.filter((question) => {
    const matchesFilter = activeFilter === 'All' || question.category === activeFilter || question.tags.includes(activeFilter)
    const normalized = searchQuery.trim().toLowerCase()
    const matchesSearch =
      normalized.length === 0 ||
      question.title.toLowerCase().includes(normalized) ||
      question.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
      question.id.toLowerCase().includes(normalized)

    return matchesFilter && matchesSearch
  })

  const toggleFavorite = (questionId) => {
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  const openQuestion = (questionId) => {
    const index = effectiveQuestions.findIndex((question) => question.id === questionId)
    if (index !== -1) {
      const nextPage = index + 1
      setReaderPage(nextPage)
      onOpenQuestion?.(trackSlug, nextPage)
    }
  }

  const contentToolRequest = async (path, body) => {
    const token = getAuthToken()
    const res = await fetch(`${BACKEND_URL}/api/ai-tutor/content-tools${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || `Failed request for ${path}`)
    return data
  }

  const numberedQuestions = effectiveQuestions.map((question, index) => ({
    ...question,
    number: question.number || index + 1,
  }))

  const questionPages = numberedQuestions.map((question) => ({
    id: question.id,
    title: question.title,
    number: question.number,
    content: question.content,
    chatHistory: [],
  }))

  const selectedQuestion = readerPage && readerPage > 0 ? questionPages[readerPage - 1] : null

  const trackToolAdapter = {
    sendChat: async ({ page, message, history }) => {
      const data = await contentToolRequest('/chat', {
        chapter_title: page.title,
        chapter_content: page.content,
        message,
        recent_history: history,
      })
      return data.content
    },
    summarize: async ({ page }) => {
      const data = await contentToolRequest('/summary', {
        chapter_title: page.title,
        chapter_content: page.content,
      })
      return data.bullets || []
    },
    mindmap: async ({ page }) => {
      const data = await contentToolRequest('/mindmap', {
        chapter_title: page.title,
        chapter_content: page.content,
      })
      return data.tree || ''
    },
    vocab: async ({ page }) => {
      const data = await contentToolRequest('/vocab', {
        chapter_title: page.title,
        chapter_content: page.content,
      })
      return data.vocab || []
    },
    mcq: async ({ page, existingMcqs }) => {
      const data = await contentToolRequest('/mcq', {
        chapter_title: page.title,
        chapter_content: page.content,
        existing_mcqs: existingMcqs,
      })
      return data.mcq
    },
    questionAnswer: async ({ page }) => {
      const data = await contentToolRequest('/question-answer', {
        chapter_title: page.title,
        chapter_content: page.content,
      })
      return data.question_answers || []
    },
  }

  if (readerPage !== null) {
    return (
        <GenericBookReader
          documentTitle={trackData?.title || track.title}
          tocTitle={`${trackData?.title || track.title} Questions`}
          tocItems={numberedQuestions.map((question) => `${question.number}. ${question.title}`)}
          pageIndex={readerPage}
          totalPages={numberedQuestions.length + 1}
          isTocPage={readerPage === 0}
          currentPageId={selectedQuestion?.id}
          currentPageTitle={selectedQuestion ? `${selectedQuestion.number}. ${selectedQuestion.title}` : undefined}
          currentPageContent={selectedQuestion?.content}
          initialChatHistory={[]}
        currentPageLoading={false}
        nextPageLoading={false}
        disablePrev={readerPage === 0}
          disableNext={readerPage >= numberedQuestions.length}
        onPrevPage={() => {
          const nextPage = Math.max(0, readerPage - 1)
          setReaderPage(nextPage)
          if (nextPage === 0) {
            onCloseQuestion?.(trackSlug)
          } else {
            onOpenQuestion?.(trackSlug, nextPage)
          }
        }}
          onNextPage={() => {
          const nextPage = Math.min(numberedQuestions.length, readerPage + 1)
          setReaderPage(nextPage)
          onOpenQuestion?.(trackSlug, nextPage)
        }}
        onBack={() => {
          setReaderPage(null)
          onCloseQuestion?.(trackSlug)
        }}
        onExit={() => {
          setReaderPage(null)
          onCloseQuestion?.(trackSlug)
        }}
        toolAdapter={trackToolAdapter}
        downloadConfig={{
          documentTitle: trackData?.title || track.title,
          tocTitle: `${trackData?.title || track.title} Questions`,
          tocItems: numberedQuestions.map((question) => `${question.number}. ${question.title}`),
          pages: questionPages,
          currentPageNumber: readerPage + 1,
        }}
        assistantLabel="Interview Prep AI"
        sidebarTitle={`${trackData?.title || track.title} Flow`}
        sidebarItems={numberedQuestions.map((question, index) => ({
          id: question.id,
          title: question.title,
          number: question.number,
          pageIndex: index + 1,
        }))}
        onSelectSidebarItem={(item) => {
          setReaderPage(item.pageIndex)
          onOpenQuestion?.(trackSlug, item.pageIndex)
        }}
      />
    )
  }

  return (
    <div className="home-shell">
      <section className="track-page">
        <div className="track-page__hero">
          <button className="track-page__back" type="button" onClick={onBack}>
            <ArrowLeft size={18} />
            Back to courses
          </button>

          <div className="track-page__hero-content">
            <span className="track-page__eyebrow">{track.eyebrow}</span>
            <h1>{trackData?.title || track.title}</h1>
            <p>{trackData?.subtitle || track.subtitle}</p>
          </div>

          <div className="track-page__stats">
            <div className="track-page__stat">
              <strong>{numberedQuestions.length}</strong>
              <span>Questions</span>
            </div>
            <div className="track-page__stat">
              <strong>{favoriteIds.size}</strong>
              <span>Favorites</span>
            </div>
            <div className="track-page__stat">
              <strong>Free</strong>
              <span>Access</span>
            </div>
          </div>
        </div>

        <div className="track-toolbar">
          <div className="track-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search questions, tags, or IDs"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <button className="track-toolbar__button" type="button">
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        <div className="track-filters" role="tablist" aria-label="Track filters">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`track-filter ${activeFilter === filter ? 'is-active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="track-list">
          <div className="track-list__header">
            <span>Questions</span>
            <span>{trackLoading ? 'Syncing...' : `${filteredQuestions.length} visible`}</span>
          </div>

          {filteredQuestions.map((question) => {
            const isFavorite = favoriteIds.has(question.id)
            const questionNumber = question.number

            return (
              <article key={question.id} className="track-question-card" onClick={() => openQuestion(question.id)} role="button" tabIndex={0} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openQuestion(question.id)
                }
              }}>
                <div className="track-question-card__main">
                  <div className="track-question-card__meta">
                    <span className="track-question-card__id">{questionNumber}</span>
                    <span className={`difficulty-pill ${getDifficultyClass(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  </div>

                  <h3>{questionNumber}. {question.title}</h3>

                  <div className="track-question-card__tags">
                    {question.tags.map((tag) => (
                      <span key={tag} className="question-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  className={`favorite-button ${isFavorite ? 'is-active' : ''}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleFavorite(question.id)
                  }}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                >
                  <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                  {isFavorite ? 'Saved' : 'Favorite'}
                </button>
              </article>
            )
          })}

          {filteredQuestions.length === 0 ? (
            <div className="track-empty-state">
              <strong>No questions match this search.</strong>
              <span>Try another keyword or switch filters.</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function AppShell() {
  const initialRouteState = getRouteStateFromPath(window.location.pathname)
  const [view, setView] = useState(initialRouteState.view)
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState(initialRouteState.questionNumber)
  const [adminTrackSlug, setAdminTrackSlug] = useState(initialRouteState.adminTrackSlug)
  const [tutorReadingMode, setTutorReadingMode] = useState(false)
  const [trackReadingMode, setTrackReadingMode] = useState(false)
  const activeTrack = featuredTracks.find((track) => `track-${track.id}` === view)
  const hideHeader = tutorReadingMode || trackReadingMode

  useEffect(() => {
    const handlePopState = () => {
      const routeState = getRouteStateFromPath(window.location.pathname)
      setView(routeState.view)
      setSelectedQuestionNumber(routeState.questionNumber)
      setAdminTrackSlug(routeState.adminTrackSlug)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (view !== 'tutor') {
      setTutorReadingMode(false)
    }
    if (!String(view).startsWith('track-')) {
      setTrackReadingMode(false)
      setSelectedQuestionNumber(null)
    }
    if (view !== 'admin') {
      setAdminTrackSlug(null)
    }
  }, [view])

  const navigate = (nextView) => {
    const nextPath = ROUTES[nextView] || '/'
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setView(nextView)
    setSelectedQuestionNumber(null)
    setAdminTrackSlug(null)
  }

  const navigateToQuestion = (trackId, questionNumber) => {
    const nextView = getViewFromTrackSlug(trackId)
    const nextPath = getQuestionPath(trackId, questionNumber)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setView(nextView)
    setSelectedQuestionNumber(questionNumber)
  }

  const navigateToTrackHome = (trackId) => {
    const nextView = getViewFromTrackSlug(trackId)
    const nextPath = ROUTES[nextView] || '/'
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setView(nextView)
    setSelectedQuestionNumber(null)
  }

  const navigateToAdminTrack = (trackSlug) => {
    const nextPath = trackSlug ? `/admin/interview-prep/${trackSlug}` : '/admin/interview-prep'
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setView('admin')
    setAdminTrackSlug(trackSlug || null)
    setSelectedQuestionNumber(null)
  }

  return (
    <div className="app-shell">
      {!hideHeader ? <Header activeView={view} onNavigate={navigate} /> : null}
      {view === 'tutor' ? <AITutorMain showHeader={false} onNavigate={navigate} onReadingModeChange={setTutorReadingMode} /> : null}
      {view === 'home' || view === 'free' ? <HomePage onNavigate={navigate} /> : null}
      {activeTrack ? <TrackPage onBack={() => navigate('home')} track={activeTrack} onReaderStateChange={setTrackReadingMode} selectedQuestionNumber={selectedQuestionNumber} onOpenQuestion={navigateToQuestion} onCloseQuestion={navigateToTrackHome} /> : null}
      {view === 'admin' ? <AdminPanel activeTrackSlug={adminTrackSlug} onSelectTrack={navigateToAdminTrack} onBackHome={() => navigate('home')} /> : null}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
)
