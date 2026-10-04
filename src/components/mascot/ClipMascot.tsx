import React from 'react';
import { TytoMascot, type TytoState } from './TytoMascot';

export type MascotPose = 'welcome' | 'focus' | 'celebration' | 'encouragement' | 'resting';

export interface ClipMascotProps {
  pose?: MascotPose;
  size?: number;
  className?: string;
  speechBubble?: string;
  speechPosition?: 'top' | 'right' | 'left';
  quietMode?: boolean;
}

/**
 * Backwards compatibility adapter mapping ClipMascot to TytoMascot.
 */
export const ClipMascot: React.FC<ClipMascotProps> = ({
  pose = 'welcome',
  size = 110,
  className = '',
  speechBubble,
  speechPosition = 'right',
  quietMode = false,
}) => {
  const poseToStateMap: Record<MascotPose, TytoState> = {
    welcome: 'welcome',
    focus: 'thinking',
    celebration: 'celebrating',
    encouragement: 'encouraging',
    resting: 'resting',
  };

  const state = poseToStateMap[pose] || 'welcome';

  return (
    <TytoMascot
      state={state}
      size={size}
      className={className}
      speechBubble={speechBubble}
      speechPosition={speechPosition}
      quietMode={quietMode}
    />
  );
};

export default ClipMascot;
