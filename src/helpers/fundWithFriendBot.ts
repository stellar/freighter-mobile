const fundWithFriendBot = async (publicKey: string): Promise<void> => {
  const response = await fetch(
    `https://friendbot.stellar.org/fund?addr=${publicKey}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fund account with FriendBot");
  }
};

export default fundWithFriendBot;
