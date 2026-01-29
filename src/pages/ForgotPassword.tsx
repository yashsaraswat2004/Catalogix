import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast.error('Please enter your email address');
            return;
        }

        setIsLoading(true);

        try {
            // We need to implement the API call here. 
            // Assuming we will add a forgotPassword method to auth context or call fetch directly.
            // For now, let's call fetch directly to avoid changing Context interface yet.
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/forgotpassword`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSubmitted(true);
                toast.success('Reset link sent to your email');
            } else {
                toast.error(data.error || 'Failed to send reset link');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Left Panel - Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    {/* Back to Login */}
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Login
                    </Link>

                    {/* Logo */}
                    <div className="flex items-center gap-4 mb-8">
                        <img src="/nexcatalog_logo.png" alt="NexCatalog" className="w-14 h-14 rounded-xl object-contain" />
                        <span className="text-3xl font-bold">NexCatalog</span>
                    </div>

                    {!isSubmitted ? (
                        <>
                            {/* Heading */}
                            <h1 className="text-3xl font-bold mb-2">Forgot Password?</h1>
                            <p className="text-muted-foreground mb-8">
                                Don't worry! It happens. Please enter the email associated with your account.
                            </p>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-12"
                                        disabled={isLoading}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 gradient-primary text-white text-base"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                            Sending link...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="h-5 w-5 mr-2" />
                                            Send Reset Link
                                        </>
                                    )}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Mail className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Check your email</h2>
                            <p className="text-muted-foreground mb-8">
                                We have sent a password reset link to <span className="font-semibold text-foreground">{email}</span>.
                            </p>
                            <div className="text-sm text-muted-foreground">
                                Did not receive the email? Check your spam filter, or
                                <button
                                    onClick={() => setIsSubmitted(false)}
                                    className="text-primary hover:underline ml-1 font-medium"
                                >
                                    try another email address
                                </button>
                                .
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Decorative */}
            <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="flex flex-col justify-center px-12 relative z-10">
                    <blockquote className="text-white">
                        <p className="text-2xl font-medium mb-6 leading-relaxed">
                            "Security is our top priority. We ensure your account is protected with industry-standard encryption."
                        </p>
                    </blockquote>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
