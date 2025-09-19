type TokenCustomIconProps = {
  symbol: string;
  className?: string;
};

const TokenCustomIcon = ({ symbol, className = 'w-10 h-10 rounded-full' }: TokenCustomIconProps) => {
  const initials = symbol.slice(0, 2).toUpperCase();

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="32" height="32" fill="#00FF85" rx="16" />
      <text x="16" y="20" textAnchor="middle" fill="black" fontFamily="Arial" fontSize="12" fontWeight="bold">
        {initials}
      </text>
    </svg>
  );
};

export { TokenCustomIcon };
