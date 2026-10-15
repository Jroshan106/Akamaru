export interface Anime {
  id: string;
  title: string;
  japaneseTitle: string;
  synopsis: string;
  coverImage: string;
  bannerImage: string;
  genres: string[];
  status: 'Airing' | 'Completed' | 'Upcoming';
  rating: number;
  year: number;
  studio: string;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
}
