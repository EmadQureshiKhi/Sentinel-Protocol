import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Shield } from 'lucide-react';

export default function Header() {
  const network = import.meta.env.VITE_NETWORK || 'devnet';

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-shield-500 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Liquidation Shield</h1>
            <p className="text-xs text-slate-500">MEV-Protected DeFi</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Network badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            network === 'mainnet' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {network === 'mainnet' ? 'Mainnet' : 'Devnet'}
          </div>

          {/* Wallet button */}
          <WalletMultiButton className="!bg-shield-500 hover:!bg-shield-600" />
        </div>
      </div>
    </header>
  );
}
