import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  Upload, 
  Zap, 
  Globe, 
  Shield, 
  BarChart3, 
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Users,
  Clock,
  Rocket,
  Star,
  MessageSquare,
  ChevronDown,
  Layers,
  Bot,
  TrendingUp,
  ShoppingCart,
  HeadphonesIcon,
  Calendar
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useState } from 'react';

const Landing = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Upload,
      title: 'Bulk Upload',
      description: 'Upload thousands of products at once using CSV or XLSX files. Save hours of manual work.',
    },
    {
      icon: Globe,
      title: 'AI Translation',
      description: 'Automatically translate your product listings from English to Korean using Google Gemini AI.',
    },
    {
      icon: Zap,
      title: 'Smart Validation',
      description: 'Real-time validation ensures your products meet Coupang requirements before upload.',
    },
    {
      icon: Shield,
      title: 'Secure API',
      description: 'Enterprise-grade security with HMAC authentication and encrypted credentials.',
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Monitor your upload progress in real-time with detailed success and error reporting.',
    },
    {
      icon: Sparkles,
      title: 'Auto Category Mapping',
      description: 'Intelligent category detection automatically maps your products to Coupang categories.',
    },
  ];

  const stats = [
    { value: '10,000+', label: 'Products Uploaded' },
    { value: '99.9%', label: 'Success Rate' },
    { value: '50x', label: 'Faster Than Manual' },
    { value: '24/7', label: 'Available' },
  ];

  const benefits = [
    'No coding required - simple file upload',
    'Supports CSV and Excel formats',
    'Automatic image URL validation',
    'Batch processing up to 1000 products',
    'Detailed error reporting',
    'Credential persistence across sessions',
  ];

  const testimonials = [
    {
      name: 'Sarah Kim',
      role: 'E-commerce Seller',
      avatar: 'SK',
      content: 'Catalogix saved me 10+ hours every week. What used to take a full day now takes just 15 minutes!',
      rating: 5,
    },
    {
      name: 'Michael Park',
      role: 'Dropshipping Business Owner',
      avatar: 'MP',
      content: 'The AI translation feature is a game-changer. I can now list products in Korean without knowing the language.',
      rating: 5,
    },
    {
      name: 'Jennifer Lee',
      role: 'Fashion Brand Manager',
      avatar: 'JL',
      content: 'Finally, a tool that understands Coupang\'s requirements. The validation feature prevents so many upload errors.',
      rating: 5,
    },
  ];

  const roadmap = [
    {
      status: 'completed',
      quarter: 'Q4 2025',
      title: 'Bulk Upload & AI Translation',
      description: 'Core platform with CSV/Excel upload and Gemini AI-powered English to Korean translation.',
      icon: Upload,
    },
    {
      status: 'current',
      quarter: 'Q1 2026',
      title: 'Analytics Dashboard',
      description: 'Comprehensive insights into your upload history, success rates, and product performance.',
      icon: BarChart3,
    },
    {
      status: 'upcoming',
      quarter: 'Q2 2026',
      title: 'Multi-Platform Support',
      description: 'Expand beyond Coupang to support Naver, 11st, and Gmarket marketplaces.',
      icon: Layers,
    },
    {
      status: 'upcoming',
      quarter: 'Q3 2026',
      title: 'AI Product Optimization',
      description: 'Smart suggestions to improve product titles, descriptions, and pricing for better sales.',
      icon: Bot,
    },
  ];

  const faqs = [
    {
      question: 'Do I need any technical knowledge to use Catalogix?',
      answer: 'Not at all! Catalogix is designed for everyone. Simply upload your CSV or Excel file, configure your Coupang API keys, and click upload. No coding required.',
    },
    {
      question: 'Is my API key and product data secure?',
      answer: 'Absolutely. Your API credentials are stored locally in your browser and never sent to our servers. All API calls are made directly to Coupang using HMAC authentication.',
    },
    {
      question: 'How does the AI translation work?',
      answer: 'We use Google\'s Gemini AI to translate your English product listings to natural, market-appropriate Korean. The translation includes product names, descriptions, and key features.',
    },
    {
      question: 'What file formats are supported?',
      answer: 'Catalogix supports CSV, XLSX, XLSM, and XLS file formats. We provide a template to help you structure your product data correctly.',
    },
    {
      question: 'Is there a limit on how many products I can upload?',
      answer: 'The platform can handle thousands of products per session. We recommend batches of up to 1000 products for optimal performance.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-full blur-3xl" />
          {/* Floating particles */}
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
          <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-accent/40 rounded-full animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-success/40 rounded-full animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary text-sm font-medium mb-8 animate-fade-in border border-primary/20 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>Now with AI-Powered Translation</span>
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">New</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 animate-slide-up leading-tight">
              Bulk Upload Products to{' '}
              <span className="text-gradient relative">
                Coupang
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 10C50 2 150 2 198 10" stroke="url(#underline-gradient)" strokeWidth="3" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                      <stop stopColor="hsl(var(--primary))" />
                      <stop offset="1" stopColor="hsl(var(--accent))" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>{' '}
              <br className="hidden sm:block" />
              in Minutes
            </h1>

            {/* Subheading */}
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
              The fastest way to list your products on Korea's largest e-commerce platform. 
              Upload thousands of products with just a few clicks.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/dashboard">
                <Button size="lg" className="gradient-primary text-white glow-primary text-lg px-8 py-6 group relative overflow-hidden">
                  <span className="relative z-10 flex items-center">
                    <Rocket className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                    Start Uploading Free
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 group border-2">
                  <span className="flex items-center">
                    Learn More
                    <ChevronDown className="h-5 w-5 ml-2 group-hover:translate-y-1 transition-transform" />
                  </span>
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-muted-foreground animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 backdrop-blur-sm">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm">No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 backdrop-blur-sm">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm">Official Coupang API</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 backdrop-blur-sm">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm">Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="relative text-center p-6 rounded-2xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 group hover:shadow-lg hover:-translate-y-1"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gradient mb-2">{stat.value}</div>
                  <div className="text-muted-foreground text-xs sm:text-sm font-medium">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              Powerful Features
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Everything You Need to{' '}
              <span className="text-gradient">Scale Your Business</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Powerful features designed to make your Coupang product management effortless.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 hover:border-primary/30 transition-all duration-500 hover:shadow-xl hover:-translate-y-2"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-20 bg-secondary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
              How It <span className="text-gradient">Works</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Get your products live on Coupang in just 3 simple steps.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: '01',
                title: 'Connect Your Account',
                description: 'Enter your Coupang Wing API credentials to securely connect your seller account.',
                icon: Shield,
              },
              {
                step: '02',
                title: 'Upload Your Products',
                description: 'Upload a CSV or Excel file with your product data. We\'ll validate everything automatically.',
                icon: Upload,
              },
              {
                step: '03',
                title: 'Go Live',
                description: 'Review the validation results and click upload. Your products will be live in minutes.',
                icon: Zap,
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="glass-card p-6 sm:p-8 h-full">
                  <div className="text-4xl sm:text-5xl font-bold text-primary/20 mb-3 sm:mb-4">{item.step}</div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                    <item.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{item.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="h-8 w-8 text-primary/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm font-medium mb-6">
                <TrendingUp className="h-4 w-4" />
                Why Catalogix
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                Why Choose <span className="text-gradient">Catalogix</span>?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Built by sellers, for sellers. We understand the pain of manual product uploads 
                and created the solution you've been waiting for.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
                <div className="relative glass-card p-8 rounded-3xl border border-border/50">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5" />
                  <div className="relative space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border/30">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold">5 mins</div>
                        <div className="text-sm text-muted-foreground">Upload time for 100 products</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border/30">
                      <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-7 w-7 text-success" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold">500+</div>
                        <div className="text-sm text-muted-foreground">Active sellers using Catalogix</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border/30">
                      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="h-7 w-7 text-accent" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold">1M+</div>
                        <div className="text-sm text-muted-foreground">Products uploaded this month</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              <MessageSquare className="h-4 w-4" />
              Testimonials
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Loved by <span className="text-gradient">Sellers</span> Worldwide
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See what our customers have to say about their experience with Catalogix.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl bg-background border border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-foreground mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Rocket className="h-4 w-4" />
              Roadmap
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              What's <span className="text-gradient">Coming Next</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We're constantly improving Catalogix. Here's what's on our roadmap.
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-muted transform md:-translate-x-1/2" />

            <div className="space-y-8 md:space-y-12">
              {roadmap.map((item, index) => (
                <div key={index} className={`relative flex flex-col md:flex-row gap-4 md:gap-8 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 rounded-full transform -translate-x-1/2 md:-translate-x-1/2 z-10 border-4 border-background"
                    style={{ 
                      backgroundColor: item.status === 'completed' ? 'hsl(var(--success))' : item.status === 'current' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                    }}
                  />
                  
                  {/* Content */}
                  <div className={`ml-10 md:ml-0 md:w-[calc(50%-2rem)] ${index % 2 === 0 ? 'md:pr-8' : 'md:pl-8'}`}>
                    <div className={`p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                      item.status === 'completed' 
                        ? 'bg-success/5 border-success/30' 
                        : item.status === 'current' 
                          ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/20' 
                          : 'bg-muted/30 border-border/50'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          item.status === 'completed' 
                            ? 'bg-success/20' 
                            : item.status === 'current' 
                              ? 'bg-primary/20' 
                              : 'bg-muted'
                        }`}>
                          <item.icon className={`h-5 w-5 ${
                            item.status === 'completed' 
                              ? 'text-success' 
                              : item.status === 'current' 
                                ? 'text-primary' 
                                : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            item.status === 'completed' 
                              ? 'bg-success/20 text-success' 
                              : item.status === 'current' 
                                ? 'bg-primary/20 text-primary' 
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {item.status === 'completed' ? '✓ Complete' : item.status === 'current' ? '🚀 In Progress' : '📅 Planned'}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {item.quarter}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <HeadphonesIcon className="h-4 w-4" />
              FAQ
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Got questions? We've got answers.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border/50 bg-background overflow-hidden transition-all duration-300 hover:border-primary/30"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-semibold pr-8">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === index ? 'max-h-96' : 'max-h-0'}`}>
                  <div className="px-6 pb-6 text-muted-foreground">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-8 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            Start Free Today
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white">
            Ready to Scale Your Coupang Business?
          </h2>
          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Join hundreds of successful sellers who save hours every week with Catalogix.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/dashboard">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-10 py-6 shadow-2xl group">
                <Rocket className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                Get Started Now
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 text-lg px-10 py-6">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 sm:py-16 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/catalogix_logo1.png" alt="Catalogix" className="h-10 w-auto" />
                <span className="text-2xl font-bold">Catalogix</span>
              </div>
              <p className="text-muted-foreground mb-6 max-w-md">
                The fastest way to bulk upload products to Coupang. Built for sellers.
              </p>
              <div className="flex gap-4">
                <a href="https://github.com/yashsaraswat2004/Catalogix" target="_blank" rel="noopener noreferrer" 
                   className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
                <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} Catalogix. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
