import React from 'react';

/**
 * Tyto Mascot Component
 * 
 * Medical study partner for WardWit (USMLE Step 1 preparation).
 * Features the approved medical Tyto artwork:
 * - Teal / cream / warm-gold palette
 * - White doctor's coat and stethoscope
 * - Friendly waving wing and expressive eyes (no graduation cap)
 * 
 * Named states:
 * - 'welcome': Friendly entrance greeting with gentle wave motion
 * - 'thinking': In-thought pose with subtle, calm head tilt
 * - 'encouraging': Supportive micro-nod with uplifting presence
 * - 'celebrating': Joyful hop and cheerful scale pop
 * - 'resting': Relaxed, calm posture with subtle breathing
 * 
 * Honest Asset Disclosure:
 * Uses the approved medical Tyto PNG illustration (/assets/tyto-doctor.png).
 * Animations are honest, subtle CSS entrance/bob/pop motions. We do NOT simulate
 * artificial eye blinks or wing articulation from a flat 2D raster image.
 * Missing future multi-pose assets documented:
 * - Vector rig with separate blinking eye layers
 * - Articulated dual wings (holding pen, pointing to vignette)
 * - Closed-eye resting sprite
 * - Pensive thinking sprite with stethoscope ear-tips
 */

export type TytoState = 'welcome' | 'thinking' | 'encouraging' | 'celebrating' | 'resting';

export interface TytoMascotProps {
  state?: TytoState;
  size?: number | 'sm' | 'md' | 'lg' | 'xl'; // Size in pixels or named token (default: 110)
  className?: string;
  speechBubble?: string;
  speechPosition?: 'top' | 'right' | 'left';
  quietMode?: boolean;
  altText?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<string, number> = {
  sm: 64,
  md: 96,
  lg: 128,
  xl: 160,
};

export const TytoMascot: React.FC<TytoMascotProps> = ({
  state = 'welcome',
  size = 110,
  className = '',
  speechBubble,
  speechPosition = 'right',
  quietMode = false,
  altText,
  style = {},
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 110;
  const showBubble = !quietMode && Boolean(speechBubble);
  const defaultAlt = `Tyto the medical owl companion in ${state} pose`;

  return (
    <div
      className={`tyto-container tyto-${state} ${quietMode ? 'tyto-quiet' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        position: 'relative',
        ...style,
      }}
    >
      {/* Speech Bubble on Left */}
      {showBubble && speechPosition === 'left' && (
        <div
          className="tyto-speech-bubble tyto-bubble-left"
          role="status"
          aria-live="polite"
        >
          <span>{speechBubble}</span>
        </div>
      )}

      {/* Mascot Artwork Container */}
      <div
        className={`tyto-avatar-wrapper tyto-motion-${state}`}
        style={{
          width: pixelSize,
          height: pixelSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <img
          src="/assets/tyto-doctor.png"
          alt={altText || defaultAlt}
          width={pixelSize}
          height={pixelSize}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 6px 12px rgba(15, 118, 110, 0.14))',
          }}
          loading="eager"
        />
      </div>

      {/* Speech Bubble on Right or Top */}
      {showBubble && speechPosition !== 'left' && (
        <div
          className={`tyto-speech-bubble tyto-bubble-${speechPosition}`}
          role="status"
          aria-live="polite"
        >
          <span>{speechBubble}</span>
        </div>
      )}
    </div>
  );
};

export default TytoMascot;
