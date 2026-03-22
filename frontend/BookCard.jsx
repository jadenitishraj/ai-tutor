import React from 'react';
import { Trash2 } from 'lucide-react';

// Color palette for book covers
const BOOK_COLORS = [
  { cover: '#8B4513', spine: '#5C2E0E', accent: '#D4A76A', text: '#FFF5E0' },
  { cover: '#1B4332', spine: '#0D2818', accent: '#74C69D', text: '#D8F3DC' },
  { cover: '#1A1A5E', spine: '#0E0E3A', accent: '#7B93DB', text: '#E0E5F5' },
  { cover: '#6B2737', spine: '#3D1620', accent: '#D4838F', text: '#F5DDE1' },
  { cover: '#4A3728', spine: '#2E2118', accent: '#C8A882', text: '#F0E6D6' },
  { cover: '#2D4A3E', spine: '#1A2D26', accent: '#88B09A', text: '#DAE8E0' },
  { cover: '#3D2B5A', spine: '#251A38', accent: '#9B7FBF', text: '#E5DCF0' },
  { cover: '#5C3A1E', spine: '#3A2412', accent: '#D4A56A', text: '#FFF2DB' },
];

function getColorForIndex(index) {
  return BOOK_COLORS[index % BOOK_COLORS.length];
}

// Split title text into lines
function wrapText(text, maxCharsPerLine = 22) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].slice(0, maxCharsPerLine - 3) + '...';
  }
  return lines;
}

export default function BookCard({ title, subtitle, colorIndex = 0, onClick, onDelete }) {
  const colors = getColorForIndex(colorIndex);
  const titleLines = wrapText(title, 22);
  // Center title vertically in the cover area
  const coverCenterY = 80;
  const titleBlockHeight = titleLines.length * 20;
  const titleStartY = coverCenterY - titleBlockHeight / 2 + 14;

  return (
    <div className="book-card-wrapper" onClick={onClick}>
      <button
        className="library-book-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(e); }}
        title="Delete"
      >
        <Trash2 size={13} />
      </button>

      <svg
        viewBox="0 0 220 160"
        xmlns="http://www.w3.org/2000/svg"
        className="book-card-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Page edge texture */}
          <linearGradient id={`pages-${colorIndex}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5f0e8" />
            <stop offset="20%" stopColor="#e8e0d4" />
            <stop offset="40%" stopColor="#f5f0e8" />
            <stop offset="60%" stopColor="#ebe4d8" />
            <stop offset="80%" stopColor="#f5f0e8" />
            <stop offset="100%" stopColor="#e8e0d4" />
          </linearGradient>

          {/* Cover gradient */}
          <linearGradient id={`cover-${colorIndex}`} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor={colors.cover} />
            <stop offset="50%" stopColor={colors.cover} stopOpacity="0.92" />
            <stop offset="100%" stopColor={colors.spine} />
          </linearGradient>

          {/* Spine gradient */}
          <linearGradient id={`spine-${colorIndex}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colors.spine} />
            <stop offset="50%" stopColor={colors.cover} stopOpacity="0.7" />
            <stop offset="100%" stopColor={colors.spine} />
          </linearGradient>

          {/* Shadow */}
          <filter id={`shadow-${colorIndex}`} x="-8%" y="-8%" width="120%" height="125%">
            <feDropShadow dx="2" dy="4" stdDeviation="3.5" floodColor="#000" floodOpacity="0.22" />
          </filter>

          {/* Leather texture */}
          <pattern id={`tex-${colorIndex}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="transparent" />
            <circle cx="1.5" cy="1.5" r="0.4" fill="rgba(0,0,0,0.05)" />
            <circle cx="4.5" cy="4.5" r="0.4" fill="rgba(255,255,255,0.03)" />
          </pattern>
        </defs>

        <g filter={`url(#shadow-${colorIndex})`}>
          {/* Page edges (bottom of the book) */}
          <rect x="22" y="8" width="190" height="144" rx="2" ry="2"
            fill={`url(#pages-${colorIndex})`}
            stroke="#d5cfc5" strokeWidth="0.5"
          />
          {/* Horizontal page lines */}
          {[...Array(6)].map((_, i) => (
            <line key={i}
              x1="22" y1={30 + i * 20}
              x2="212" y2={30 + i * 20}
              stroke="#d5cfc5" strokeWidth="0.3"
            />
          ))}

          {/* Back cover shadow */}
          <rect x="20" y="6" width="194" height="148" rx="3" ry="3"
            fill={colors.spine} opacity="0.25"
          />

          {/* Main front cover */}
          <rect x="14" y="3" width="198" height="148" rx="4" ry="4"
            fill={`url(#cover-${colorIndex})`}
          />
          {/* Texture overlay */}
          <rect x="14" y="3" width="198" height="148" rx="4" ry="4"
            fill={`url(#tex-${colorIndex})`}
          />

          {/* Spine (left edge) */}
          <rect x="14" y="3" width="18" height="148" rx="4" ry="0"
            fill={`url(#spine-${colorIndex})`}
          />
          {/* Spine gold line */}
          <line x1="23" y1="12" x2="23" y2="142" stroke={colors.accent} strokeWidth="0.7" opacity="0.4" />
          <line x1="26" y1="12" x2="26" y2="142" stroke={colors.accent} strokeWidth="0.3" opacity="0.25" />

          {/* Spine ridges */}
          {[...Array(5)].map((_, i) => (
            <line key={i}
              x1="15" y1={25 + i * 26}
              x2="31" y2={25 + i * 26}
              stroke={colors.accent} strokeWidth="0.5" opacity="0.3"
            />
          ))}

          {/* Inner decorative frame */}
          <rect x="40" y="14" width="164" height="120" rx="3" ry="3"
            fill="none" stroke={colors.accent} strokeWidth="0.7" opacity="0.3"
          />
          <rect x="44" y="18" width="156" height="112" rx="2" ry="2"
            fill="none" stroke={colors.accent} strokeWidth="0.35" opacity="0.18"
          />

          {/* Top ornament line */}
          <line x1="82" y1={titleStartY - 14} x2="152" y2={titleStartY - 14}
            stroke={colors.accent} strokeWidth="0.8" opacity="0.45" />
          <circle cx="117" cy={titleStartY - 14} r="2.5"
            fill="none" stroke={colors.accent} strokeWidth="0.5" opacity="0.35" />
          <circle cx="117" cy={titleStartY - 14} r="0.8"
            fill={colors.accent} opacity="0.35" />

          {/* Title text */}
          {titleLines.map((line, i) => (
            <text
              key={i}
              x="122"
              y={titleStartY + i * 20}
              textAnchor="middle"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="13"
              fontWeight="bold"
              fill={colors.text}
            >
              {line}
            </text>
          ))}

          {/* Bottom ornament */}
          <line x1="82" y1={titleStartY + titleLines.length * 20 + 2} x2="152" y2={titleStartY + titleLines.length * 20 + 2}
            stroke={colors.accent} strokeWidth="0.8" opacity="0.45" />

          {/* Subtitle at bottom */}
          <text
            x="122"
            y="148"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica', sans-serif"
            fontSize="6.5"
            fill={colors.accent}
            opacity="0.65"
            letterSpacing="0.8"
          >
            {subtitle?.toUpperCase()?.slice(0, 36)}
          </text>

          {/* Cover edge highlight */}
          <line x1="212" y1="8" x2="212" y2="148" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
