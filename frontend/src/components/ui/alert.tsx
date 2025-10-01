import { cva } from 'class-variance-authority';
import * as React from 'react';

import { CrossSVG } from '@/assets/images';
import { cn } from '@/lib/utils';

import alertStyles from './alert.module.scss';
import { Button } from './button';

type Options = {
  type: 'info' | 'error' | 'loading' | 'success';
  variant?: 'alert' | 'notification';
  style?: React.CSSProperties;
  title?: string;
  timeout?: number;
  isClosed?: boolean;
};

type AlertType = {
  id: string;
  content: React.ReactNode;
  options: Options;
  footer?: React.ReactNode;
};

type Props = {
  alert: AlertType;
  close: () => void;
};

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      type: {
        info: 'bg-background text-foreground',
        error: 'bg-background border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        loading: 'bg-background text-foreground',
        success: 'bg-background text-foreground',
      },
    },
    defaultVariants: {
      type: 'info',
    },
  },
);

const Alert = ({ alert, close }: Props) => {
  const { content, footer, options } = alert;
  const { type, title } = options;

  return (
    <div role="alert" className={cn(alertVariants({ type }))}>
      <header className={cn('flex items-center justify-between')}>
        <h5 className={cn('mb-1 font-medium leading-none tracking-tight')}>{title || type}</h5>
        <Button variant="ghost" size="icon" onClick={close} className="button">
          <CrossSVG />
        </Button>
      </header>
      <div className={cn('text-sm [&_p]:leading-relaxed')}>{content}</div>
      {footer && <p className={cn('text-sm')}>{footer}</p>}
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { Alert, alertStyles };
