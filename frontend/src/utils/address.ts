const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const openBlockExplorer = (address: string) => {
  window.open(`https://idea.gear-tech.io/programs/${address}`, '_blank', 'noopener,noreferrer');
};

export { shortenAddress, openBlockExplorer };
