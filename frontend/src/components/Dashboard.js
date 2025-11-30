import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Users, LogOut, Trash2, Receipt, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Dashboard = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newGroup, setNewGroup] = useState({
        name: '',
        description: '',
        currency: 'USD',
        memberNames: ['']
    });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await axios.get(`${API}/groups`);
            setGroups(response.data);
        } catch (error) {
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API}/groups`, {
                name: newGroup.name,
                description: newGroup.description,
                currency: newGroup.currency,
                member_names: newGroup.memberNames.filter(name => name.trim())
            });
            setGroups([response.data, ...groups]);
            setDialogOpen(false);
            setNewGroup({ name: '', description: '', currency: 'USD', memberNames: [''] });
            toast.success('Group created successfully!');
        } catch (error) {
            toast.error('Failed to create group');
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm('Are you sure you want to delete this group?')) return;

        try {
            await axios.delete(`${API}/groups/${groupId}`);
            setGroups(groups.filter(g => g.id !== groupId));
            toast.success('Group deleted successfully');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete group');
        }
    };

    const addMemberField = () => {
        setNewGroup({ ...newGroup, memberNames: [...newGroup.memberNames, ''] });
    };

    const updateMemberName = (index, value) => {
        const updated = [...newGroup.memberNames];
        updated[index] = value;
        setNewGroup({ ...newGroup, memberNames: updated });
    };

    const removeMemberField = (index) => {
        setNewGroup({
            ...newGroup,
            memberNames: newGroup.memberNames.filter((_, i) => i !== index)
        });
    };

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
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">SplitWise by Dhruv</h1>
                            <p className="text-sm text-gray-600">Welcome back, {user.name}!</p>
                        </div>
                        <Button
                            data-testid="logout-button"
                            onClick={onLogout}
                            variant="outline"
                            className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="p-6 stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Total Groups</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{groups.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-emerald-600" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Active Members</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">
                                    {groups.reduce((acc, g) => acc + g.members.length, 0)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Quick Actions</p>
                                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            data-testid="create-group-button"
                                            className="mt-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            New Group
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle className="text-2xl font-bold">Create New Group</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateGroup} className="space-y-5 mt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="groupName">Group Name</Label>
                                                <Input
                                                    id="groupName"
                                                    data-testid="group-name-input"
                                                    placeholder="e.g., Bali Trip 2024"
                                                    value={newGroup.name}
                                                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                                    required
                                                    className="h-11"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="groupDesc">Description (Optional)</Label>
                                                <Input
                                                    id="groupDesc"
                                                    data-testid="group-description-input"
                                                    placeholder="Add a description"
                                                    value={newGroup.description}
                                                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                                                    className="h-11"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="currency">Currency</Label>
                                                <Select
                                                    value={newGroup.currency}
                                                    onValueChange={(value) => setNewGroup({ ...newGroup, currency: value })}
                                                >
                                                    <SelectTrigger data-testid="currency-select" className="h-11">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-3">
                                                <Label>Group Members</Label>
                                                <div className="text-sm text-gray-600 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                                                    You are automatically added as a member
                                                </div>
                                                {newGroup.memberNames.map((name, index) => (
                                                    <div key={index} className="flex gap-2">
                                                        <Input
                                                            data-testid={`member-name-input-${index}`}
                                                            placeholder={`Member ${index + 1} name`}
                                                            value={name}
                                                            onChange={(e) => updateMemberName(index, e.target.value)}
                                                            className="h-11"
                                                        />
                                                        {newGroup.memberNames.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => removeMemberField(index)}
                                                                className="hover:bg-red-50 hover:border-red-300"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                                <Button
                                                    type="button"
                                                    data-testid="add-member-button"
                                                    variant="outline"
                                                    onClick={addMemberField}
                                                    className="w-full hover:bg-emerald-50 hover:border-emerald-500"
                                                >
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Another Member
                                                </Button>
                                            </div>

                                            <Button
                                                type="submit"
                                                data-testid="submit-create-group-button"
                                                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl"
                                            >
                                                Create Group
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <Receipt className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Groups List */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-900">Your Groups</h2>
                    {groups.length === 0 ? (
                        <Card className="p-12 text-center">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Users className="w-10 h-10 text-gray-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No groups yet</h3>
                                    <p className="text-gray-600 mb-4">Create your first group to start splitting expenses</p>
                                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl">
                                                <Plus className="w-4 h-4 mr-2" />
                                                Create Your First Group
                                            </Button>
                                        </DialogTrigger>
                                    </Dialog>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groups.map((group) => (
                                <Card
                                    key={group.id}
                                    data-testid={`group-card-${group.id}`}
                                    className="p-6 card-hover cursor-pointer border-2 hover:border-emerald-300"
                                    onClick={() => navigate(`/group/${group.id}`)}
                                >
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold text-gray-900 mb-1">{group.name}</h3>
                                                {group.description && (
                                                    <p className="text-sm text-gray-600">{group.description}</p>
                                                )}
                                            </div>
                                            {group.created_by === user.id && (
                                                <Button
                                                    data-testid={`delete-group-${group.id}`}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteGroup(group.id);
                                                    }}
                                                    className="hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm text-gray-600">{group.members.length} members</span>
                                            </div>
                                            <span className="text-sm font-medium text-emerald-600">{group.currency}</span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
