import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Progress } from './ui/progress';
import {
  Package,
  Bell,
  BarChart3,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  Menu,
  Minus,
  RefreshCw,
  User,
  Edit,
  Save,
  X,
  History
} from 'lucide-react';
import {
  getShopkeeperCustomers,
  getCustomerQuota,
  updateCustomerQuota,
  getQuotaChangeHistory,
  ShopkeeperCustomer,
  CustomerQuota,
  QuotaChangeLog
} from '../lib/api';

interface MobileShopkeeperDashboardProps {
  userData: any;
  onLogout: () => void;
}

interface StockItem {
  id: string;
  name: string;
  hindiName: string;
  quantity: number;
  unit: string;
  lastRestocked: string;
  lowStock: boolean;
}

interface QuotaItem {
  code: string;
  name: string;
  hindiName: string;
  eligibleQuantity: number;
  collectedQuantity: number;
  unit: string;
}

export function MobileShopkeeperDashboard({ userData, onLogout }: MobileShopkeeperDashboardProps) {
  const [activeTab, setActiveTab] = useState('stock');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_BASE = 'http://localhost:5000/api';

  // Quota Management State
  const [customers, setCustomers] = useState<ShopkeeperCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<ShopkeeperCustomer | null>(null);
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');
  const [history, setHistory] = useState<QuotaChangeLog[]>([]);

  const [notifications, setNotifications] = useState([
    { id: 1, message: 'Wheat stock is running low', type: 'warning', sent: false },
    { id: 2, message: 'New rice stock added - 150kg', type: 'success', sent: true },
  ]);

  const [customNotification, setCustomNotification] = useState({
    category: 'all',
    type: 'stock',
    message: ''
  });

  const [tokens, setTokens] = useState([
    // Will be populated from API
  ]);
  const [selectedCardType, setSelectedCardType] = useState<'AAY' | 'PHH' | 'BPL' | 'APL'>('BPL');

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const shopId = userData?.shopId || 'SHOP001';

  // Item details mapping
  const itemDetails: Record<string, { name: string; hindiName: string; unit: string }> = {
    rice: { name: 'Rice', hindiName: 'चावल', unit: 'kg' },
    wheat: { name: 'Wheat', hindiName: 'गेहूं', unit: 'kg' },
    sugar: { name: 'Sugar', hindiName: 'चीनी', unit: 'kg' },
    kerosene: { name: 'Kerosene', hindiName: 'मिट्टी का तेल', unit: 'L' }
  };

  // ==================== STOCK MANAGEMENT ====================
  const fetchStock = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/stocks?shopId=${encodeURIComponent(shopId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load stock');
      const mapped: StockItem[] = (data.data || []).map((r: any) => {
        const code = r.code?.toLowerCase() || '';
        const details = itemDetails[code];
        return {
          id: r.code,
          name: details?.name || r.name,
          hindiName: details?.hindiName || '',
          quantity: Number(r.quantity),
          unit: details?.unit || r.unit,
          lastRestocked: r.lastRestocked || '-',
          lowStock: Number(r.quantity) < 50
        };
      });
      setStock(mapped);
    } catch (e: any) {
      setError(e.message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (itemId: string, change: number) => {
    try {
      setLoading(true);
      setError(null);
      const currentItem = stock.find(item => item.id === itemId);
      if (!currentItem) throw new Error('Item not found');
      const newQty = Math.max(0, currentItem.quantity + change);

      const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: newQty, shopId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update');

      const updatedItem = data.data;
      setStock(prev => prev.map(item => item.id === itemId ? {
        ...item,
        quantity: Number(updatedItem.quantity),
        lastRestocked: updatedItem.updatedAt || new Date().toLocaleString(),
        lowStock: Number(updatedItem.quantity) < 50
      } : item));
    } catch (e: any) {
      setError(e.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  // ==================== NOTIFICATIONS ====================
  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setNotifications(data.map((n: any) => ({
          id: n.id,
          message: n.message,
          type: n.type,
          sent: n.isSent
        })));
      }
    } catch { }
  };

  const sendNotification = async (notificationId: number) => {
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isSent: true })
      });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, sent: true } : n));
    } catch { }
  };

  const sendCustomNotification = async () => {
    if (!customNotification.message.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shopId,
          type: customNotification.type,
          message: `[${customNotification.category}] ${customNotification.message}`,
          category: customNotification.category
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(prev => [{
          id: data.id,
          message: `[${customNotification.category}] ${customNotification.message}`,
          type: customNotification.type,
          sent: true
        }, ...prev]);
        setCustomNotification({ category: 'all', type: 'stock', message: '' });
        alert(`Notification sent to ${customNotification.category === 'all' ? 'all users' : customNotification.category + ' cardholders'}`);
      }
    } catch (e) {
      alert('Failed to send notification');
    }
  };

  // ==================== QUOTA MANAGEMENT ====================
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await getShopkeeperCustomers(shopId);
      setCustomers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = async (customerId: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setSelectedCustomer(customer);
    await fetchCustomerQuota(customerId);
    await fetchQuotaHistory(customerId);
  };

  const fetchCustomerQuota = async (userId: number) => {
    try {
      setLoading(true);
      const data = await getCustomerQuota(userId);
      
      const mappedQuotas: QuotaItem[] = data.map(q => ({
        code: q.itemCode,
        name: itemDetails[q.itemCode]?.name || q.itemCode,
        hindiName: itemDetails[q.itemCode]?.hindiName || '',
        eligibleQuantity: q.eligibleQuantity,
        collectedQuantity: q.collectedQuantity,
        unit: itemDetails[q.itemCode]?.unit || 'kg'
      }));

      setQuotas(mappedQuotas);
    } catch (err: any) {
      setError(err.message || 'Failed to load quota');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotaHistory = async (userId: number) => {
    try {
      const data = await getQuotaChangeHistory(userId);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const startEdit = (itemCode: string, currentCollected: number) => {
    setEditingItem(itemCode);
    setNewQuantity(0); // Amount to distribute now
    setEditReason('');
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setNewQuantity(0);
    setEditReason('');
  };

  const saveQuota = async (itemCode: string) => {
    if (!selectedCustomer) return;

    const quota = quotas.find(q => q.code === itemCode);
    if (!quota) return;

    const remaining = quota.eligibleQuantity - quota.collectedQuantity;
    if (newQuantity <= 0) {
      alert('Please enter a valid quantity to distribute');
      return;
    }
    if (newQuantity > remaining) {
      alert(`Cannot distribute more than remaining quota (${remaining} ${quota.unit})`);
      return;
    }

    const updatedCollected = quota.collectedQuantity + newQuantity;

    try {
      setLoading(true);
      await updateCustomerQuota(
        selectedCustomer.id,
        itemCode,
        updatedCollected,
        editReason || `Distributed ${newQuantity} ${quota.unit}`
      );

      await fetchCustomerQuota(selectedCustomer.id);
      await fetchQuotaHistory(selectedCustomer.id);
      
      cancelEdit();
      alert(`✅ Distributed ${newQuantity} ${quota.unit} of ${quota.name} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  // Quick distribute - add amount to collected quantity
  const quickDistribute = async (itemCode: string, amount: number, currentCollected: number) => {
    if (!selectedCustomer) return;

    const quota = quotas.find(q => q.code === itemCode);
    if (!quota) return;

    const newTotal = quota.eligibleQuantity; // Collect ALL - set to full quota

    console.log(`📦 Collecting all ${itemCode}: ${currentCollected} → ${newTotal}`);

    // Immediately update UI (optimistic update)
    setQuotas(prev => prev.map(q => 
      q.code === itemCode 
        ? { ...q, collectedQuantity: newTotal }
        : q
    ));

    try {
      setLoading(true);
      await updateCustomerQuota(
        selectedCustomer.id,
        itemCode,
        newTotal,
        `Collected full quota: ${newTotal} ${quota.unit}`
      );
      
      // Show success popup
      alert(`✅ Quota Updated!\n\n${quota.name}: ${newTotal}/${quota.eligibleQuantity} ${quota.unit}\n\nCustomer: ${selectedCustomer.name}`);
      
    } catch (err: any) {
      console.error('❌ Distribution failed:', err);
      // Revert on error
      setQuotas(prev => prev.map(q => 
        q.code === itemCode 
          ? { ...q, collectedQuantity: currentCollected }
          : q
      ));
      alert(err.message || 'Failed to update. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (collected: number, eligible: number) => {
    if (eligible === 0) return 0;
    return Math.min((collected / eligible) * 100, 100);
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchStock();
    if (activeTab === 'quota') {
      fetchCustomers();
    }
    if (activeTab === 'tokens') {
      fetchTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ==================== TOKENS (API) ====================
  const fetchTokens = async () => {
    try {
      const res = await fetch(`${API_BASE}/tokens?shopId=${encodeURIComponent(shopId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTokens(
          data.map((t: any) => ({
            id: t.id,
            cardHolder: t.name || t.email || 'Cardholder',
            category: t.cardType || '-',
            timeSlot: t.timeslot || t.time_slot || '-:-',
            status: t.status || 'pending'
          }))
        );
      }
    } catch (e) {
      // leave tokens as-is on error
    }
  };

  const broadcastCardTypeTokens = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/broadcast/card-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardType: selectedCardType, intervalMinutes: 15 })
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        alert(`✅ Created ${data.created} tokens and notified ${data.recipients} ${selectedCardType} cardholders.`);
        fetchTokens();
      } else {
        alert(data?.error || 'Failed to broadcast');
      }
    } catch (e) {
      alert('Failed to broadcast');
    }
  };

  // ==================== RENDER FUNCTIONS ====================
  const renderContent = () => {
    switch (activeTab) {
      case 'stock':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Stock Management</h2>
              <Button variant="outline" size="sm" onClick={fetchStock} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {stock.map(item => (
              <Card key={item.id} className={item.lowStock ? 'border-orange-200 bg-orange-50' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.hindiName}</p>
                    </div>
                    {item.lowStock && (
                      <Badge variant="destructive" className="text-xs">
                        Low Stock
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xl font-bold">{item.quantity} {item.unit}</p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {item.lastRestocked}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStock(item.id, -10)}
                        disabled={item.quantity < 10 || loading}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStock(item.id, 25)}
                        disabled={loading}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Notifications</h2>

            {/* Custom Notification Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Send Custom Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm">Card Category (NFSA 2013)</Label>
                  <select
                    className="w-full border rounded-md p-2 mt-1"
                    value={customNotification.category}
                    onChange={(e) => setCustomNotification({ ...customNotification, category: e.target.value })}
                  >
                    <option value="all">All Cardholders</option>
                    <option value="AAY">AAY - Antyodaya Anna Yojana (Poorest of Poor)</option>
                    <option value="PHH">PHH - Priority Household (Below Poverty Line)</option>
                    <option value="BPL">BPL - Below Poverty Line (Legacy)</option>
                    <option value="APL">APL - Above Poverty Line (Discontinued)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-sm">Notification Type</Label>
                  <select
                    className="w-full border rounded-md p-2 mt-1"
                    value={customNotification.type}
                    onChange={(e) => setCustomNotification({ ...customNotification, type: e.target.value })}
                  >
                    <option value="stock">Stock Update</option>
                    <option value="alert">Alert/Warning</option>
                    <option value="system">System Message</option>
                  </select>
                </div>

                <div>
                  <Label className="text-sm">Message</Label>
                  <textarea
                    className="w-full border rounded-md p-2 mt-1 min-h-[80px]"
                    placeholder="Enter notification message..."
                    value={customNotification.message}
                    onChange={(e) => setCustomNotification({ ...customNotification, message: e.target.value })}
                  />
                </div>

                <Button
                  onClick={sendCustomNotification}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={!customNotification.message.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send to {customNotification.category === 'all' ? 'All Users' : customNotification.category + ' Cardholders'}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-medium">Recent Notifications</h3>
              {notifications.map(notif => (
                <Alert key={notif.id} className={notif.type === 'warning' ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm">{notif.message}</p>
                      </div>
                      <div className="ml-2">
                        {notif.sent ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => sendNotification(notif.id)}>
                            Send
                          </Button>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        );

      case 'tokens':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Active Tokens</h2>

            {/* Create tokens + notify by Card Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Tokens & Notify</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm">Card Type</Label>
                  <select
                    className="w-full border rounded-md p-2 mt-1"
                    value={selectedCardType}
                    onChange={(e) => setSelectedCardType(e.target.value as any)}
                  >
                    <option value="AAY">AAY</option>
                    <option value="PHH">PHH</option>
                    <option value="BPL">BPL</option>
                    <option value="APL">APL</option>
                  </select>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={broadcastCardTypeTokens}>
                  <Send className="w-4 h-4 mr-2" />
                  Create tokens and notify
                </Button>
              </CardContent>
            </Card>

            {tokens.map(tkn => (
              <Card key={tkn.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-medium">{tkn.id}</span>
                    <Badge
                      variant={
                        tkn.status === 'completed' ? 'default' :
                          tkn.status === 'active' ? 'destructive' : 'secondary'
                      }
                    >
                      {tkn.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Card Holder</span>
                      <Badge variant={tkn.category === 'BPL' ? 'default' : 'secondary'} className="text-xs">
                        {tkn.category}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{tkn.cardHolder}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {tkn.timeSlot}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'quota':
        return (
          <div className="space-y-4">
            {/* Customer Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Select Customer</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Label className="text-sm">Customer (Name + Ration Card)</Label>
                <select
                  className="w-full border rounded-md p-2 mt-1"
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => handleCustomerSelect(Number(e.target.value))}
                  disabled={loading}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.rationCardNumber} ({customer.cardType})
                    </option>
                  ))}
                </select>

                {selectedCustomer && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Card Type:</span>
                      <Badge>{selectedCustomer.cardType}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Family Size:</span>
                      <span className="font-medium">{selectedCustomer.familySize}</span>
                    </div>
                    {selectedCustomer.mobileNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Mobile:</span>
                        <span className="font-medium">{selectedCustomer.mobileNumber}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Quota */}
            {selectedCustomer && quotas.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Monthly Quota</h2>
                  <span className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </span>
                </div>

                {quotas.map(item => (
                  <Card key={item.code}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{item.hindiName}</p>
                        </div>
                        <Badge 
                          variant={item.collectedQuantity >= item.eligibleQuantity ? "default" : "outline"} 
                          className={`text-lg font-semibold ${item.collectedQuantity >= item.eligibleQuantity ? 'bg-green-600' : ''}`}
                        >
                          {item.collectedQuantity}/{item.eligibleQuantity} {item.unit}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Collect All Button */}
                      {item.collectedQuantity < item.eligibleQuantity ? (
                        <Button
                          variant="default"
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={loading}
                          onClick={() => quickDistribute(item.code, item.eligibleQuantity - item.collectedQuantity, item.collectedQuantity)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Collect All ({(item.eligibleQuantity - item.collectedQuantity).toFixed(1)} {item.unit})
                        </Button>
                      ) : (
                        <div className="p-3 bg-green-100 rounded-lg text-center">
                          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                          <p className="text-sm font-medium text-green-800">Fully Collected</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Change History */}
            {selectedCustomer && history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Quota Change History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {history.map(log => (
                    <div key={log.id} className="p-3 border rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{log.itemCode}</span>
                        <Badge variant={log.changeAmount > 0 ? 'default' : 'secondary'}>
                          {log.changeAmount > 0 ? '+' : ''}{log.changeAmount} kg
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>{log.oldQuantity} kg → {log.newQuantity} kg</div>
                        <div>By: {log.changedByName} ({log.changedByRole})</div>
                        {log.reason && <div>Reason: {log.reason}</div>}
                        <div>{new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!selectedCustomer && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a customer to view and manage their monthly quota</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Today's Analytics</h2>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold mb-1">45</div>
                  <p className="text-sm text-muted-foreground">Families Served</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold mb-1">450kg</div>
                  <p className="text-sm text-muted-foreground">Total Distributed</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold mb-1">28</div>
                  <p className="text-sm text-muted-foreground">BPL Families</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold mb-1">17</div>
                  <p className="text-sm text-muted-foreground">APL Families</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stock.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span className="text-sm">{item.name}</span>
                      <span className={`text-sm font-medium ${item.lowStock ? 'text-red-600' : 'text-green-600'}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-600 text-white sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Shopkeeper Dashboard</h1>
            <p className="text-green-100 text-sm truncate">{userData.shopName || userData.name || 'Ration Shop'}</p>
          </div>

          {/* Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Shop Details</h3>
                  <p className="text-sm text-muted-foreground">{userData.shopName}</p>
                  <p className="text-sm text-muted-foreground">ID: {shopId}</p>
                  <p className="text-sm text-muted-foreground">District: {userData.district}</p>
                </div>

                <hr />

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Shopkeeper Access:</strong> Stock, Alerts, Tokens, Reports, Quota Management
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    For User Management, login as Admin
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
        <div className="p-4 space-y-4">
          {renderContent()}
        </div>
      </div>

      {/* Bottom Navigation - NO USERS TAB */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-screen-xl mx-auto px-2">
          <div className="flex justify-around items-center h-16">
            {[
              { id: 'stock', icon: Package, label: 'Stock' },
              { id: 'notifications', icon: Bell, label: 'Alerts' },
              { id: 'quota', icon: User, label: 'Quota' },
              { id: 'tokens', icon: Clock, label: 'Tokens' },
              { id: 'analytics', icon: BarChart3, label: 'Reports' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] ${
                  activeTab === tab.id
                    ? 'text-amber-600 bg-amber-50 font-semibold'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className={`w-5 h-5 mb-1 ${activeTab === tab.id ? 'scale-110' : ''}`} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

export default MobileShopkeeperDashboard;
