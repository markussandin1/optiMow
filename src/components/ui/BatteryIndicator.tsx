
export interface BatteryIndicatorProps {
  batteryPercent: number;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showIcon?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: 'text-xs',
    icon: 'w-4 h-4',
    bar: 'h-1.5',
    text: 'text-xs'
  },
  md: {
    container: 'text-sm',
    icon: 'w-5 h-5',
    bar: 'h-2',
    text: 'text-sm'
  },
  lg: {
    container: 'text-base',
    icon: 'w-6 h-6',
    bar: 'h-3',
    text: 'text-base'
  }
};

function getBatteryConfig(batteryPercent: number) {
  if (batteryPercent >= 75) {
    return {
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500',
      bgGradient: 'from-emerald-400 to-emerald-600',
      borderColor: 'border-emerald-200',
      backgroundColor: 'bg-emerald-50',
      level: 'excellent'
    };
  } else if (batteryPercent >= 50) {
    return {
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      bgGradient: 'from-green-400 to-green-600',
      borderColor: 'border-green-200',
      backgroundColor: 'bg-green-50',
      level: 'good'
    };
  } else if (batteryPercent >= 25) {
    return {
      color: 'text-amber-600',
      bgColor: 'bg-amber-500',
      bgGradient: 'from-amber-400 to-amber-600',
      borderColor: 'border-amber-200',
      backgroundColor: 'bg-amber-50',
      level: 'medium'
    };
  } else {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-500',
      bgGradient: 'from-red-400 to-red-600',
      borderColor: 'border-red-200',
      backgroundColor: 'bg-red-50',
      level: 'low'
    };
  }
}

function BatteryIcon({ batteryPercent, className }: { batteryPercent: number; className: string }) {
  const config = getBatteryConfig(batteryPercent);
  
  return (
    <div className={`relative ${className}`}>
      {/* Battery body */}
      <svg 
        className={`w-full h-full ${config.color}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <rect 
          x="3" 
          y="7" 
          width="16" 
          height="10" 
          rx="2" 
          strokeWidth="2" 
          fill="none"
        />
        <rect 
          x="20" 
          y="10" 
          width="1" 
          height="4" 
          rx="0.5" 
          fill="currentColor"
        />
      </svg>
      
      {/* Battery fill */}
      <div 
        className={`absolute top-1/2 left-1 transform -translate-y-1/2 h-2 rounded-sm bg-gradient-to-r ${config.bgGradient} transition-all duration-500`}
        style={{ width: `${Math.max(2, (batteryPercent / 100) * 14)}px` }}
      />
    </div>
  );
}

export function BatteryIndicator({ 
  batteryPercent, 
  size = 'md', 
  showPercentage = true, 
  showIcon = true,
  className = '' 
}: BatteryIndicatorProps) {
  const config = getBatteryConfig(batteryPercent);
  const sizeStyles = sizeConfig[size];

  return (
    <div className={`flex items-center gap-2 ${sizeStyles.container} ${className}`}>
      {showIcon && (
        <BatteryIcon 
          batteryPercent={batteryPercent} 
          className={sizeStyles.icon} 
        />
      )}
      
      {showPercentage && (
        <span className={`font-bold ${config.color} ${sizeStyles.text}`}>
          {batteryPercent}%
        </span>
      )}
    </div>
  );
}

export function BatteryProgressBar({ 
  batteryPercent, 
  size = 'md',
  showPercentage = true,
  className = '' 
}: BatteryIndicatorProps) {
  const config = getBatteryConfig(batteryPercent);
  const sizeStyles = sizeConfig[size];

  return (
    <div className={`space-y-2 ${className}`}>
      {showPercentage && (
        <div className="flex items-center justify-between">
          <span className={`font-medium text-gray-700 ${sizeStyles.text}`}>
            Battery Level
          </span>
          <span className={`font-bold ${config.color} ${sizeStyles.text}`}>
            {batteryPercent}%
          </span>
        </div>
      )}
      
      <div className={`w-full bg-gray-200 rounded-full ${sizeStyles.bar} overflow-hidden`}>
        <div 
          className={`${sizeStyles.bar} rounded-full bg-gradient-to-r ${config.bgGradient} transition-all duration-700 ease-out shadow-sm`}
          style={{ width: `${batteryPercent}%` }}
        />
      </div>
    </div>
  );
}

export function BatteryCard({ 
  batteryPercent, 
  size = 'md',
  className = '' 
}: BatteryIndicatorProps) {
  const config = getBatteryConfig(batteryPercent);
  const sizeStyles = sizeConfig[size];

  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border
      ${config.backgroundColor} ${config.borderColor}
      ${className}
    `}>
      <div className="flex items-center gap-2">
        <BatteryIcon 
          batteryPercent={batteryPercent} 
          className={sizeStyles.icon} 
        />
        <span className={`font-medium text-gray-700 ${sizeStyles.text}`}>
          Battery
        </span>
      </div>
      
      <span className={`font-bold ${config.color} ${sizeStyles.text}`}>
        {batteryPercent}%
      </span>
    </div>
  );
}