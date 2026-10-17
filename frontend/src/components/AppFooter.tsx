import React from 'react';

interface AppFooterProps {
  className?: string;
  variant?: 'simple' | 'card' | 'bar';
}

export const AppFooter: React.FC<AppFooterProps> = ({ className = '', variant = 'simple' }) => {
  const currentYear = new Date().getFullYear();

  if (variant === 'bar') {
    return (
      <footer className={`w-full border-t border-border bg-surface py-5 text-center text-xs text-text-muted ${className}`}>
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center text-[11.5px] opacity-75">
          <p>© {currentYear} VTrack. All rights reserved. Built for Students.</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`w-full py-2.5 text-center text-text-muted select-none ${className}`}>
      <p className="text-[11px] opacity-75">
        © {currentYear} VTrack • Built for Students
      </p>
    </footer>
  );
};
