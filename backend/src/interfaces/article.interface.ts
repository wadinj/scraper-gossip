export interface Article {
  id: string;
  title: string;
  link: string;
  creator: string;
  pubDate: Date;
  description: string;
  contentEncoded: string;
  thumbnail?: string;
  distance?: number;
}

export interface ChromaArticleMetadata {
  title: string;
  link: string;
  creator: string;
  pubDate: string; // ISO string format for Chroma
  description: string;
  contentEncoded: string;
  thumbnail?: string;
}
