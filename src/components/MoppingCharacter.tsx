export const MoppingCharacter = () => {
  return (
    <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div className="relative animate-bounce-slow">
        {/* Character body */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 100 100"
          className="drop-shadow-lg"
        >
          {/* Body */}
          <ellipse cx="50" cy="55" rx="20" ry="25" fill="#4ECDC4" />
          
          {/* Head */}
          <circle cx="50" cy="28" r="18" fill="#FFE66D" />
          
          {/* Eyes */}
          <ellipse cx="44" cy="26" rx="4" ry="5" fill="#2C3E50" className="animate-blink" />
          <ellipse cx="56" cy="26" rx="4" ry="5" fill="#2C3E50" className="animate-blink" />
          
          {/* Eye shine */}
          <circle cx="45" cy="24" r="1.5" fill="white" />
          <circle cx="57" cy="24" r="1.5" fill="white" />
          
          {/* Happy mouth */}
          <path
            d="M 42 34 Q 50 42 58 34"
            stroke="#2C3E50"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Rosy cheeks */}
          <circle cx="38" cy="32" r="3" fill="#FF6B6B" opacity="0.5" />
          <circle cx="62" cy="32" r="3" fill="#FF6B6B" opacity="0.5" />
          
          {/* Arm holding mop */}
          <ellipse cx="28" cy="50" rx="6" ry="8" fill="#4ECDC4" className="origin-center animate-mop-arm" />
          
          {/* Feet */}
          <ellipse cx="42" cy="78" rx="8" ry="5" fill="#3498DB" />
          <ellipse cx="58" cy="78" rx="8" ry="5" fill="#3498DB" />
        </svg>
        
        {/* Mop */}
        <div className="absolute top-8 -left-8 origin-bottom-right animate-mopping">
          <svg width="60" height="50" viewBox="0 0 60 50">
            {/* Mop handle */}
            <rect x="25" y="0" width="4" height="35" fill="#8B4513" rx="2" />
            
            {/* Mop head */}
            <ellipse cx="27" cy="42" rx="18" ry="6" fill="#D4A574" />
            
            {/* Mop strings */}
            <path d="M12 42 Q10 50 8 48" stroke="#C4956A" strokeWidth="2" fill="none" />
            <path d="M17 43 Q15 52 13 50" stroke="#C4956A" strokeWidth="2" fill="none" />
            <path d="M22 44 Q21 53 19 51" stroke="#C4956A" strokeWidth="2" fill="none" />
            <path d="M27 44 Q27 54 27 52" stroke="#C4956A" strokeWidth="2" fill="none" />
            <path d="M32 44 Q33 53 35 51" stroke="#C4956A" strokeWidth="2" fill="none" />
            <path d="M37 43 Q39 52 41 50" stroke="#C4956A" strokeWidth="2" fill="none" />
            <path d="M42 42 Q44 50 46 48" stroke="#C4956A" strokeWidth="2" fill="none" />
          </svg>
        </div>
        
        {/* Sparkles around character */}
        <div className="absolute -top-2 -right-4 animate-twinkle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="#FFE66D" />
          </svg>
        </div>
        <div className="absolute top-4 -left-6 animate-twinkle-delayed">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="#4ECDC4" />
          </svg>
        </div>
        <div className="absolute bottom-2 right-0 animate-twinkle">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="#FF6B6B" />
          </svg>
        </div>
      </div>
    </div>
  );
};
