
interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  const style = {
    ...(width && { width }),
    ...(height && { height })
  };

  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
      style={style}
    />
  );
}

export function MowerCardSkeleton() {
  return (
    <div className="p-6 border border-gray-200 bg-white rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Battery Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-20" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-8" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Mode Section */}
      <div className="mb-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Work Areas */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>

      {/* Last seen */}
      <div className="flex items-center justify-between pt-2 mt-4 border-t border-gray-200">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function DashboardHeaderSkeleton() {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function MowerDetailsSkeleton() {
  return (
    <div className="mt-8 bg-white shadow-lg border border-gray-200 overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-32 mb-2 bg-white/20" />
            <Skeleton className="h-4 w-48 bg-white/20" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-gray-50 p-4 rounded-xl">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-orange-600 ${sizeClasses[size]} ${className}`} />
  );
}