import React from 'react';
import { AlertCircle } from 'lucide-react';
import { BRAND } from '../../config/brand.config';

interface DisclaimerBannerProps {
  customMessage?: string;
  className?: string;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({
  customMessage,
  className = '',
}) => {
  return (
    <div
      className={`disclaimer-banner ${className}`}
      role="note"
      aria-label="Demo Content Disclaimer"
    >
      <AlertCircle size={16} style={{ flexShrink: 0, color: '#C67E1B' }} />
      <span>{customMessage || BRAND.demoDisclaimer}</span>
    </div>
  );
};
