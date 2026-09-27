import React from 'react';

export type MascotPose = 'welcome' | 'focus' | 'celebration' | 'encouragement';

interface ClipMascotProps {
  pose?: MascotPose;
  size?: number;
  className?: string;
  speechBubble?: string;
  quietMode?: boolean;
}

export const ClipMascot: React.FC<ClipMascotProps> = ({
  pose = 'welcome',
  size = 120,
  className = '',
  speechBubble,
  quietMode = false,
}) => {
  // If quiet mode is enabled and no explicit pose overrides, render minimal or no speech bubble
  const showBubble = !quietMode && speechBubble;

  return (
    <div className={`clip-mascot-container ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`WardWit Mascot Clip in ${pose} pose`}
        style={{ overflow: 'visible', filter: 'drop-shadow(2px 3px 0px rgba(30, 37, 43, 0.2))' }}
      >
        {/* Shadow under board */}
        <ellipse cx="80" cy="172" rx="55" ry="6" fill="#1E252B" opacity="0.12" />

        {/* Clipboard Backboard */}
        <rect
          x="24"
          y="28"
          width="112"
          height="140"
          rx="12"
          fill="#D6C5A2"
          stroke="#1E252B"
          strokeWidth="3.5"
        />
        {/* Subtle woodgrain / notebook border highlight */}
        <rect
          x="28"
          y="32"
          width="104"
          height="132"
          rx="8"
          fill="#DFCEAB"
        />

        {/* Paper Sheet */}
        <rect
          x="32"
          y="42"
          width="96"
          height="120"
          rx="6"
          fill="#FCFBF7"
          stroke="#1E252B"
          strokeWidth="2.5"
        />

        {/* Paper Ruled Lines */}
        <line x1="42" y1="64" x2="118" y2="64" stroke="#E6ECE8" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="42" y1="84" x2="118" y2="84" stroke="#E6ECE8" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="42" y1="104" x2="118" y2="104" stroke="#E6ECE8" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="42" y1="124" x2="118" y2="124" stroke="#E6ECE8" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="42" y1="144" x2="118" y2="144" stroke="#E6ECE8" strokeWidth="2" strokeDasharray="3 3" />

        {/* Mascot Face: Eyes, Cheeks, Mouth */}
        {pose === 'welcome' && (
          <g id="face-welcome">
            {/* Blushing cheeks */}
            <circle cx="58" cy="98" r="6" fill="#F4A259" opacity="0.4" />
            <circle cx="102" cy="98" r="6" fill="#F4A259" opacity="0.4" />
            {/* Eyes */}
            <circle cx="62" cy="90" r="5.5" fill="#1E252B" />
            <circle cx="64" cy="88" r="2" fill="#FFFFFF" />
            <circle cx="98" cy="90" r="5.5" fill="#1E252B" />
            <circle cx="100" cy="88" r="2" fill="#FFFFFF" />
            {/* Smile */}
            <path
              d="M72 98C74 104 86 104 88 98"
              stroke="#1E252B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Waving Pen Hand */}
            <g transform="translate(122, 60) rotate(15)">
              <rect x="0" y="0" width="8" height="32" rx="3" fill="#145355" stroke="#1E252B" strokeWidth="2" />
              <polygon points="0,32 8,32 4,39" fill="#F4A259" stroke="#1E252B" strokeWidth="1.5" />
            </g>
          </g>
        )}

        {pose === 'focus' && (
          <g id="face-focus">
            {/* Wire-frame glasses */}
            <circle cx="60" cy="88" r="12" fill="none" stroke="#145355" strokeWidth="2.5" />
            <circle cx="100" cy="88" r="12" fill="none" stroke="#145355" strokeWidth="2.5" />
            <path d="M72 88H88" stroke="#145355" strokeWidth="2.5" strokeLinecap="round" />
            {/* Concentrated Eyes */}
            <ellipse cx="60" cy="88" rx="4" ry="4.5" fill="#1E252B" />
            <circle cx="61.5" cy="86.5" r="1.5" fill="#FFFFFF" />
            <ellipse cx="100" cy="88" rx="4" ry="4.5" fill="#1E252B" />
            <circle cx="101.5" cy="86.5" r="1.5" fill="#FFFFFF" />
            {/* Determined / Studious mouth */}
            <path d="M74 103C78 105 82 105 86 103" stroke="#1E252B" strokeWidth="2.5" strokeLinecap="round" />
            {/* Stethoscope cord outline */}
            <path
              d="M38 120C36 140 50 156 80 156C110 156 124 140 122 120"
              stroke="#48A9A6"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="80" cy="156" r="6" fill="#145355" stroke="#1E252B" strokeWidth="2" />
          </g>
        )}

        {pose === 'celebration' && (
          <g id="face-celebration">
            {/* Cheerful Wink & Big Joyous Eyes */}
            <path d="M54 91C56 85 66 85 68 91" stroke="#1E252B" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M92 91C94 85 104 85 106 91" stroke="#1E252B" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Big Open Smile */}
            <path
              d="M68 98C68 110 92 110 92 98Z"
              fill="#E06A55"
              stroke="#1E252B"
              strokeWidth="2.5"
            />
            {/* Cheeks */}
            <circle cx="50" cy="99" r="6" fill="#F4A259" opacity="0.6" />
            <circle cx="110" cy="99" r="6" fill="#F4A259" opacity="0.6" />
            {/* Celebration Sparkles */}
            <path d="M18 42L22 45L26 42L23 48L27 52L21 50L18 56L17 50L11 50L16 46Z" fill="#F4A259" stroke="#1E252B" strokeWidth="1" />
            <path d="M135 38L138 41L142 38L139 44L143 48L137 46L134 52L133 46L127 46L132 42Z" fill="#48A9A6" stroke="#1E252B" strokeWidth="1" />
          </g>
        )}

        {pose === 'encouragement' && (
          <g id="face-encouragement">
            {/* Supportive warm eyes */}
            <circle cx="62" cy="88" r="5" fill="#1E252B" />
            <circle cx="64" cy="86" r="1.5" fill="#FFFFFF" />
            <circle cx="98" cy="88" r="5" fill="#1E252B" />
            <circle cx="100" cy="86" r="1.5" fill="#FFFFFF" />
            {/* Warm smile */}
            <path d="M72 98C76 102 84 102 88 98" stroke="#1E252B" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="54" cy="94" r="5" fill="#F4A259" opacity="0.5" />
            <circle cx="106" cy="94" r="5" fill="#F4A259" opacity="0.5" />
            {/* Traditional Chai Cup */}
            <g transform="translate(108, 110)">
              {/* Saucer */}
              <ellipse cx="14" cy="28" rx="14" ry="3" fill="#D6C5A2" stroke="#1E252B" strokeWidth="1.5" />
              {/* Cup */}
              <path d="M4 14L6 26C6 27 22 27 22 26L24 14Z" fill="#FAF7F0" stroke="#1E252B" strokeWidth="2" />
              {/* Chai fill */}
              <ellipse cx="14" cy="15" rx="8" ry="2" fill="#C27D38" />
              {/* Handle */}
              <path d="M23 16C27 16 27 23 22 23" stroke="#1E252B" strokeWidth="2" fill="none" />
              {/* Steam puffs */}
              <path d="M10 10C8 6 12 4 10 0" stroke="#145355" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />
              <path d="M16 11C14 7 18 5 16 1" stroke="#145355" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" fill="none" />
            </g>
          </g>
        )}

        {/* Sturdy Top Clamp (Metal Clip with brass rivet and cutout) */}
        <g id="clamp">
          <rect
            x="56"
            y="18"
            width="48"
            height="20"
            rx="4"
            fill="#5C6770"
            stroke="#1E252B"
            strokeWidth="3"
          />
          {/* Metal shine */}
          <rect x="60" y="21" width="40" height="4" rx="2" fill="#8E99A2" />
          {/* Clamp hook ring */}
          <circle cx="80" cy="14" r="8" fill="none" stroke="#1E252B" strokeWidth="3" />
          <circle cx="80" cy="14" r="5" fill="#FAF7F0" stroke="#5C6770" strokeWidth="1" />
          {/* Center rivet */}
          <circle cx="80" cy="28" r="3" fill="#F4A259" stroke="#1E252B" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Speech bubble */}
      {showBubble && (
        <div
          className="mascot-speech-bubble"
          style={{
            position: 'relative',
            background: '#FFFFFF',
            border: '2px solid #1E252B',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '0.9rem',
            lineHeight: 1.35,
            color: '#1E252B',
            fontWeight: 500,
            maxWidth: '260px',
            boxShadow: '3px 3px 0px #1E252B',
          }}
        >
          {speechBubble}
          {/* Triangle pointer */}
          <div
            style={{
              position: 'absolute',
              left: '-10px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderRight: '10px solid #1E252B',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '-7px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '8px solid #FFFFFF',
            }}
          />
        </div>
      )}
    </div>
  );
};
