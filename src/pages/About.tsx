import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  ArrowRight, 
  Globe, 
  Shield, 
  Zap, 
  Code2,
  Database,
  Layers,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import Navbar from '@/components/Navbar';

const About = () => {
  const techStack = [
    {
      category: 'Frontend',
      icon: Layers,
      items: ['React 18', 'TypeScript', 'TailwindCSS', 'shadcn/ui', 'Vite'],
    },
    {
      category: 'Backend',
      icon: Database,
      items: ['Express.js', 'Node.js', 'MongoDB', 'Mongoose'],
    },
    {
      category: 'APIs & Security',
      icon: Shield,
      items: ['Coupang Wing API', 'Google Gemini AI', 'HMAC-SHA256', 'Helmet.js'],
    },
  ];

  const timeline = [
    {
      year: '2024',
      title: 'Initial Development',
      description: 'Started as an internal tool for bulk product uploads to Coupang marketplace.',
    },
    {
      year: '2025',
      title: 'Public Release',
      description: 'Rebranded as Catalogix and released for all Coupang sellers worldwide.',
    },
    {
      year: 'Future',
      title: 'Multi-Marketplace',
      description: 'Expanding to support Amazon, eBay, and other major e-commerce platforms.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-10 sm:right-20 w-48 sm:w-72 h-48 sm:h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 sm:left-20 w-64 sm:w-96 h-64 sm:h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
              About <span className="text-gradient">Catalogix</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8">
              We're on a mission to simplify e-commerce product management for sellers 
              targeting the Korean market. What started as an internal tool has grown 
              into a powerful platform used by hundreds of sellers.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link to="/dashboard">
                <Button className="gradient-primary text-white">
                  <Package className="h-4 w-4 mr-2" />
                  Try Catalogix
                </Button>
              </Link>
              <a 
                href="https://github.com/yashsaraswat2004/Catalogix" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="outline">
                  <Code2 className="h-4 w-4 mr-2" />
                  View on GitHub
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-12 sm:py-20 bg-secondary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Our Mission</h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-4 sm:mb-6">
                Cross-border e-commerce should be accessible to everyone. We believe that 
                language barriers and complex API integrations shouldn't stop sellers from 
                reaching the Korean market.
              </p>
              <p className="text-base sm:text-lg text-muted-foreground">
                Catalogix bridges the gap between sellers and Coupang, Korea's largest 
                e-commerce platform, by providing an intuitive interface that handles 
                all the technical complexity behind the scenes.
              </p>
            </div>
            <div className="order-1 lg:order-2 grid grid-cols-2 gap-3 sm:gap-6">
              {[
                { icon: Globe, label: 'Global Reach', value: 'Korea' },
                { icon: Shield, label: 'Secure', value: '100%' },
                { icon: Zap, label: 'Fast', value: '50x' },
                { icon: Package, label: 'Products', value: '10K+' },
              ].map((stat, index) => (
                <div key={index} className="glass-card p-4 sm:p-6 text-center">
                  <stat.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2 sm:mb-3" />
                  <div className="text-xl sm:text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Built with <span className="text-gradient">Modern Technology</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              We use cutting-edge technologies to ensure reliability, speed, and security.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {techStack.map((tech, index) => (
              <div key={index} className="glass-card p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <tech.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold">{tech.category}</h3>
                </div>
                <ul className="space-y-2">
                  {tech.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-success flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-12 sm:py-20 bg-secondary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Our <span className="text-gradient">Journey</span>
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            {timeline.map((item, index) => (
              <div key={index} className="flex gap-4 sm:gap-6 mb-6 sm:mb-8 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm flex-shrink-0">
                    {item.year}
                  </div>
                  {index < timeline.length - 1 && (
                    <div className="w-0.5 h-full bg-primary/20 mt-3 sm:mt-4" />
                  )}
                </div>
                <div className="pb-6 sm:pb-8">
                  <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">{item.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-card p-6 sm:p-8 md:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
              Have Questions or Feedback?
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
              We'd love to hear from you! Whether you have questions about using Catalogix, 
              want to report a bug, or have suggestions for new features.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <a 
                href="https://github.com/yashsaraswat2004/Catalogix/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Report an Issue
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </a>
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button className="gradient-primary text-white w-full sm:w-auto" size="lg">
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
            <div className="flex items-center gap-2">
              <img src="/catalogix_logo1.png" alt="Catalogix" className="h-8 w-auto" />
              <span className="text-xl font-bold">Catalogix</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-muted-foreground text-sm">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
              <a href="https://github.com/yashsaraswat2004/Catalogix" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">
              © {new Date().getFullYear()} Catalogix. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
