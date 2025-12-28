import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          {/* 404 Illustration */}
          <div className="relative mb-8">
            <div className="text-[150px] sm:text-[200px] font-bold text-gradient opacity-20 leading-none select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
              </div>
            </div>
          </div>
          
          {/* Message */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground mb-8 text-base sm:text-lg">
            Oops! The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/">
              <Button size="lg" className="gradient-primary text-white gap-2 w-full sm:w-auto">
                <Home className="h-5 w-5" />
                Go to Homepage
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => window.history.back()}
              className="gap-2 w-full sm:w-auto"
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back
            </Button>
          </div>
          
          {/* Attempted Path */}
          <p className="mt-8 text-xs text-muted-foreground">
            Attempted path: <code className="px-2 py-1 bg-muted rounded">{location.pathname}</code>
          </p>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <div className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Catalogix. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default NotFound;
