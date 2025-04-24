export const truncatePublicKey = (input: {
  publicKey: string;
  length: number;
}) => {
  const { publicKey, length } = input;
  return `${publicKey.slice(0, length)}...${publicKey.slice(-length)}`;
};
