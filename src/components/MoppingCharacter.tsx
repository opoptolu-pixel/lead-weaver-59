export const MoppingCharacter = () => {
  return (
    <div className="absolute -top-10 left-0 right-0 z-30 pointer-events-none overflow-hidden">
      <div className="animate-mop-walk relative" style={{ width: '50px', height: '50px' }}>
        {/* Character with mop */}
        <svg
          width="50"
          height="50"
          viewBox="0 0 80 80"
          className="drop-shadow-md"
        >
          {/* Mop handle */}
          <rect x="8" y="28" width="2.5" height="28" fill="#8B4513" rx="1" className="origin-bottom animate-mop-handle" />
          
          {/* Mop head */}
          <ellipse cx="9" cy="54" rx="8" ry="3" fill="#D4A574" className="animate-mop-head" />
          
          {/* Mop strings */}
          <g className="animate-mop-strings">
            <path d="M3 54 Q2 60 1 58" stroke="#C4956A" strokeWidth="1.2" fill="none" />
            <path d="M6 55 Q5 61 4 59" stroke="#C4956A" strokeWidth="1.2" fill="none" />
            <path d="M9 55 Q9 62 9 60" stroke="#C4956A" strokeWidth="1.2" fill="none" />
            <path d="M12 55 Q13 61 14 59" stroke="#C4956A" strokeWidth="1.2" fill="none" />
            <path d="M15 54 Q16 60 17 58" stroke="#C4956A" strokeWidth="1.2" fill="none" />
          </g>
          
          {/* Body */}
          <ellipse cx="35" cy="42" rx="12" ry="15" fill="#4ECDC4" />
          
          {/* Head */}
          <circle cx="35" cy="22" r="12" fill="#FFE66D" />
          
          {/* Eyes */}
          <ellipse cx="31" cy="20" rx="2.5" ry="3" fill="#2C3E50" className="animate-blink" />
          <ellipse cx="39" cy="20" rx="2.5" ry="3" fill="#2C3E50" className="animate-blink" />
          
          {/* Eye shine */}
          <circle cx="31.5" cy="19" r="1" fill="white" />
          <circle cx="39.5" cy="19" r="1" fill="white" />
          
          {/* Happy mouth */}
          <path
            d="M 30 26 Q 35 32 40 26"
            stroke="#2C3E50"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Rosy cheeks */}
          <circle cx="26" cy="24" r="2" fill="#FF6B6B" opacity="0.5" />
          <circle cx="44" cy="24" r="2" fill="#FF6B6B" opacity="0.5" />
          
          {/* Arm holding mop */}
          <ellipse cx="22" cy="38" rx="4" ry="6" fill="#4ECDC4" />
          <circle cx="18" cy="36" r="3" fill="#FFE66D" /> {/* Hand */}
          
          {/* Other arm */}
          <ellipse cx="48" cy="40" rx="4" ry="5" fill="#4ECDC4" />
          
          {/* Feet */}
          <ellipse cx="30" cy="56" rx="5" ry="3" fill="#3498DB" />
          <ellipse cx="40" cy="56" rx="5" ry="3" fill="#3498DB" />
        </svg>
        
        {/* Sparkle */}
        <div className="absolute -top-1 right-2 animate-twinkle">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="#FFE66D" />
          </svg>
        </div>
      </div>
    </div>
  );
};
