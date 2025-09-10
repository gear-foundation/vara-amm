import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Mobile-friendly tooltip component that supports both hover and click
interface MobileTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  contentClassName?: string;
  delayDuration?: number;
}

const MobileTooltip = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Trigger>, MobileTooltipProps>(
  ({ content, children, side = 'top', className, contentClassName, delayDuration = 200 }, ref) => {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Handle click outside to close tooltip on mobile
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent | TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      if (open) {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }, [open]);

    return (
      <div ref={containerRef} className="relative">
        <TooltipProvider delayDuration={delayDuration}>
          <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger
              ref={ref}
              asChild
              className={className}
              onClick={(e) => {
                e.preventDefault();
                setOpen(!open);
              }}>
              {children}
            </TooltipTrigger>
            <TooltipContent side={side} className={cn('bg-gray-900 text-white border-gray-700', contentClassName)}>
              {content}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  },
);

MobileTooltip.displayName = 'MobileTooltip';

export { MobileTooltip as Tooltip };
