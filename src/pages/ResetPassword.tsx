import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/resetpassword/${token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Password reset successfully!');
                navigate('/login');
            } else {
                toast.error(data.error || 'Failed to reset password');
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

                    {/* Heading */}
                    <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
                    <p className="text-muted-foreground mb-8">
                        Please enter your new password below.
                    </p>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 pr-12"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                                    Resetting Password...
                                </>
                            ) : (
                                <>
                                    <Lock className="h-5 w-5 mr-2" />
                                    Reset Password
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right Panel - Decorative */}
            <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="flex flex-col justify-center px-12 relative z-10">
                    <blockquote className="text-white">
                        <p className="text-2xl font-medium mb-6 leading-relaxed">
                            "Secure your account with a strong password. We recommend using a mix of letters, numbers, and symbols."
                        </p>
                    </blockquote>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
