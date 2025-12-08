/**
 * Protection Button Component
 * Button to trigger protection with loading state
 */

import { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts';

interface ProtectionButtonProps {
  riskScore: number;
  onProtect: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProtectionButton({
  riskScore,
  onProtect,
  disabled,
  loading,
  size = 'md',
}: ProtectionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleProtect = async () => {
    try {
      await onProtect();
      // Note: Actual transaction signature should be passed from onProtect
      showSuccess('Protection Activated', 'Your position is now protected');
    } catch (error) {
      showError('Protection Failed', error instanceof Error ? error.message : 'Failed to activate protection');
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Determine button color based on risk score
  const getButtonColor = () => {
    if (disabled) return 'bg-gray-600 cursor-not-allowed';
    if (riskScore >= 80) return 'bg-red-600 hover:bg-red-700';
    if (riskScore >= 60) return 'bg-orange-600 hover:bg-orange-700';
    return 'bg-blue-600 hover:bg-blue-700';
  };

  const getButtonText = () => {
    if (loading) return 'Protecting...';
    if (riskScore >= 80) return 'Protect Now!';
    if (riskScore >= 60) return 'Protect Position';
    return 'Get Protection Quote';
  };

  return (
    <button
      onClick={handleProtect}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        ${sizeClasses[size]}
        ${getButtonColor()}
        flex items-center justify-center gap-2
        rounded-lg font-medium
        transition-all duration-200
        ${isHovered && !disabled ? 'scale-105 shadow-lg' : ''}
        ${riskScore >= 80 && !disabled ? 'animate-pulse' : ''}
      `}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <Shield className={iconSizes[size]} />
      )}
      {getButtonText()}
    </button>
  );
}

/**
 * Compact protection button for cards
 */
export function ProtectionButtonCompact({
  onProtect,
  disabled,
  loading,
}: {
  onProtect: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onProtect();
      }}
      disabled={disabled || loading}
      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
      title="Protect Position"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Shield className="w-4 h-4" />
      )}
    </button>
  );
}
