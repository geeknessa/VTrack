import React from 'react';
import { useNavigate } from 'react-router-dom';

interface AppFooterProps {
  className?: string;
  variant?: 'simple' | 'card' | 'bar';
}

export const AppFooter: React.FC<AppFooterProps> = ({ className = '', variant = 'simple' }) => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  if (variant === 'bar') {
    return (
      <footer className={`w-full border-t border-border bg-surface py-6 text-center text-xs text-text-muted ${className}`}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11.5px]">
          <p>© {currentYear} VTrack. All rights reserved. Built for Students.</p>
          <div className="flex items-center gap-3 font-semibold">
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="text-text-muted hover:text-text-main hover:underline transition-colors btn-tap"
            >
              Privacy Policy
            </button>
            <span className="text-border">•</span>
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="text-text-muted hover:text-text-main hover:underline transition-colors btn-tap"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`w-full py-3 text-center text-text-muted select-none ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-4 text-[11px]">
        <span className="opacity-75">© {currentYear} VTrack • Built for Students</span>
        <span className="hidden sm:inline text-border">•</span>
        <div className="flex items-center gap-3 font-semibold">
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="text-text-muted hover:text-text-main hover:underline transition-colors btn-tap text-[11px]"
          >
            Privacy Policy
          </button>
          <span className="text-border text-xs">•</span>
          <button
            type="button"
            onClick={() => navigate('/terms')}
            className="text-text-muted hover:text-text-main hover:underline transition-colors btn-tap text-[11px]"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </footer>
  );
};
