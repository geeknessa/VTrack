import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, BarChart3, Wallet, Target } from 'lucide-react';
import { AppFooter } from '../components/AppFooter';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: "Master Your Allowance",
      subtitle: "VTrack is built specifically for students. No confusing banking jargon, just simple tracking.",
      icon: <Wallet className="w-16 h-16 text-accent mb-4" />
    },
    {
      title: "Know Your Runway",
      subtitle: "Always know exactly how many days your money will last before your next allowance hits.",
      icon: <BarChart3 className="w-16 h-16 text-accent mb-4" />
    },
    {
      title: "Hit Your Goals",
      subtitle: "Save up for that new laptop or trip without the guilt. We make setting money aside easy.",
      icon: <Target className="w-16 h-16 text-accent mb-4" />
    }
  ];

  const nextSlide = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col justify-between py-4 px-4 sm:px-6 md:py-10">
      <div className="w-full max-w-md mx-auto my-auto flex flex-col p-6 sm:p-8 bg-surface border border-border/80 rounded-3xl shadow-sm relative">
        
        {/* Skip button for carousel */}
        {slide < slides.length - 1 && (
          <button 
            onClick={() => navigate('/onboarding')}
            className="absolute top-5 right-5 text-xs font-bold text-text-muted hover:text-text-main btn-tap z-10 px-2 py-1 rounded-lg"
          >
            Skip
          </button>
        )}

        <div className="flex flex-col items-center justify-center w-full text-center animate-in fade-in slide-in-from-right-4 duration-300 py-6" key={slide}>
          {slides[slide].icon}
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-main mb-3">{slides[slide].title}</h1>
          <p className="text-text-muted text-sm leading-relaxed max-w-[320px] mx-auto">
            {slides[slide].subtitle}
          </p>
        </div>

        <div className="w-full space-y-5 pt-2">
          {/* Carousel Dots */}
          <div className="flex justify-center gap-2">
            {slides.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${slide === idx ? 'w-8 bg-accent' : 'w-2 bg-border'}`} 
              />
            ))}
          </div>

          <button 
            onClick={nextSlide}
            className="w-full py-3.5 bg-accent text-white font-bold rounded-2xl btn-tap flex justify-center items-center gap-2 hover:bg-accent-hover transition-colors shadow-none"
          >
            {slide === slides.length - 1 ? 'Get Started' : 'Next'} 
            {slide === slides.length - 1 ? <ArrowRight className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          <div className="text-center">
            <button 
              onClick={() => navigate('/login')}
              className="text-xs font-bold text-text-muted hover:text-text-main btn-tap py-1"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>
      </div>

      {/* Clean Bottom Footer with Safe Area */}
      <div className="w-full max-w-md mx-auto pt-2 pb-safe">
        <AppFooter className="py-2" />
      </div>
    </div>
  );
};
