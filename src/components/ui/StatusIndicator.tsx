
export interface StatusIndicatorProps {
  activity: string;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const activityConfig = {
  MOWING: {
    label: 'Mowing',
    icon: (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
      </svg>
    ),
    colors: 'bg-emerald-500 text-white border-emerald-600',
    bgGradient: 'bg-gradient-to-r from-emerald-500 to-green-500',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    pulseColor: 'animate-pulse'
  },
  CHARGING: {
    label: 'Charging',
    icon: (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.5 11L14 9.5H12.5L13 11H14.5M9 2V4H15V2H9M11 19H13V16.5H11V19M15.67 4H14V6H10V4H8.33C7.6 4 7 4.6 7 5.33V20.67C7 21.4 7.6 22 8.33 22H15.67C16.4 22 17 21.4 17 20.67V5.33C17 4.6 16.4 4 15.67 4Z" />
      </svg>
    ),
    colors: 'bg-blue-500 text-white border-blue-600',
    bgGradient: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    pulseColor: 'animate-pulse'
  },
  PARKED_IN_CS: {
    label: 'Parked',
    icon: (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 6H21V18H3V6M5 8V16H19V8H5M7 10H9V14H7V10M11 10H13V14H11V10M15 10H17V14H15V10Z" />
      </svg>
    ),
    colors: 'bg-slate-500 text-white border-slate-600',
    bgGradient: 'bg-gradient-to-r from-slate-500 to-gray-500',
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    pulseColor: ''
  },
  GOING_HOME: {
    label: 'Going Home',
    icon: (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" />
      </svg>
    ),
    colors: 'bg-amber-500 text-white border-amber-600',
    bgGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    pulseColor: 'animate-pulse'
  },
  LEAVING: {
    label: 'Leaving',
    icon: (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 12H5L12 5V8H15V10H12V12L19 12M12 19L5 12H8V10H11V8L12 19Z" />
      </svg>
    ),
    colors: 'bg-purple-500 text-white border-purple-600',
    bgGradient: 'bg-gradient-to-r from-purple-500 to-violet-500',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    pulseColor: 'animate-pulse'
  },
  STOPPED_IN_GARDEN: {
    label: 'Stopped',
    icon: (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2A10 10 0 0 0 2 12A10 10 0 0 0 12 22A10 10 0 0 0 22 12A10 10 0 0 0 12 2M12 4A8 8 0 0 1 20 12A8 8 0 0 1 12 20A8 8 0 0 1 4 12A8 8 0 0 1 12 4M11 16V18H13V16H11M11 6V14H13V6H11Z" />
      </svg>
    ),
    colors: 'bg-red-500 text-white border-red-600',
    bgGradient: 'bg-gradient-to-r from-red-500 to-rose-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    pulseColor: ''
  }
};

const sizeConfig = {
  sm: {
    container: 'px-2 py-1 text-xs',
    icon: 'w-3 h-3',
    gap: 'gap-1'
  },
  md: {
    container: 'px-3 py-1.5 text-sm',
    icon: 'w-4 h-4',
    gap: 'gap-2'
  },
  lg: {
    container: 'px-4 py-2 text-base',
    icon: 'w-5 h-5',
    gap: 'gap-2'
  }
};

export function StatusIndicator({ 
  activity, 
  className = '', 
  showText = true, 
  size = 'md' 
}: StatusIndicatorProps) {
  const config = activityConfig[activity as keyof typeof activityConfig] || activityConfig.STOPPED_IN_GARDEN;
  const sizeStyles = sizeConfig[size];

  return (
    <div 
      className={`
        inline-flex items-center justify-center rounded-full font-semibold
        ${config.colors} ${sizeStyles.container} ${sizeStyles.gap}
        ${config.pulseColor}
        shadow-sm border
        ${className}
      `}
    >
      <div className={sizeStyles.icon}>
        {config.icon}
      </div>
      {showText && (
        <span className="whitespace-nowrap font-bold tracking-wide">
          {config.label}
        </span>
      )}
    </div>
  );
}

export function StatusBadge({ 
  activity, 
  className = '', 
  size = 'md' 
}: StatusIndicatorProps) {
  const config = activityConfig[activity as keyof typeof activityConfig] || activityConfig.STOPPED_IN_GARDEN;
  const sizeStyles = sizeConfig[size];

  return (
    <div 
      className={`
        inline-flex items-center justify-center rounded-lg font-semibold border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${sizeStyles.container} ${sizeStyles.gap}
        ${className}
      `}
    >
      <div className={`${sizeStyles.icon} ${config.textColor}`}>
        {config.icon}
      </div>
      <span className="whitespace-nowrap font-bold">
        {config.label}
      </span>
    </div>
  );
}