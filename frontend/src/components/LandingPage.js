import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Receipt, DollarSign, Users, TrendingUp, CheckCircle } from 'lucide-react';

const GroupDetail = ({ user }) => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [balances, setBalances] = useState({ transactions: [], member_balances: [], currency: 'USD' });
    const [loading, setLoading] = useState(true);
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
    const [settleDialogOpen, setSettleDialogOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        category: 'Other',
        paid_by: '',
        split_type: 'equal',
        custom_splits: {}
    });

    useEffect(() => {
        fetchGroupData();
    }, [groupId]);

    const fetchGroupData = async () => {
        try {
            const [groupRes, expensesRes, settlementsRes, balancesRes] = await Promise.all([
                axios.get(`${API}/groups/${groupId}`),
                axios.get(`${API}/groups/${groupId}/expenses`),
                axios.get(`${API}/groups/${groupId}/settlements`),
                axios.get(`${API}/groups/${groupId}/balances`)
            ]);

            setGroup(groupRes.data);
            setExpenses(expensesRes.data);
            setSettlements(settlementsRes.data);
            setBalances(balancesRes.data);
            setNewExpense(prev => ({ ...prev, paid_by: groupRes.data.members[0]?.user_id || '' }));
        } catch (error) {
            toast.error('Failed to load group data');
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();

        const amount = parseFloat(newExpense.amount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        let splits = [];
        const paidByMember = group.members.find(m => m.user_id === newExpense.paid_by);

        if (newExpense.split_type === 'equal') {
            const splitAmount = amount / group.members.length;
            splits = group.members.map(m => ({
                user_id: m.user_id,
                name: m.name,
                amount: parseFloat(splitAmount.toFixed(2))
            }));
        } else {
            splits = Object.entries(newExpense.custom_splits).map(([userId, amt]) => {
                const member = group.members.find(m => m.user_id === userId);
                return {
                    user_id: userId,
                    name: member?.name || 'Unknown',
                    amount: parseFloat(amt) || 0
                };
            });

            const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
            if (Math.abs(totalSplit - amount) > 0.01) {
                toast.error(`Split amounts must equal total expense (${amount})`);
                return;
            }
        }

        try {
            await axios.post(`${API}/groups/${groupId}/expenses`, {
                description: newExpense.description,
                amount: amount,
                category: newExpense.category,
                paid_by: newExpense.paid_by,
                paid_by_name: paidByMember?.name || 'Unknown',
                split_type: newExpense.split_type,
                splits: splits,
                date: new Date().toISOString().split('T')[0]
            });

            await fetchGroupData();
            setExpenseDialogOpen(false);
            setNewExpense({
                description: '',
                amount: '',
                category: 'Other',
                paid_by: group.members[0]?.user_id || '',
                split_type: 'equal',
                custom_splits: {}
            });
            toast.success('Expense added successfully!');
        } catch (error) {
            toast.error('Failed to add expense');
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;

        try {
            await axios.delete(`${API}/expenses/${expenseId}`);
            await fetchGroupData();
            toast.success('Expense deleted successfully');
        } catch (error) {
            toast.error('Failed to delete expense');
        }
    };

    const handleSettle = async (transaction) => {
        try {
            await axios.post(`${API}/groups/${groupId}/settle`, {
                from_user_id: transaction.from_user_id,
                from_user_name: transaction.from_user_name,
                to_user_id: transaction.to_user_id,
                to_user_name: transaction.to_user_name,
                amount: transaction.amount,
                date: new Date().toISOString().split('T')[0]
            });

            await fetchGroupData();
            setSettleDialogOpen(false);
            setSelectedTransaction(null);
            toast.success('Payment settled successfully!');
        } catch (error) {
            toast.error('Failed to settle payment');
        }
    };

    const getCategoryColor = (category) => {
        const colors = {
            Food: 'category-food',
            Transport: 'category-transport',
            Entertainment: 'category-entertainment',
            Utilities: 'category-utilities',
            Shopping: 'category-shopping',
            Other: 'category-other'
        };
        return colors[category] || 'category-other';
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const userBalance = balances.member_balances.find(b => b.user_id === user.id)?.balance || 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button
                            data-testid="back-to-dashboard"
                            variant="ghost"
                            onClick={() => navigate('/dashboard')}
                            className="hover:bg-gray-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                            {group.description && (
                                <p className="text-sm text-gray-600">{group.description}</p>
                            )}
                        </div>
                        <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    data-testid="add-expense-button"
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">Add New Expense</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleAddExpense} className="space-y-5 mt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="expenseDesc">Description</Label>
                                        <Input
                                            id="expenseDesc"
                                            data-testid="expense-description-input"
                                            placeholder="e.g., Dinner at restaurant"
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                            required
                                            className="h-11"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="amount">Amount ({group.currency})</Label>
                                            <Input
                                                id="amount"
                                                data-testid="expense-amount-input"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={newExpense.amount}
                                                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                                required
                                                className="h-11"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="category">Category</Label>
                                            <Select
                                                value={newExpense.category}
                                                onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                                            >
                                                <SelectTrigger data-testid="expense-category-select" className="h-11">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Food">Food</SelectItem>
                                                    <SelectItem value="Transport">Transport</SelectItem>
                                                    <SelectItem value="Entertainment">Entertainment</SelectItem>
                                                    <SelectItem value="Utilities">Utilities</SelectItem>
                                                    <SelectItem value="Shopping">Shopping</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="paidBy">Paid By</Label>
                                        <Select
                                            value={newExpense.paid_by}
                                            onValueChange={(value) => setNewExpense({ ...newExpense, paid_by: value })}
                                        >
                                            <SelectTrigger data-testid="expense-paidby-select" className="h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {group.members.map(member => (
                                                    <SelectItem key={member.user_id} value={member.user_id}>
                                                        {member.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="splitType">Split Type</Label>
                                        <Select
                                            value={newExpense.split_type}
                                            onValueChange={(value) => setNewExpense({ ...newExpense, split_type: value })}
                                        >
                                            <SelectTrigger data-testid="expense-splittype-select" className="h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="equal">Split Equally</SelectItem>
                                                <SelectItem value="custom">Custom Split</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {newExpense.split_type === 'custom' && (
                                        <div className="space-y-3">
                                            <Label>Custom Amounts</Label>
                                            {group.members.map(member => (
                                                <div key={member.user_id} className="flex items-center gap-3">
                                                    <span className="text-sm font-medium w-32 truncate">{member.name}</span>
                                                    <Input
                                                        data-testid={`custom-split-${member.user_id}`}
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={newExpense.custom_splits[member.user_id] || ''}
                                                        onChange={(e) => setNewExpense({
                                                            ...newExpense,
                                                            custom_splits: {
                                                                ...newExpense.custom_splits,
                                                                [member.user_id]: e.target.value
                                                            }
                                                        })}
                                                        className="h-10"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        data-testid="submit-expense-button"
                                        className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl"
                                    >
                                        Add Expense
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card className="p-6 stat-card">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 font-medium">Total Expenses</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {group.currency} {totalExpenses.toFixed(2)}
                            </p>
                        </div>
                    </Card>

                    <Card className="p-6 stat-card">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 font-medium">Your Balance</p>
                            <p className={`text-3xl font-bold ${userBalance > 0 ? 'text-emerald-600' : userBalance < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                {group.currency} {Math.abs(userBalance).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                                {userBalance > 0 ? 'You are owed' : userBalance < 0 ? 'You owe' : 'Settled up'}
                            </p>
                        </div>
                    </Card>

                    <Card className="p-6 stat-card">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 font-medium">Group Members</p>
                            <p className="text-3xl font-bold text-gray-900">{group.members.length}</p>
                        </div>
                    </Card>

                    <Card className="p-6 stat-card">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 font-medium">Transactions</p>
                            <p className="text-3xl font-bold text-gray-900">{expenses.length}</p>
                        </div>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="expenses" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
                        <TabsTrigger data-testid="expenses-tab" value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger data-testid="balances-tab" value="balances">Balances</TabsTrigger>
                        <TabsTrigger data-testid="settlements-tab" value="settlements">Settlements</TabsTrigger>
                    </TabsList>

                    {/* Expenses Tab */}
                    <TabsContent value="expenses" className="space-y-4">
                        {expenses.length === 0 ? (
                            <Card className="p-12 text-center">
                                <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No expenses yet</h3>
                                <p className="text-gray-600">Add your first expense to get started</p>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {expenses.map((expense) => (
                                    <Card key={expense.id} data-testid={`expense-${expense.id}`} className="p-6 expense-card">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-900">{expense.description}</h3>
                                                    <span className={`category-badge ${getCategoryColor(expense.category)}`}>
                                                        {expense.category}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm text-gray-600">
                                                        Paid by <span className="font-medium text-gray-900">{expense.paid_by_name}</span>
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Split: {expense.split_type === 'equal' ? 'Equally' : 'Custom'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{expense.date}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-gray-900">
                                                        {group.currency} {expense.amount.toFixed(2)}
                                                    </p>
                                                </div>
                                                <Button
                                                    data-testid={`delete-expense-${expense.id}`}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteExpense(expense.id)}
                                                    className="hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Balances Tab */}
                    <TabsContent value="balances" className="space-y-6">
                        {/* Member Balances */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gray-900">Member Balances</h3>
                            <div className="grid gap-4">
                                {balances.member_balances.map((member) => (
                                    <Card key={member.user_id} className="p-6">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{member.name}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {member.balance > 0 ? 'Gets back' : member.balance < 0 ? 'Owes' : 'Settled'}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className={`text-2xl font-bold ${member.balance > 0 ? 'text-emerald-600' : member.balance < 0 ? 'text-red-600' : 'text-gray-600'
                                                }`}>
                                                {group.currency} {Math.abs(member.balance).toFixed(2)}
                                            </p>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* Suggested Settlements */}
                        {balances.transactions.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-gray-900">Suggested Settlements</h3>
                                <div className="grid gap-4">
                                    {balances.transactions.map((transaction, index) => (
                                        <Card key={index} data-testid={`settlement-suggestion-${index}`} className="p-6 settle-animation bg-gradient-to-r from-white to-emerald-50">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <DollarSign className="w-10 h-10 text-emerald-600" />
                                                    <div>
                                                        <p className="text-gray-900">
                                                            <span className="font-bold">{transaction.from_user_name}</span>
                                                            {' owes '}
                                                            <span className="font-bold">{transaction.to_user_name}</span>
                                                        </p>
                                                        <p className="text-2xl font-bold text-emerald-600 mt-1">
                                                            {group.currency} {transaction.amount.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    data-testid={`settle-button-${index}`}
                                                    onClick={() => handleSettle(transaction)}
                                                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl"
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Settle Up
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {balances.transactions.length === 0 && (
                            <Card className="p-12 text-center">
                                <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Settled Up!</h3>
                                <p className="text-gray-600">No pending payments in this group</p>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Settlements Tab */}
                    <TabsContent value="settlements" className="space-y-4">
                        {settlements.length === 0 ? (
                            <Card className="p-12 text-center">
                                <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No settlements yet</h3>
                                <p className="text-gray-600">Payment settlements will appear here</p>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {settlements.map((settlement) => (
                                    <Card key={settlement.id} data-testid={`settlement-${settlement.id}`} className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="text-gray-900">
                                                        <span className="font-semibold">{settlement.from_user_name}</span>
                                                        {' paid '}
                                                        <span className="font-semibold">{settlement.to_user_name}</span>
                                                    </p>
                                                    <p className="text-sm text-gray-600">{settlement.date}</p>
                                                </div>
                                            </div>
                                            <p className="text-xl font-bold text-emerald-600">
                                                {group.currency} {settlement.amount.toFixed(2)}
                                            </p>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default GroupDetail;