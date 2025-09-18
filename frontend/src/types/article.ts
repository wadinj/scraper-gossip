export interface Article {
  id: string;
  title: string;
  link: string;
  creator: string;
  pubDate: Date;
  description: string;
  contentEncoded: string;
  thumbnail?: string;
  similarity?: number;
}

export interface SearchResponse {
  query: string;
  results: number;
  data: Article[];
}

export interface SearchParams {
  q: string;
  limit?: number;
  threshold?: number;
}
