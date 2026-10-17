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
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center py-0 md:py-12 px-0 md:px-4">
      <div className="w-full max-w-lg md:max-w-xl mx-auto flex flex-col min-h-[100dvh] md:min-h-0 p-6 md:p-10 md:bg-surface md:border md:border-border md:rounded-3xl relative">
        
        {/* Skip button for carousel */}
        {slide < slides.length - 1 && (
          <button 
            onClick={() => navigate('/onboarding')}
            className="absolute top-6 right-6 text-xs font-bold text-text-muted hover:text-text-main btn-tap z-10"
          >
            Skip
          </button>
        )}

        <div className="flex-1 flex flex-col items-center justify-center w-full text-center animate-in fade-in slide-in-from-right-4 duration-300 py-8" key={slide}>
          {slides[slide].icon}
          <h1 className="text-3xl md:text-4xl font-heading font-black text-text-main mb-4">{slides[slide].title}</h1>
          <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-[340px] mx-auto">
            {slides[slide].subtitle}
          </p>
        </div>

        <div className="w-full space-y-6 pb-6 pt-4 mt-auto">
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
            className="w-full py-4 bg-accent text-white font-bold rounded-2xl btn-tap flex justify-center items-center gap-2 hover:bg-accent-hover transition-colors shadow-none"
          >
            {slide === slides.length - 1 ? 'Get Started' : 'Next'} 
            {slide === slides.length - 1 ? <ArrowRight className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          <div className="text-center space-y-2">
            <button 
              onClick={() => navigate('/login')}
              className="text-xs font-bold text-text-muted hover:text-text-main btn-tap"
            >
              Already have an account? Log in
            </button>
            <AppFooter className="pt-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
