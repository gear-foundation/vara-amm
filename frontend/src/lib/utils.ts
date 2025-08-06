import { type AlertContainerFactory } from '@gear-js/react-hooks';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const prettyAddress = (address: string) => {
  return address.slice(0, 6) + '...' + address.slice(-4);
};

const copyToClipboard = ({
  alert,
  value,
  successfulText,
}: {
  alert?: AlertContainerFactory;
  value: string;
  successfulText?: string;
}) => {
  const onSuccess = () => {
    if (alert) {
      alert.success(successfulText || 'Copied');
    }
  };
  const onError = () => {
    if (alert) {
      alert.error('Copy error');
    }
  };

  function unsecuredCopyToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('Unable to copy to clipboard', err);
      onError();
    }
    document.body.removeChild(textArea);
  }

  if (window.isSecureContext && navigator.clipboard) {
    navigator.clipboard
      .writeText(value)
      .then(() => onSuccess())
      .catch(() => onError());
  } else {
    unsecuredCopyToClipboard(value);
  }
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error && typeof error.message === 'string') {
    const isPascalCaseWord = /^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(error.message);

    if (isPascalCaseWord) {
      const humanReadableMessage = error.message
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
      return humanReadableMessage;
    }

    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'docs' in error && typeof error.docs === 'string') {
    return error.docs;
  }

  return String(error) || 'Unknown error';
};

export { cn, copyToClipboard, prettyAddress, getErrorMessage };
