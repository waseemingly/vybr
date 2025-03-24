export const generateMusicConversationStarters = (
  commonArtists?: string[],
  commonGenres?: string[]
): string[] => {
  const starters: string[] = [];

  if (commonArtists && commonArtists.length > 0) {
    commonArtists.forEach((artist) => {
      starters.push(`What's your favorite song by ${artist}?`);
      starters.push(`Have you seen ${artist} perform live before?`);
    });
  }

  if (commonGenres && commonGenres.length > 0) {
    commonGenres.forEach((genre) => {
      starters.push(`Who are your top artists in the ${genre} genre?`);
      starters.push(`What ${genre} festivals or events have you been to?`);
    });
  }

  const generalStarters = [
    "What music have you been listening to lately?",
    "What's the last concert you went to?",
    "Do you prefer discovering new music or sticking with your favorites?",
    "What music helps you concentrate or relax?",
    "Which artist would you love to see collaborate?",
  ];

  while (starters.length < 3 && generalStarters.length > 0) {
    starters.push(generalStarters.pop()!);
  }

  return starters.length > 4
    ? starters.sort(() => 0.5 - Math.random()).slice(0, 4)
    : starters;
};
