import { SearchResponse, SearchParams } from '../types/article';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4243';

export class ApiService {
  private static async fetchWithErrorHandling<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  static async searchArticles(params: SearchParams): Promise<SearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('q', params.q);

    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    if (params.threshold) {
      searchParams.append('threshold', params.threshold.toString());
    }

    const url = `${API_BASE_URL}/search?${searchParams.toString()}`;
    const response = await this.fetchWithErrorHandling<SearchResponse>(url);

    // Convert pubDate strings to Date objects
    const articlesWithDates = response.data.map(article => ({
      ...article,
      pubDate: new Date(article.pubDate)
    }));

    return {
      ...response,
      data: articlesWithDates
    };
  }

  static async getAllArticles(): Promise<SearchResponse> {
    // Call search endpoint without query parameter to get first N articles
    const searchParams = new URLSearchParams();
    searchParams.append('limit', '100');

    const url = `${API_BASE_URL}/search?${searchParams.toString()}`;
    const response = await this.fetchWithErrorHandling<SearchResponse>(url);

    // Convert pubDate strings to Date objects
    const articlesWithDates = response.data.map(article => ({
      ...article,
      pubDate: new Date(article.pubDate)
    }));

    return {
      ...response,
      data: articlesWithDates
    };
  }
}