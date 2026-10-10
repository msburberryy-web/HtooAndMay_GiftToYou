import {useState} from 'react';

// A personal note from Htoo & May (RSVPs › Gift message). Shown as a small gift box: tapping it lifts the lid
// and the note card rises out. Motion stops for visitors who prefer reduced motion (see .gift-note in globals.css).
export default function GiftNote({message, tap, close, from}: {message: string; tap: string; close: string; from: string}) {
  const [state, setState] = useState<'closed' | 'opening' | 'open'>('closed');
  function open() {
    if (state !== 'closed') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setState('open'); return; }
    setState('opening');
    window.setTimeout(() => setState('open'), 750);
  }
  return <div className={`gift-note ${state}`}>
    {state !== 'open' ? <button type="button" className="gift-note-box" aria-expanded={false} onClick={open}>
      <svg viewBox="0 0 120 110" aria-hidden="true">
        <ellipse cx="60" cy="102" rx="38" ry="5" fill="#e2d8c8"/>
        <g className="note-sparkles"><path d="M14 40 l3 7 7 3 -7 3 -3 7 -3-7 -7-3 7-3z" fill="#b4935d"/><path d="M104 30 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z" fill="#c98b97"/></g>
        <g className="note-base"><rect x="26" y="52" width="68" height="48" rx="3" fill="#fbf5e9" stroke="#b4935d" strokeWidth="1.5"/><rect x="55" y="52" width="10" height="48" fill="#7c3241"/></g>
        <g className="note-lid"><rect x="21" y="40" width="78" height="14" rx="3" fill="#f3e7d3" stroke="#b4935d" strokeWidth="1.5"/><rect x="55" y="40" width="10" height="14" fill="#7c3241"/>
          <path d="M60 40 C46 20 32 30 44 39 Z M60 40 C74 20 88 30 76 39 Z" fill="#7c3241"/><circle cx="60" cy="39" r="4" fill="#662736"/></g>
      </svg>
      <span>{tap}</span>
    </button> : <div className="gift-note-card" role="region" aria-label={tap} tabIndex={-1} ref={el => el?.focus({preventScroll: true})}>
      <p className="gift-note-text">{message}</p>
      <p className="gift-note-from">{from}</p>
      <button type="button" className="text-button" onClick={() => setState('closed')}>{close}</button>
    </div>}
  </div>;
}
