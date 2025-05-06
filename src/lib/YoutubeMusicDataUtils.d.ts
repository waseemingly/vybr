declare module '@/lib/YoutubeMusicDataUtils' {
  export const fetchAndSaveYouTubeMusicData: (userId: string, isPremium: boolean) => Promise<boolean>;
  
  const YoutubeMusicDataUtils: {
    fetchAndSaveYouTubeMusicData: (userId: string, isPremium: boolean) => Promise<boolean>;
  };
  
  export default YoutubeMusicDataUtils;
} 