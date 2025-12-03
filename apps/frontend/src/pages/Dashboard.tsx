import { Shield, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500">Monitor your DeFi positions and protect from liquidation</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Shield}
          label="Accounts Monitored"
          value="0"
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="At Risk"
          value="0"
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          label="Value Protected"
          value="$0"
          color="green"
        />
        <StatCard
          icon={DollarSign}
          label="MEV Saved"
          value="$0"
          color="purple"
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Monitored Accounts</h3>
          
          <div className="text-center py-12 text-slate-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium">No accounts monitored yet</p>
            <p className="text-sm mt-1">Add a wallet address to start monitoring</p>
            <button className="mt-4 px-4 py-2 bg-shield-500 text-white rounded-lg hover:bg-shield-600 transition-colors">
              Add Account
            </button>
          </div>
        </div>

        {/* Alert feed */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Alerts</h3>
          
          <div className="text-center py-8 text-slate-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No alerts yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  color: 'blue' | 'red' | 'green' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
