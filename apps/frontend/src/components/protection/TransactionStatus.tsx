/**
 * Transaction Status Component
 * Step indicator for protection transaction flow
 */

import { Check, Loader2, X, AlertCircle } from 'lucide-react';

type TransactionStep = 'quote' | 'build' | 'simulate' | 'submit' | 'confirm';
type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

interface TransactionStatusProps {
  currentStep: TransactionStep;
  status: 'idle' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  transactionSignature?: string;
  bundleId?: string;
}

const STEPS: { key: TransactionStep; label: string }[] = [
  { key: 'quote', label: 'Get Quote' },
  { key: 'build', label: 'Build TX' },
  { key: 'simulate', label: 'Simulate' },
  { key: 'submit', label: 'Submit' },
  { key: 'confirm', label: 'Confirm' },
];

function getStepStatus(
  stepKey: TransactionStep,
  currentStep: TransactionStep,
  status: string
): StepStatus {
  const stepIndex = STEPS.findIndex((s) => s.key === stepKey);
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  if (status === 'error' && stepIndex === currentIndex) return 'failed';
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex && status === 'processing') return 'active';
  if (stepIndex === currentIndex && status === 'success') return 'completed';
  return 'pending';
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
          <Check className="w-5 h-5 text-white" />
        </div>
      );
    case 'active':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
        </div>
      );
  }
}

export default function TransactionStatus({
  currentStep,
  status,
  errorMessage,
  transactionSignature,
  bundleId,
}: TransactionStatusProps) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-6">Transaction Progress</h3>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step.key, currentStep, status);
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <StepIcon status={stepStatus} />
                <span
                  className={`text-xs mt-2 ${
                    stepStatus === 'completed'
                      ? 'text-green-400'
                      : stepStatus === 'active'
                      ? 'text-blue-400'
                      : stepStatus === 'failed'
                      ? 'text-red-400'
                      : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    getStepStatus(STEPS[index + 1].key, currentStep, status) !== 'pending'
                      ? 'bg-green-600'
                      : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      {status === 'processing' && (
        <div className="flex items-center gap-2 text-blue-400 bg-blue-900/30 rounded-lg p-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing transaction...</span>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-400 bg-green-900/30 rounded-lg p-3">
            <Check className="w-5 h-5" />
            <span>Transaction confirmed successfully!</span>
          </div>
          
          {transactionSignature && (
            <div className="text-sm">
              <span className="text-gray-400">Transaction: </span>
              <a
                href={`https://solscan.io/tx/${transactionSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline font-mono"
              >
                {transactionSignature.slice(0, 8)}...{transactionSignature.slice(-8)}
              </a>
            </div>
          )}
          
          {bundleId && (
            <div className="text-sm">
              <span className="text-gray-400">Jito Bundle: </span>
              <span className="font-mono text-gray-300">
                {bundleId.slice(0, 8)}...{bundleId.slice(-8)}
              </span>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 text-red-400 bg-red-900/30 rounded-lg p-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Transaction failed</div>
            {errorMessage && <div className="text-sm text-red-300 mt-1">{errorMessage}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
