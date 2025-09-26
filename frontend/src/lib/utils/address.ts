const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getBlockExplorerUrl = (address: string) => {
  return `https://idea.gear-tech.io/programs/${address}`;
};

const openBlockExplorer = (address: string) => {
  window.open(getBlockExplorerUrl(address), '_blank', 'noopener,noreferrer');
};

export { shortenAddress, openBlockExplorer, getBlockExplorerUrl };
