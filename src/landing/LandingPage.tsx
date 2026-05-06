import './tokens.css'
import { Nav } from './Nav.tsx'
import { Hero } from './Hero.tsx'
import { ProofBar } from './ProofBar.tsx'
import { Features } from './Features.tsx'
import { Showcase } from './Showcase.tsx'
import { Personas } from './Personas.tsx'
import { OriginStory } from './OriginStory.tsx'
import { FinalCTA } from './FinalCTA.tsx'
import { Footer } from './Footer.tsx'

// Phase 4 SA-2: top-level landing page. Each section lives in its
// own file; this component just assembles them in order.

export default function LandingPage() {
  return (
    <div className="landing">
      <Nav />
      <main>
        <Hero />
        <ProofBar />
        <Features />
        <Showcase />
        <Personas />
        <OriginStory />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
