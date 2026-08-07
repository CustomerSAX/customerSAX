import { cn } from '../../utils';
import { Icon, IconSize } from '../../icons/Icon';

export interface LoadingSpinnerProps {
  size?: IconSize;
  color?: 'primary' | 'muted' | 'white' | 'current';
  label?: string;
  className?: string;
}

const colorStyles: Record<NonNullable<LoadingSpinnerProps['color']>, string> = {
  primary: 'text-m-primary',
  muted: 'text-m-text-muted',
  white: 'text-white',
  current: 'text-current',
};

export function LoadingSpinner({
  size = 'md',
  color = 'primary',
  label = 'Loading...',
  className,
}: LoadingSpinnerProps) {
  return (
    <div role="status" className="inline-flex items-center justify-center">
      <Icon
        name="loader-2"
        size={size}
        className={cn('animate-spin', colorStyles[color], className)}
        ariaLabel={label}
      />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
