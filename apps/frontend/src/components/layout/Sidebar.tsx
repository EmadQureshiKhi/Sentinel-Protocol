import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Settings, Bell, FlaskConical, Shield } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/test', icon: FlaskConical, label: 'Test Prediction' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/privacy', icon: Shield, label: 'Privacy' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-shield-50 text-shield-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Alert summary */}
      <div className="p-4 mt-4 border-t border-slate-200">
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <Bell className="w-4 h-4" />
            <span className="font-medium text-sm">Active Alerts</span>
          </div>
          <p className="text-2xl font-bold text-red-700">0</p>
          <p className="text-xs text-red-500 mt-1">No critical alerts</p>
        </div>
      </div>
    </aside>
  );
}
