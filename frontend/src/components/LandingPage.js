import { useState } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Users, DollarSign, BarChart3, Receipt } from 'lucide-react';

const LandingPage = ({ setUser }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const payload = isLogin ? { email: formData.email, password: formData.password } : formData;

            const response = await axios.post(`${API}${endpoint}`, payload);
            localStorage.setItem('token', response.data.token);
            setUser(response.data.user);
            toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen landing-gradient">
            {/* Hero Section */}
            <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-2 gap-12 items-center min-h-[90vh]">
                    {/* Left Side - Hero Content */}
                    <div className="space-y-8 fade-in">
                        <div className="space-y-4">
                            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">
                                Split Bills
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
                                    Effortlessly
                                </span>
                            </h1>
                            <p className="text-xl text-gray-600 leading-relaxed">
                                Track shared expenses with friends, roommates, or travel buddies.
                                Never lose track of who owes what.
                            </p>
                        </div>

                        {/* Features Grid */}
                        <div className="grid grid-cols-2 gap-4 pt-8">
                            <div className="space-y-2">
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Create Groups</h3>
                                <p className="text-sm text-gray-600">Organize expenses by trips, roommates, or events</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Receipt className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Track Expenses</h3>
                                <p className="text-sm text-gray-600">Add expenses and split them instantly</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <BarChart3 className="w-6 h-6 text-purple-600" />
                                </div>
                                <h3 className="font-semibold text-gray-900">View Balances</h3>
                                <p className="text-sm text-gray-600">See who owes whom at a glance</p>
                            </div>
                            <div className="space-y-2">
                                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-orange-600" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Settle Up</h3>
                                <p className="text-sm text-gray-600">Mark payments as settled with one click</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Auth Form */}
                    <div className="flex justify-center items-center">
                        <Card className="w-full max-w-md p-8 shadow-2xl border-0 glass-effect">
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-bold text-gray-900">
                                        {isLogin ? 'Welcome Back' : 'Get Started'}
                                    </h2>
                                    <p className="text-gray-600">
                                        {isLogin ? 'Sign in to your account' : 'Create your free account'}
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {!isLogin && (
                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="text-gray-700 font-medium">Full Name</Label>
                                            <Input
                                                id="name"
                                                data-testid="register-name-input"
                                                placeholder="John Doe"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required={!isLogin}
                                                className="h-12 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                                        <Input
                                            id="email"
                                            data-testid="auth-email-input"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            className="h-12 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                                        <Input
                                            id="password"
                                            data-testid="auth-password-input"
                                            type="password"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            className="h-12 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        data-testid="auth-submit-button"
                                        disabled={loading}
                                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-medium text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
                                    >
                                        {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                                    </Button>
                                </form>

                                <div className="text-center">
                                    <button
                                        data-testid="auth-toggle-button"
                                        onClick={() => {
                                            setIsLogin(!isLogin);
                                            setFormData({ name: '', email: '', password: '' });
                                        }}
                                        className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                                    >
                                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;