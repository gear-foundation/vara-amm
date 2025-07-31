import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const loaderVariants = cva(
  'animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      variant: {
        default: 'text-primary',
        secondary: 'text-secondary-foreground',
        muted: 'text-muted-foreground',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
);

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof loaderVariants> {
  text?: string;
}

const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(({ className, size, variant, text, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('flex items-center justify-center gap-2', className)} {...props}>
      <div className={cn(loaderVariants({ size, variant }))} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
});
Loader.displayName = 'Loader';

export { Loader, loaderVariants };
