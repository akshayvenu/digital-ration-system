import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from './ui/sheet';
import { Progress } from './ui/progress';
import {
  Home,
  Users,
  Store,
  Flag,
  BarChart3,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  Menu,
  Search,
  Edit,
  Trash2,
  Eye,
  Shield,
  UserCheck,
  UserX,
  MapPin,
  Phone,
  Mail,
  Building,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Package
} from 'lucide-react';

interface MobileAdminDashboardProps {
  userData: any;
  onLogout: () => void;
}

interface UserData {
  id: number;
  email: string;
  role: 'admin' | 'shopkeeper' | 'cardholder';
  name: string;
  mobileNumber?: string;
  address?: string;
  district?: string;
  rationCardNumber?: string;
  cardType?: 'AAY' | 'PHH' | 'BPL' | 'APL';
  cardColor?: string;
  familySize?: number;
  shopId?: string;
  shopName?: string;
  shopAddress?: string;
  shopHours?: string;
  isActive?: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  flaggedByName?: string;
  lastLogin?: string;
  createdAt?: string;
  cardStatus?: string;
  allocations?: Array<{
    itemCode: string;
    eligibleQuantity: number;
    collectedQuantity: number;
    month: number;
    year: number;
  }>;
}

interface ShopData {
  id: string;
  name: string;
  district: string;
  address: string;
  contactEmail?: string;
  workingHours?: string;
  shopkeeperCount?: number;
  cardholderCount?: number;
}

interface UserStats {
  shopId: string;
  shopName: string;
  shopkeepers: number;
  cardholders: number;
  flaggedUsers: number;
  flaggedShopkeepers: number;
}

type ActiveTab = 'dashboard' | 'users' | 'shopkeepers' | 'flagged' | 'shops';

