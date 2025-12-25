export const MoppingCharacter = () => {
  return (
    <div className="absolute -top-12 left-0 right-0 z-30 pointer-events-none overflow-hidden">
      <div className="animate-mop-walk relative" style={{ width: '40px', height: '48px' }}>
        {/* Emoticon character bent over mopping */}
        <svg
          width="40"
          height="48"
          viewBox="0 0 60 72"
          className="drop-shadow-sm"
        >
          {/* Mop handle - angled for mopping */}
          <g className="animate-mop-handle origin-bottom">
            <rect x="6" y="38" width="2" height="26" fill="#8B5A2B" rx="1" transform="rotate(-25, 7, 64)" />
            {/* Mop head */}
            <ellipse cx="4" cy="62" rx="6" ry="2.5" fill="#A0522D" />
            {/* Mop strings */}
            <g className="animate-mop-strings">
              <path d="M0 62 Q-1 68 0 66" stroke="#C4956A" strokeWidth="1" fill="none" />
              <path d="M2 63 Q1 69 2 67" stroke="#C4956A" strokeWidth="1" fill="none" />
              <path d="M4 63 Q4 70 4 68" stroke="#C4956A" strokeWidth="1" fill="none" />
              <path d="M6 63 Q7 69 6 67" stroke="#C4956A" strokeWidth="1" fill="none" />
              <path d="M8 62 Q9 68 8 66" stroke="#C4956A" strokeWidth="1" fill="none" />
            </g>
          </g>
          
          {/* Body - bent forward for mopping posture */}
          <g className="animate-body-bob">
            {/* Torso - bent forward */}
            <ellipse cx="32" cy="42" rx="8" ry="10" fill="#FFB347" transform="rotate(20, 32, 42)" />
            
            {/* Head - emoticon style circle */}
            <circle cx="38" cy="24" r="10" fill="#FFD93D" stroke="#E8C33A" strokeWidth="1" />
            
            {/* Emoticon eyes - simple dots */}
            <circle cx="35" cy="22" r="1.5" fill="#2C2C2C" />
            <circle cx="41" cy="22" r="1.5" fill="#2C2C2C" />
            
            {/* Focused/determined expression - slight frown of concentration */}
            <path
              d="M 35 28 Q 38 26 41 28"
              stroke="#2C2C2C"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
            
            {/* Sweat drop - working hard */}
            <ellipse cx="46" cy="20" rx="1.5" ry="2" fill="#87CEEB" opacity="0.8" className="animate-sweat" />
            
            {/* Arms - one forward holding mop, one back */}
            <ellipse cx="22" cy="40" rx="3" ry="5" fill="#FFB347" transform="rotate(-30, 22, 40)" />
            <circle cx="18" cy="38" r="2.5" fill="#FFD93D" /> {/* Hand on mop */}
            
            <ellipse cx="40" cy="44" rx="3" ry="4" fill="#FFB347" transform="rotate(15, 40, 44)" />
            
            {/* Legs - bent stance */}
            <ellipse cx="28" cy="54" rx="3" ry="6" fill="#4A90D9" transform="rotate(-10, 28, 54)" />
            <ellipse cx="36" cy="54" rx="3" ry="6" fill="#4A90D9" transform="rotate(5, 36, 54)" />
            
            {/* Feet */}
            <ellipse cx="26" cy="60" rx="4" ry="2" fill="#3A3A3A" />
            <ellipse cx="38" cy="60" rx="4" ry="2" fill="#3A3A3A" />
          </g>
        </svg>
        
        {/* Small water splash effect */}
        <div className="absolute bottom-0 left-0 animate-splash">
          <svg width="12" height="6" viewBox="0 0 12 6">
            <circle cx="2" cy="4" r="1" fill="#87CEEB" opacity="0.6" />
            <circle cx="6" cy="3" r="1.5" fill="#87CEEB" opacity="0.5" />
            <circle cx="10" cy="4" r="1" fill="#87CEEB" opacity="0.6" />
          </svg>
        </div>
      </div>
    </div>
  );
};
