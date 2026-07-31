import React from 'react';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LandingHero } from '../components/landing/LandingHero';
import { TrustedBy } from '../components/landing/TrustedBy';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { ComparisonTable } from '../components/landing/ComparisonTable';
import { Testimonials } from '../components/landing/Testimonials';
import { CTA } from '../components/landing/CTA';
import { LandingFooter } from '../components/landing/LandingFooter';

interface LandingPageViewProps {
  onSignInClick: () => void;
  onSignUpClick: () => void;
  onLaunchAppClick?: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onSignInClick,
  onSignUpClick,
  onLaunchAppClick,
}) => {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col font-sans overflow-x-hidden">
      <LandingNavbar
        onSignInClick={onSignInClick}
        onSignUpClick={onSignUpClick}
        onLaunchAppClick={onLaunchAppClick}
      />
      <main className="flex-1">
        <LandingHero
          onGetStartedClick={onSignUpClick}
          onLaunchAppClick={onLaunchAppClick}
        />
        <TrustedBy />
        <Features />
        <HowItWorks />
        <ComparisonTable />
        <Testimonials />
        <CTA onSignUpClick={onSignUpClick} />
      </main>
      <LandingFooter
        onSignInClick={onSignInClick}
        onSignUpClick={onSignUpClick}
        onLaunchAppClick={onLaunchAppClick}
      />
    </div>
  );
};