export function MobileAdminDashboard({ userData, onLogout }: MobileAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Users & Shopkeepers
  const [users, setUsers] = useState<UserData[]>([]);
  const [shopkeepers, setShopkeepers] = useState<UserData[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<UserData[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  
  // Shops
  const [shops, setShops] = useState<ShopData[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');
  const [selectedCardType, setSelectedCardType] = useState('all');
  
  // Selected user for detail view
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [editingAllocations, setEditingAllocations] = useState(false);
  
  // Flag modal
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [userToFlag, setUserToFlag] = useState<UserData | null>(null);

  const API_BASE = 'http://localhost:5000/api';
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Demo data fallback
  const demoUsers: UserData[] = [
    { id: 1, email: 'ram.kumar@gmail.com', role: 'cardholder', name: 'Ram Kumar', mobileNumber: '9876543210', address: 'Village Rampur, Block A', district: 'Delhi', rationCardNumber: 'DL-AAY-001234', cardType: 'AAY', familySize: 5, shopId: 'SHOP001', shopName: 'Rampur Ration Shop', isFlagged: false },
    { id: 2, email: 'sita.devi@gmail.com', role: 'cardholder', name: 'Sita Devi', mobileNumber: '9876543211', address: 'Mohalla Ganj, Street 5', district: 'Delhi', rationCardNumber: 'DL-PHH-002345', cardType: 'PHH', familySize: 4, shopId: 'SHOP001', shopName: 'Rampur Ration Shop', isFlagged: false },
    { id: 3, email: 'mohan.lal@gmail.com', role: 'cardholder', name: 'Mohan Lal', mobileNumber: '9876543212', address: 'Sector 12, House 45', district: 'Mumbai', rationCardNumber: 'MH-BPL-003456', cardType: 'BPL', familySize: 3, shopId: 'SHOP002', shopName: 'Mumbai Central FPS', isFlagged: true, flagReason: 'Duplicate ration card suspected', flaggedAt: '2025-11-25' },
    { id: 4, email: 'geeta.sharma@gmail.com', role: 'cardholder', name: 'Geeta Sharma', mobileNumber: '9876543213', address: 'Block C, Flat 12', district: 'Delhi', rationCardNumber: 'DL-APL-004567', cardType: 'APL', familySize: 2, shopId: 'SHOP001', shopName: 'Rampur Ration Shop', isFlagged: false },
  ];

  const demoShopkeepers: UserData[] = [
    { id: 10, email: 'shopkeeper1@shop.com', role: 'shopkeeper', name: 'Rajesh Verma', mobileNumber: '9988776655', shopId: 'SHOP001', shopName: 'Rampur Ration Shop', address: 'Main Market, Rampur', district: 'Delhi', isFlagged: false },
    { id: 11, email: 'shopkeeper2@shop.com', role: 'shopkeeper', name: 'Suresh Patel', mobileNumber: '9988776656', shopId: 'SHOP002', shopName: 'Mumbai Central FPS', address: 'Station Road, Mumbai', district: 'Mumbai', isFlagged: false },
  ];

  const demoShops: ShopData[] = [
    { id: 'SHOP001', name: 'Rampur Ration Shop', district: 'Delhi', address: 'Main Market, Rampur, Delhi - 110001', workingHours: '9:00 AM - 5:00 PM' },
    { id: 'SHOP002', name: 'Mumbai Central FPS', district: 'Mumbai', address: 'Station Road, Mumbai Central - 400008', workingHours: '10:00 AM - 6:00 PM' },
  ];

  const demoStats: UserStats[] = [
    { shopId: 'SHOP001', shopName: 'Rampur Ration Shop', shopkeepers: 1, cardholders: 3, flaggedUsers: 0, flaggedShopkeepers: 0 },
    { shopId: 'SHOP002', shopName: 'Mumbai Central FPS', shopkeepers: 1, cardholders: 1, flaggedUsers: 1, flaggedShopkeepers: 0 },
  ];

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchShopkeepers(),
        fetchFlaggedUsers(),
        fetchUserStats(),
        fetchShops()
      ]);
    } catch (err) {
      console.error('Fetch error, using demo data:', err);
      // Use demo data as fallback
      setUsers(demoUsers.filter(u => u.role === 'cardholder'));
      setShopkeepers(demoShopkeepers);
      setFlaggedUsers(demoUsers.filter(u => u.isFlagged));
      setUserStats(demoStats);
      setShops(demoShops);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      params.set('role', 'cardholder');
      if (selectedShopFilter !== 'all') params.set('shopId', selectedShopFilter);
      
      const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.data || []);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Failed to fetch users, using demo:', err);
      let filtered = demoUsers.filter(u => u.role === 'cardholder');
      if (selectedShopFilter !== 'all') {
        filtered = filtered.filter(u => u.shopId === selectedShopFilter);
      }
      setUsers(filtered);
    }
  };

  const fetchShopkeepers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users?role=shopkeeper`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShopkeepers(data.data || []);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Failed to fetch shopkeepers, using demo:', err);
      setShopkeepers(demoShopkeepers);
    }
  };

  const fetchFlaggedUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users?flagged=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFlaggedUsers(data.data || []);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Failed to fetch flagged users, using demo:', err);
      setFlaggedUsers([...demoUsers, ...demoShopkeepers].filter(u => u.isFlagged));
    }
  };

  const fetchUserStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserStats(data.data || []);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Failed to fetch user stats, using demo:', err);
      setUserStats(demoStats);
    }
  };

  const fetchShops = async () => {
    try {
      const res = await fetch(`${API_BASE}/shops`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setShops(data);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Failed to fetch shops, using demo:', err);
      setShops(demoShops);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'shopkeepers') fetchShopkeepers();
    else if (activeTab === 'flagged') fetchFlaggedUsers();
    else if (activeTab === 'shops') fetchShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedShopFilter]);

  // View user details
  const viewUserDetails = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedUser(data.data);
        setUserDetailOpen(true);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      // Use demo data
      const allDemoUsers = [...demoUsers, ...demoShopkeepers];
      const user = allDemoUsers.find(u => u.id === userId);
      if (user) {
        // Add demo allocations for cardholders
        if (user.role === 'cardholder') {
          setSelectedUser({
            ...user,
            allocations: [
              { itemCode: 'rice', eligibleQuantity: 5, collectedQuantity: 2, month: 11, year: 2025 },
              { itemCode: 'wheat', eligibleQuantity: 5, collectedQuantity: 0, month: 11, year: 2025 },
              { itemCode: 'sugar', eligibleQuantity: 1, collectedQuantity: 1, month: 11, year: 2025 },
            ]
          });
        } else {
          setSelectedUser(user);
        }
        setUserDetailOpen(true);
      } else {
        alert('User not found');
      }
    }
  };

  // Flag/Unflag user
  const openFlagModal = (user: UserData) => {
    setUserToFlag(user);
    setFlagReason('');
    setFlagModalOpen(true);
  };

  const confirmFlag = async () => {
    if (!userToFlag || !flagReason.trim()) return;
    
    try {
      const res = await fetch(`${API_BASE}/users/${userToFlag.id}/flag`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isFlagged: true, flagReason: flagReason.trim() })
      });
      
      if (res.ok) {
        alert(`🚩 ${userToFlag.name} has been flagged successfully`);
        setFlagModalOpen(false);
        setUserToFlag(null);
        fetchData();
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      // Demo mode - update local state
      const updatedUser = { ...userToFlag, isFlagged: true, flagReason: flagReason.trim(), flaggedAt: new Date().toISOString() };
      
      // Update users list
      setUsers(prev => prev.map(u => u.id === userToFlag.id ? updatedUser : u));
      setShopkeepers(prev => prev.map(u => u.id === userToFlag.id ? updatedUser : u));
      setFlaggedUsers(prev => [...prev.filter(u => u.id !== userToFlag.id), updatedUser]);
      
      // Update stats
      setUserStats(prev => prev.map(stat => {
        if (stat.shopId === userToFlag.shopId) {
          return { ...stat, flaggedUsers: stat.flaggedUsers + 1 };
        }
        return stat;
      }));
      
      alert(`🚩 ${userToFlag.name} has been flagged successfully (Demo Mode)`);
      setFlagModalOpen(false);
      setUserToFlag(null);
    }
  };

  const unflagUser = async (user: UserData) => {
    if (!confirm(`Remove flag from ${user.name}?`)) return;
    
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/flag`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isFlagged: false })
      });
      
      if (res.ok) {
        alert(`✅ Flag removed from ${user.name}`);
        fetchData();
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      // Demo mode - update local state
      const updatedUser = { ...user, isFlagged: false, flagReason: undefined, flaggedAt: undefined };
      
      // Update users list
      setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
      setShopkeepers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
      setFlaggedUsers(prev => prev.filter(u => u.id !== user.id));
      
      // Update stats
      setUserStats(prev => prev.map(stat => {
        if (stat.shopId === user.shopId) {
          return { ...stat, flaggedUsers: Math.max(0, stat.flaggedUsers - 1) };
        }
        return stat;
      }));
      
      // Update selected user if viewing
      if (selectedUser?.id === user.id) {
        setSelectedUser(updatedUser);
      }
      
      alert(`✅ Flag removed from ${user.name} (Demo Mode)`);
    }
  };

  // Update allocations
  const updateAllocation = (itemCode: string, newQuantity: number) => {
    if (!selectedUser) return;
    setSelectedUser({
      ...selectedUser,
      allocations: selectedUser.allocations?.map((a) =>
        a.itemCode === itemCode ? { ...a, eligibleQuantity: newQuantity } : a
      )
    });
  };

  const saveAllocations = async () => {
    if (!selectedUser?.allocations) return;
    
    try {
      const res = await fetch(`${API_BASE}/users/${selectedUser.id}/allocations`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          allocations: selectedUser.allocations.map((a) => ({
            itemCode: a.itemCode,
            eligibleQuantity: a.eligibleQuantity
          }))
        })
      });
      
      if (res.ok) {
        alert('✅ Allocations updated successfully');
        setEditingAllocations(false);
        viewUserDetails(selectedUser.id);
      }
    } catch (err) {
      alert('Failed to save allocations');
    }
  };

  // Filter users by search
  const filterBySearch = (list: UserData[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(u => 
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.rationCardNumber?.toLowerCase().includes(q) ||
      u.mobileNumber?.includes(q)
    );
  };

  // Get card type color
  const getCardTypeColor = (type?: string) => {
    switch (type) {
      case 'AAY': return 'bg-orange-500 text-white';
      case 'PHH': return 'bg-pink-500 text-white';
      case 'BPL': return 'bg-blue-500 text-white';
      case 'APL': return 'bg-gray-200 text-gray-800';
      default: return 'bg-gray-100';
    }
  };

  // Calculate totals
  const totalCardholders = userStats.reduce((sum, s) => sum + (s.cardholders || 0), 0);
  const totalShopkeepers = userStats.reduce((sum, s) => sum + (s.shopkeepers || 0), 0);
  const totalFlagged = userStats.reduce((sum, s) => sum + (s.flaggedUsers || 0), 0);

  // Render Dashboard Tab
  const renderDashboard = () => (
    <div className="space-y-4">
      {/* Welcome */}
      <div className="rounded-xl p-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
        <h2 className="text-xl font-bold" style={{ color: 'white' }}>Welcome, {userData?.name || 'Admin'}</h2>
        <p className="text-sm mt-1" style={{ color: '#a7f3d0' }}>Government Admin Dashboard • User & Shop Management</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-white shadow-md rounded-xl overflow-hidden border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#3b82f6' }}>
                <Users className="w-5 h-5" style={{ color: 'white' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{totalCardholders}</p>
                <p className="text-sm text-gray-500">Cardholders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md rounded-xl overflow-hidden border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#10b981' }}>
                <Store className="w-5 h-5" style={{ color: 'white' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{totalShopkeepers}</p>
                <p className="text-sm text-gray-500">Shopkeepers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md rounded-xl overflow-hidden border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#8b5cf6' }}>
                <Building className="w-5 h-5" style={{ color: 'white' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{shops.length}</p>
                <p className="text-sm text-gray-500">Active Shops</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-white shadow-md rounded-xl overflow-hidden border-0 ${totalFlagged > 0 ? 'ring-2 ring-red-400' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: totalFlagged > 0 ? '#ef4444' : '#6b7280' }}>
                <Flag className="w-5 h-5" style={{ color: 'white' }} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${totalFlagged > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {totalFlagged}
                </p>
                <p className={`text-sm ${totalFlagged > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  Flagged Users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shop-wise Summary */}
      <Card className="bg-white shadow-md rounded-xl border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Shop-wise Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {userStats.map((stat) => (
            <div key={stat.shopId} className="flex items-center justify-between p-2 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{stat.shopName}</p>
                <p className="text-xs text-muted-foreground">
                  {stat.cardholders} cardholders • {stat.shopkeepers} shopkeeper(s)
                </p>
              </div>
              {stat.flaggedUsers > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stat.flaggedUsers} flagged
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            className="h-auto py-3 flex flex-col gap-1"
            onClick={() => setActiveTab('users')}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Manage Users</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-3 flex flex-col gap-1"
            onClick={() => setActiveTab('shopkeepers')}
          >
            <Store className="w-5 h-5" />
            <span className="text-xs">Manage Shops</span>
          </Button>
          <Button 
            variant="outline" 
            className={`h-auto py-3 flex flex-col gap-1 ${totalFlagged > 0 ? 'border-red-300 text-red-600' : ''}`}
            onClick={() => setActiveTab('flagged')}
          >
            <Flag className="w-5 h-5" />
            <span className="text-xs">View Flagged</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-3 flex flex-col gap-1"
            onClick={fetchData}
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-xs">Refresh Data</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Render Users Tab (Cardholders)
  const renderUsers = () => {
    const filteredUsers = filterBySearch(users).filter(u => 
      selectedCardType === 'all' || u.cardType === selectedCardType
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cardholder Management</h2>
          <Badge variant="secondary">{filteredUsers.length} users</Badge>
        </div>

        {/* Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, card number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedShopFilter}
              onChange={(e) => setSelectedShopFilter(e.target.value)}
              className="flex-1 p-2 border rounded-lg text-sm"
            >
              <option value="all">All Shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            
            <select
              value={selectedCardType}
              onChange={(e) => setSelectedCardType(e.target.value)}
              className="flex-1 p-2 border rounded-lg text-sm"
            >
              <option value="all">All Card Types</option>
              <option value="AAY">AAY (Antyodaya)</option>
              <option value="PHH">PHH (Priority)</option>
              <option value="BPL">BPL</option>
              <option value="APL">APL</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No cardholders found
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <Card 
                key={user.id} 
                className={`transition-all hover:shadow-md bg-white ${
                  user.isFlagged ? 'border-l-4 border-l-red-500 bg-red-50' : 'border-l-4 border-l-blue-500'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => viewUserDetails(user.id)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{user.name}</span>
                        {user.cardType && (
                          <Badge className={`text-xs ${getCardTypeColor(user.cardType)}`}>
                            {user.cardType}
                          </Badge>
                        )}
                        {user.isFlagged && (
                          <Badge variant="destructive" className="text-xs">
                            <Flag className="w-3 h-3 mr-1" />
                            Flagged
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        {user.rationCardNumber && (
                          <div>Card: {user.rationCardNumber}</div>
                        )}
                        {user.shopName && (
                          <div className="flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {user.shopName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!user.isFlagged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFlagModal(user);
                          }}
                        >
                          <Flag className="w-3 h-3 mr-1" />
                          Flag
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            unflagUser(user);
                          }}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Unflag
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewUserDetails(user.id);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  };

  // Render Shopkeepers Tab
  const renderShopkeepers = () => {
    const filteredShopkeepers = filterBySearch(shopkeepers);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Shopkeeper Management</h2>
          <Badge variant="secondary">{filteredShopkeepers.length} shopkeepers</Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search shopkeepers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Shopkeepers List */}
        <div className="space-y-2">
          {filteredShopkeepers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No shopkeepers found
              </CardContent>
            </Card>
          ) : (
            filteredShopkeepers.map((shopkeeper) => (
              <Card 
                key={shopkeeper.id} 
                className={`transition-all hover:shadow-md bg-white ${
                  shopkeeper.isFlagged ? 'border-l-4 border-l-red-500 bg-red-50' : 'border-l-4 border-l-green-500'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => viewUserDetails(shopkeeper.id)}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-green-100 rounded-lg">
                          <Store className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="font-medium">{shopkeeper.name}</span>
                        {shopkeeper.isFlagged && (
                          <Badge variant="destructive" className="text-xs">
                            <Flag className="w-3 h-3 mr-1" />
                            Flagged
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5 ml-8">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{shopkeeper.email}</span>
                        </div>
                        {shopkeeper.shopName && (
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {shopkeeper.shopName}
                          </div>
                        )}
                        {shopkeeper.mobileNumber && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {shopkeeper.mobileNumber}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!shopkeeper.isFlagged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFlagModal(shopkeeper);
                          }}
                        >
                          <Flag className="w-3 h-3 mr-1" />
                          Flag
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            unflagUser(shopkeeper);
                          }}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Unflag
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewUserDetails(shopkeeper.id);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  };

  // Render Flagged Users Tab
  const renderFlagged = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-700">Flagged Users</h2>
        </div>
        <Badge variant="destructive">{flaggedUsers.length}</Badge>
      </div>

      {flaggedUsers.length === 0 ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-green-700 font-medium">No flagged users</p>
            <p className="text-sm text-green-600">All users are in good standing</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flaggedUsers.map((user) => (
            <Card key={user.id} className="border-red-300 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Flag className="w-4 h-4 text-red-500" />
                      <span className="font-medium">{user.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                    
                    <div className="bg-red-100 rounded-lg p-2 mb-2">
                      <p className="text-xs text-red-600 font-medium">Flag Reason:</p>
                      <p className="text-sm text-red-800">{user.flagReason || 'No reason provided'}</p>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>{user.email}</div>
                      {user.shopName && <div>Shop: {user.shopName}</div>}
                      {user.flaggedAt && (
                        <div>Flagged: {new Date(user.flaggedAt).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewUserDetails(user.id)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => unflagUser(user)}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Unflag
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Render Shops Tab
  const renderShops = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shop Management</h2>
        <Badge variant="secondary">{shops.length} shops</Badge>
      </div>

      <div className="space-y-3">
        {shops.map((shop) => {
          const stats = userStats.find(s => s.shopId === shop.id);
          return (
            <Card key={shop.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Building className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{shop.name}</h3>
                    <p className="text-sm text-muted-foreground">{shop.address}</p>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {stats?.cardholders || 0} cardholders
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Store className="w-3 h-3 mr-1" />
                        {stats?.shopkeepers || 0} shopkeeper(s)
                      </Badge>
                    </div>
                    
                    {shop.workingHours && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {shop.workingHours}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // Main render
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'users': return renderUsers();
      case 'shopkeepers': return renderShopkeepers();
      case 'flagged': return renderFlagged();
      case 'shops': return renderShops();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 shadow-lg" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'white' }}>Admin Dashboard</h1>
            <p className="text-sm" style={{ color: '#93c5fd' }}>प्रशासक (User & Shop Management)</p>
          </div>

          {/* Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="hover:bg-blue-700">
                <Menu className="w-6 h-6" style={{ color: 'white' }} />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Admin Menu</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <h3 className="font-medium">{userData?.name}</h3>
                  <p className="text-sm text-muted-foreground">{userData?.email}</p>
                  <Badge>Government Admin</Badge>
                </div>

                <hr />

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Total Users: {totalCardholders + totalShopkeepers}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Shops: {shops.length}
                  </p>
                </div>

                <hr />

                <Button variant="destructive" onClick={onLogout} className="w-full">
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Content */}
      <div className="pb-20">
        <div className="p-4">
          {loading && activeTab === 'dashboard' ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-screen-xl mx-auto px-2">
          <div className="flex justify-around items-center h-16">
            {[
              { id: 'dashboard' as ActiveTab, icon: Home, label: 'Home' },
              { id: 'users' as ActiveTab, icon: Users, label: 'Users' },
              { id: 'shopkeepers' as ActiveTab, icon: Store, label: 'Shops' },
              { id: 'flagged' as ActiveTab, icon: Flag, label: 'Flagged', alert: totalFlagged > 0 },
              { id: 'shops' as ActiveTab, icon: Building, label: 'Manage' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-blue-50 font-semibold'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className={`w-5 h-5 mb-1 ${activeTab === tab.id ? 'scale-110' : ''}`} />
                <span className="text-xs font-medium">{tab.label}</span>
                {tab.alert && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* User Detail Sheet */}
      <Sheet open={userDetailOpen} onOpenChange={setUserDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedUser && (
            <div className="space-y-4 py-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedUser.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Badge variant={selectedUser.role === 'shopkeeper' ? 'default' : 'secondary'}>
                    {selectedUser.role}
                  </Badge>
                  {selectedUser.isFlagged && (
                    <Badge variant="destructive">
                      <Flag className="w-3 h-3 mr-1" />
                      Flagged
                    </Badge>
                  )}
                </div>
              </div>

              {/* Flag Info */}
              {selectedUser.isFlagged && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Reason: {selectedUser.flagReason}</p>
                    {selectedUser.flaggedAt && (
                      <p className="text-xs mt-1">
                        Flagged on {new Date(selectedUser.flaggedAt).toLocaleDateString()}
                        {selectedUser.flaggedByName && ` by ${selectedUser.flaggedByName}`}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Profile Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profile Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {selectedUser.mobileNumber && (
                    <div>
                      <p className="text-muted-foreground text-xs">Mobile</p>
                      <p className="font-medium">{selectedUser.mobileNumber}</p>
                    </div>
                  )}
                  {selectedUser.cardType && (
                    <div>
                      <p className="text-muted-foreground text-xs">Card Type</p>
                      <Badge className={getCardTypeColor(selectedUser.cardType)}>
                        {selectedUser.cardType}
                      </Badge>
                    </div>
                  )}
                  {selectedUser.rationCardNumber && (
                    <div>
                      <p className="text-muted-foreground text-xs">Ration Card</p>
                      <p className="font-medium">{selectedUser.rationCardNumber}</p>
                    </div>
                  )}
                  {selectedUser.familySize && (
                    <div>
                      <p className="text-muted-foreground text-xs">Family Size</p>
                      <p className="font-medium">{selectedUser.familySize} members</p>
                    </div>
                  )}
                  {selectedUser.address && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Address</p>
                      <p className="font-medium">{selectedUser.address}</p>
                    </div>
                  )}
                  {selectedUser.district && (
                    <div>
                      <p className="text-muted-foreground text-xs">District</p>
                      <p className="font-medium">{selectedUser.district}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shop Info */}
              {selectedUser.shopName && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Assigned Shop</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p className="font-medium">{selectedUser.shopName}</p>
                    {selectedUser.shopAddress && (
                      <p className="text-muted-foreground">{selectedUser.shopAddress}</p>
                    )}
                    {selectedUser.shopHours && (
                      <p className="text-muted-foreground text-xs">Hours: {selectedUser.shopHours}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Allocations (for cardholders) */}
              {selectedUser.role === 'cardholder' && selectedUser.allocations && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Monthly Quota</CardTitle>
                      {!editingAllocations ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingAllocations(true)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedUser.allocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No allocations found</p>
                    ) : (
                      selectedUser.allocations.map((alloc) => (
                        <div key={alloc.itemCode} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{alloc.itemCode}</span>
                            <Badge variant="outline">
                              {alloc.collectedQuantity}/{alloc.eligibleQuantity} kg
                            </Badge>
                          </div>
                          
                          {editingAllocations ? (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Eligible:</Label>
                              <Input
                                type="number"
                                value={alloc.eligibleQuantity}
                                onChange={(e) => updateAllocation(alloc.itemCode, Number(e.target.value))}
                                className="h-8"
                                min="0"
                                step="0.1"
                              />
                              <span className="text-xs">kg</span>
                            </div>
                          ) : (
                            <Progress 
                              value={(alloc.collectedQuantity / alloc.eligibleQuantity) * 100} 
                              className="h-2" 
                            />
                          )}
                        </div>
                      ))
                    )}
                    
                    {editingAllocations && (
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={saveAllocations}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          Save Changes
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingAllocations(false);
                            viewUserDetails(selectedUser.id);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedUser.role !== 'admin' && (
                    <>
                      {!selectedUser.isFlagged ? (
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => {
                            setUserDetailOpen(false);
                            openFlagModal(selectedUser);
                          }}
                        >
                          <Flag className="w-4 h-4 mr-2" />
                          Flag User
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            unflagUser(selectedUser);
                            setUserDetailOpen(false);
                          }}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Remove Flag
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1">
                {selectedUser.createdAt && (
                  <p>Registered: {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                )}
                {selectedUser.lastLogin && (
                  <p>Last Login: {new Date(selectedUser.lastLogin).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Flag Modal */}
      <Sheet open={flagModalOpen} onOpenChange={setFlagModalOpen}>
        <SheetContent side="bottom" className="h-auto">
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-red-600">
              <Flag className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Flag User</h2>
            </div>
            
            {userToFlag && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">{userToFlag.name}</p>
                <p className="text-sm text-muted-foreground">{userToFlag.email}</p>
              </div>
            )}

            <div>
              <Label>Reason for Flagging *</Label>
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              >
                <option value="">Select reason...</option>
                <option value="Duplicate ration card suspected">Duplicate ration card suspected</option>
                <option value="Identity mismatch">Identity mismatch</option>
                <option value="Fraudulent collection">Fraudulent collection</option>
                <option value="Deceased cardholder">Deceased cardholder</option>
                <option value="Migrated/Not found at address">Migrated/Not found at address</option>
                <option value="Suspicious activity detected">Suspicious activity detected</option>
                <option value="Complaint received">Complaint received</option>
                <option value="Other">Other (specify in notes)</option>
              </select>
            </div>

            {flagReason === 'Other' && (
              <div>
                <Label>Additional Notes</Label>
                <Input
                  placeholder="Enter details..."
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setFlagModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmFlag}
                disabled={!flagReason.trim()}
              >
                <Flag className="w-4 h-4 mr-2" />
                Confirm Flag
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
