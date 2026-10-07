import DeliveryScene from './DeliveryScene';

// Small animated scene for each order status, in the wedding palette.
// Awaiting choice → heart hopping between gifts · Requested → envelope on its way · Ordered → gift being wrapped · Shipped → delivery scooter · Delivered → gift at the door.
// Motion stops for visitors who prefer reduced motion (see .status-scene in globals.css).
const heart = (x: number, y: number, s = 1) => `M${x} ${y + 3 * s} C${x - 7 * s} ${y - 4 * s} ${x - 3 * s} ${y - 10 * s} ${x} ${y - 5 * s} C${x + 3 * s} ${y - 10 * s} ${x + 7 * s} ${y - 4 * s} ${x} ${y + 3 * s} Z`;
const sparkle = (x: number, y: number, r: number) => `M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`;

function EnvelopeScene() {
  return <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="70" cy="150" rx="46" ry="11" fill="#efe5d6"/><ellipse cx="250" cy="44" rx="40" ry="9" fill="#efe5d6"/>
    <path className="trail" d="M28 160 Q92 70 176 104" fill="none" stroke="#cbb9b6" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10"/>
    <g className="float-heart h1"><path d={heart(96, 62, 1.1)} fill="#b4935d"/></g>
    <g className="float-heart h2"><path d={heart(132, 40, 0.8)} fill="#c98b97"/></g>
    <g className="float-heart h3"><path d={heart(64, 98, 0.7)} fill="#b4935d"/></g>
    <g className="envelope">
      <rect x="176" y="72" width="104" height="68" rx="7" fill="#fbf5e9" stroke="#7c3241" strokeWidth="2.5"/>
      <path d="M178 140 L216 106 M278 140 L240 106" fill="none" stroke="#cbb9b6" strokeWidth="2"/>
      <path d="M179 76 L228 112 L277 76" fill="none" stroke="#7c3241" strokeWidth="2.5" strokeLinejoin="round"/>
      <circle cx="228" cy="111" r="12" fill="#7c3241"/>
      <path d={heart(228, 112, 0.7)} fill="#fbf5e9"/>
      <path className="speed" d="M160 92 H142 M164 106 H134 M160 120 H146" stroke="#b4935d" strokeWidth="3" strokeLinecap="round"/>
    </g>
  </svg>;
}

function ChoosingScene() {
  const box = (x: number, w: number, h: number, body: string, lid: string) => <>
    <rect x={x} y={166 - h} width={w} height={h} rx="3" fill={body}/>
    <rect x={x + w / 2 - 5} y={166 - h} width="10" height={h} fill="#7c3241"/>
    <rect x={x - 4} y={158 - h} width={w + 8} height="10" rx="2" fill={lid}/>
    <path d={`M${x + w / 2} ${158 - h} C${x + w / 2 - 14} ${142 - h} ${x + w / 2 - 26} ${150 - h} ${x + w / 2 - 16} ${157 - h} Z M${x + w / 2} ${158 - h} C${x + w / 2 + 14} ${142 - h} ${x + w / 2 + 26} ${150 - h} ${x + w / 2 + 16} ${157 - h} Z`} fill="#7c3241"/>
  </>;
  return <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="30" y="166" width="260" height="6" rx="3" fill="#e2d8c8"/>
    <g className="pick-box b1">{box(52, 58, 44, '#e9e1d3', '#f3ece0')}</g>
    <g className="pick-box b2">{box(131, 58, 58, '#b4935d', '#c9a46a')}</g>
    <g className="pick-box b3">{box(210, 58, 40, '#c98b97', '#ddb0b8')}</g>
    <g className="twinkle t1"><path d={sparkle(40, 70, 7)} fill="#b4935d"/></g>
    <g className="twinkle t3"><path d={sparkle(284, 82, 6)} fill="#c98b97"/></g>
    <g className="picker"><path d={heart(81, 50, 1.8)} fill="#7c3241"/><path d="M81 62 V80" stroke="#7c3241" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5"/></g>
  </svg>;
}

function WrappingScene() {
  return <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="40" y="166" width="240" height="6" rx="3" fill="#e2d8c8"/>
    <g className="twinkle t1"><path d={sparkle(84, 70, 9)} fill="#b4935d"/></g>
    <g className="twinkle t2"><path d={sparkle(246, 58, 7)} fill="#b4935d"/></g>
    <g className="twinkle t3"><path d={sparkle(232, 120, 6)} fill="#c98b97"/></g>
    <g className="twinkle t4"><path d={sparkle(92, 128, 5)} fill="#c98b97"/></g>
    <rect x="112" y="100" width="96" height="66" rx="3" fill="#b4935d"/>
    <rect x="153" y="100" width="14" height="66" fill="#7c3241"/>
    <g className="gift-tag"><path d="M208 112 L232 128" stroke="#7c3241" strokeWidth="1.5"/><rect x="226" y="124" width="26" height="18" rx="3" fill="#fbf5e9" stroke="#7c3241" strokeWidth="1.5"/><path d={heart(239, 134, 0.55)} fill="#7c3241"/></g>
    <g className="gift-lid">
      <rect x="106" y="84" width="108" height="20" rx="3" fill="#c9a46a"/>
      <rect x="153" y="84" width="14" height="20" fill="#7c3241"/>
      <path d="M160 84 C140 58 120 70 134 82 Z M160 84 C180 58 200 70 186 82 Z" fill="#7c3241"/>
      <circle cx="160" cy="82" r="5" fill="#662736"/>
    </g>
  </svg>;
}

function DeliveredScene() {
  return <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="30" y="166" width="260" height="6" rx="3" fill="#e2d8c8"/>
    <path d="M170 166 V60 Q170 40 190 40 H234 Q254 40 254 60 V166 Z" fill="#e9e1d3"/>
    <path d="M178 166 V64 Q178 48 194 48 H230 Q246 48 246 64 V166 Z" fill="#7c3241"/>
    <rect x="190" y="62" width="44" height="40" rx="3" fill="none" stroke="#662736" strokeWidth="2"/>
    <circle cx="236" cy="118" r="3.5" fill="#f2d58a"/>
    <rect x="172" y="164" width="80" height="6" rx="2" fill="#b4935d"/>
    <g className="arrived">
      <rect x="98" y="126" width="54" height="40" rx="3" fill="#b4935d"/>
      <rect x="119" y="126" width="12" height="40" fill="#7c3241"/>
      <rect x="94" y="118" width="62" height="11" rx="2" fill="#c9a46a"/>
      <path d="M125 118 C112 102 100 110 110 117 Z M125 118 C138 102 150 110 140 117 Z" fill="#7c3241"/>
    </g>
    <g className="float-heart h1"><path d={heart(112, 96, 0.9)} fill="#c98b97"/></g>
    <g className="float-heart h2"><path d={heart(140, 84, 0.7)} fill="#b4935d"/></g>
    <g className="check-pop"><circle cx="276" cy="52" r="17" fill="#727b57"/><path d="M268 52 L274 58 L285 46" fill="none" stroke="#fbf5e9" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></g>
  </svg>;
}

export default function StatusScene({status, label}: {status: string; label: string}) {
  if (status === 'Shipped') return <DeliveryScene label={label}/>;
  const scene = status === 'Ordered' ? <WrappingScene/> : status === 'Delivered' ? <DeliveredScene/> : status === 'Requested' ? <EnvelopeScene/> : <ChoosingScene/>;
  return <figure className={`status-scene scene-${status.toLowerCase()}`} aria-label={label} role="img">{scene}</figure>;
}
