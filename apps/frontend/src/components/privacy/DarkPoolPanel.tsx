/**
 * Dark Pool Panel Component
 * Interface for submitting and managing dark pool orders - Black & Yellow theme
 */

import React, { useState } from 'react';
import { useDarkPool } from '../../hooks/usePrivacy';

interface DarkPoolPanelProps {
  walletAddress: string | null;
}

export const DarkPoolPanel: React.FC<DarkPoolPanelProps> = ({ walletAddress }) => {
  const { orders, loading, error, submitOrder, cancelOrder, refresh } = useDarkPool(walletAddress);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    side: 'buy' as 'buy' | 'sell',
    token: 'SOL',
    amount: '',
    price: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.price) return;

    await submitOrder({
      side: formData.side,
      token: formData.token,
      amount: parseFloat(formData.amount),
      price: parseFloat(formData.price),
      expiresIn: 3600000,
    });

    setFormData({ side: 'buy', token: 'SOL', amount: '', price: '' });
    setShowForm(false);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--clr-primary)';
      case 'matched': return 'var(--status-info)';
      case 'executed': return 'var(--status-success)';
      case 'cancelled': return 'var(--text-tertiary)';
      default: return 'var(--text-tertiary)';
    }
  };

  if (!walletAddress) {
    return (
      <div className="rounded-lg p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--clr-primary)' }}>Dark Pool</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Connect wallet to access dark pool trading</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
          Dark Pool
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="transition-colors p-1" style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm px-3 py-1.5 rounded-lg transition-colors font-medium"
            style={{ background: 'var(--clr-primary)', color: '#000000' }}
          >
            {showForm ? 'Cancel' : 'New Order'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg p-4 mb-4" style={{ background: 'var(--bg-hover)' }}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Side</label>
              <select
                value={formData.side}
                onChange={(e) => setFormData({ ...formData, side: e.target.value as 'buy' | 'sell' })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Token</label>
              <select
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="SOL">SOL</option>
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Amount</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Price (USD)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !formData.amount || !formData.price}
            className="w-full py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--clr-primary)', color: 'var(--bg-primary)' }}
          >
            {loading ? 'Submitting...' : 'Submit Private Order'}
          </button>
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
            Orders are encrypted and matched privately via MXE
          </p>
        </form>
      )}

      <div className="space-y-2">
        {orders.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No active orders</p>
        ) : (
          orders.map((order) => (
            <div
              key={order.orderId}
              className="rounded-lg p-3 flex items-center justify-between"
              style={{ background: 'var(--bg-hover)' }}
            >
              <div>
                <p className="text-sm font-mono truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
                  {order.orderId.slice(0, 8)}...
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Created {formatTime(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: getStatusColor(order.status) }}>
                  {order.status}
                </span>
                {order.status === 'pending' && (
                  <button
                    onClick={() => cancelOrder(order.orderId)}
                    className="text-xs"
                    style={{ color: '#ef4444' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DarkPoolPanel;
