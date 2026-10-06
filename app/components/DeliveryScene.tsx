// Animated "gift on its way" illustration for the confirmation screen, drawn in the wedding palette.
// Motion stops automatically for visitors who prefer reduced motion (see .delivery-scene in globals.css).
export default function DeliveryScene({label}:{label:string}){
 return <figure className="delivery-scene" aria-label={label} role="img">
  <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
   <g className="road">
    <rect x="30" y="176" width="70" height="5" rx="2.5"/><rect x="130" y="176" width="110" height="5" rx="2.5"/><rect x="270" y="176" width="40" height="5" rx="2.5"/>
    <rect x="70" y="185" width="50" height="4" rx="2"/><rect x="190" y="185" width="80" height="4" rx="2"/>
   </g>
   <g className="speed-lines">
    <line x1="14" y1="96" x2="44" y2="96"/><line x1="4" y1="114" x2="40" y2="114"/><line x1="18" y1="132" x2="46" y2="132"/>
   </g>
   <g className="rider-and-scooter">
    <g className="ride">
     {/* gift box on the rear rack */}
     <g className="parcel">
      <rect x="58" y="72" width="46" height="40" rx="4" fill="#b4935d"/>
      <rect x="78" y="72" width="7" height="40" fill="#7c3241"/>
      <rect x="58" y="88" width="46" height="7" fill="#7c3241"/>
      <path d="M81 72 C70 58 60 64 66 71 Z M82 72 C94 58 104 64 98 71 Z" fill="#7c3241"/>
      <circle cx="81.5" cy="71" r="3.5" fill="#662736"/>
     </g>
     {/* scooter */}
     <path d="M66 150 Q64 118 104 114 L168 114 Q184 114 190 130 L198 150 Z" fill="#7c3241"/>
     <rect x="60" y="110" width="50" height="6" rx="3" fill="#3f362e"/>
     <rect x="116" y="138" width="88" height="12" rx="6" fill="#7c3241"/>
     <path d="M194 152 Q204 120 212 90 L221 92 Q214 124 210 152 Z" fill="#662736"/>
     <path d="M206 154 Q236 118 266 154 L256 154 Q236 132 216 154 Z" fill="#7c3241"/>
     <circle cx="224" cy="104" r="6.5" fill="#f2d58a"/>
     <line x1="204" y1="88" x2="232" y2="82" stroke="#3f362e" strokeWidth="5" strokeLinecap="round"/>
     <rect x="110" y="104" width="52" height="11" rx="5.5" fill="#3f362e"/>
     {/* rider */}
     <path className="scarf" d="M146 64 Q128 60 112 70 Q124 66 132 72 Q120 74 110 84 Q132 76 148 72 Z" fill="#b4935d"/>
     <polyline points="140,104 174,110 186,136" fill="none" stroke="#3f362e" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
     <ellipse cx="192" cy="138" rx="10" ry="5" fill="#3f362e"/>
     <path d="M128 108 Q126 72 144 60 Q162 54 166 72 L162 108 Z" fill="#727b57"/>
     <polyline points="152,72 182,86 206,90" fill="none" stroke="#727b57" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
     <circle cx="208" cy="90" r="5.5" fill="#f1c9a5"/>
     <circle cx="157" cy="44" r="15" fill="#f1c9a5"/>
     <path d="M141 46 A17 17 0 0 1 174 38 L175 46 Q158 41 141 50 Z" fill="#7c3241"/>
     <path d="M166 37 L178 40 L176 46 L166 44 Z" fill="#3f362e" opacity=".8"/>
     <circle cx="166" cy="49" r="1.6" fill="#3f362e"/>
     <path d="M162 55 Q167 58 171 54" fill="none" stroke="#3f362e" strokeWidth="1.6" strokeLinecap="round"/>
    </g>
    {/* wheels turn independently of the gentle bounce */}
    <g className="wheel"><circle cx="92" cy="158" r="20" fill="#3f362e"/><circle cx="92" cy="158" r="9" fill="#e9e1d3"/><path d="M92 141 V175 M75 158 H109" stroke="#e9e1d3" strokeWidth="2"/></g>
    <g className="wheel"><circle cx="236" cy="158" r="20" fill="#3f362e"/><circle cx="236" cy="158" r="9" fill="#e9e1d3"/><path d="M236 141 V175 M219 158 H253" stroke="#e9e1d3" strokeWidth="2"/></g>
   </g>
  </svg>
 </figure>;
}
