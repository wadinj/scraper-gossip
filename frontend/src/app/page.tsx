'use client';

import { useState, useEffect } from 'react';
import { Article, SearchParams } from '@/types/article';
import { ApiService } from '@/services/api';

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all articles on component mount
  useEffect(() => {
    loadAllArticles();
  }, []);

  const loadAllArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ApiService.getAllArticles();
      setArticles(response.data);
    } catch (err) {
      setError('Failed to load articles. Please check if the backend server is running.');
      console.error('Error loading articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadAllArticles();
      return;
    }

    try {
      setSearching(true);
      setError(null);
      const params: SearchParams = {
        q: searchQuery,
        limit: 50,
        threshold: 10,
      };
      const response = await ApiService.searchArticles(params);
      setArticles(response.data);
    } catch (err) {
      setError('Search failed. Please check if the backend server is running.');
      console.error('Error searching articles:', err);
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Article Search & Discovery
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Semantic search through RSS articles using vector embeddings
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles by content, title, or topic..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  loadAllArticles();
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Results Summary */}
        {!loading && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {searchQuery
              ? `Found ${articles.length} articles for "${searchQuery}"`
              : `Showing ${articles.length} articles`
            }
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Articles Grid */}
      {!loading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
            >
              <div className="p-6">
                {/* Article Header */}
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {article.title}
                    </a>
                  </h2>

                  {/* Similarity Score (only show for search results) */}
                  {searchQuery && article.similarity && (
                    <div className="mb-2">
                      <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                        {Math.round(article.similarity * 100)}% match
                      </span>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    {article.creator && (
                      <div>By: <span className="font-medium">{article.creator}</span></div>
                    )}
                    <div>Published: {formatDate(article.pubDate)}</div>
                  </div>
                </div>

                {/* Article Description */}
                {article.description && (
                  <div className="mb-4">
                    <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-3">
                      {stripHtml(article.description)}
                    </p>
                  </div>
                )}

                {/* Article Content Preview */}
                {article.contentEncoded && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Content Preview:</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-xs line-clamp-4">
                      {stripHtml(article.contentEncoded).substring(0, 200)}...
                    </p>
                  </div>
                )}

                {/* Article Link */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Read full article →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && !error && articles.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            {searchQuery
              ? 'No articles found for your search. Try different keywords.'
              : 'No articles available. Run the seed command to populate the database.'
            }
          </div>
        </div>
      )}
    </div>
  );
}
