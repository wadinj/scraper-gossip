import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';
import {
  Article,
  ChromaArticleMetadata,
} from '../interfaces/article.interface';
import { EmbeddingService } from '../services/embedding.service';

// Constants
const CHROMA_CONFIG = {
  HOST: 'localhost',
  PORT: 8000,
  COLLECTION_NAME: 'articles',
} as const;

const DEFAULT_LIMITS = {
  SEARCH_RESULTS: 10,
  FIND_RESULTS: 10,
} as const;

// Type definitions for Chroma results
interface ChromaGetResult {
  ids: string[];
  metadatas: unknown[];
  documents?: string[];
}

interface ChromaQueryResult {
  ids: string[][];
  metadatas: unknown[][];
  distances: number[][];
  documents?: string[][];
}

interface NormalizedQueryResult {
  ids: string[];
  metadatas: unknown[];
  distances: number[];
}

@Injectable()
export class ArticleRepository implements OnModuleInit {
  private readonly logger = new Logger(ArticleRepository.name);
  private client: ChromaClient;
  private collection: Collection;

  constructor(private readonly embeddingService: EmbeddingService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeChroma();
      this.logger.log('Chroma vector database initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing Chroma:', error);
    }
  }

  private async initializeChroma(): Promise<void> {
    this.client = new ChromaClient({
      host: CHROMA_CONFIG.HOST,
      port: CHROMA_CONFIG.PORT,
    });

    try {
      this.collection = await this.client.getCollection({
        name: CHROMA_CONFIG.COLLECTION_NAME,
      });
      this.logger.log(`Using existing Chroma collection: ${CHROMA_CONFIG.COLLECTION_NAME}`);
    } catch {
      this.collection = await this.client.createCollection({
        name: CHROMA_CONFIG.COLLECTION_NAME,
      });
      this.logger.log(`Created new Chroma collection: ${CHROMA_CONFIG.COLLECTION_NAME}`);
    }
  }

  async create(articles: Article[]): Promise<void> {
    try {
      if (!this.collection) {
        this.logger.warn('Chroma collection not available, skipping article insertion');
        return;
      }

      if (articles.length === 0) {
        this.logger.debug('No articles to insert');
        return;
      }

      const ids: string[] = [];
      const metadatas: ChromaArticleMetadata[] = [];
      const documents: string[] = [];
      const embeddings: number[][] = [];

      this.logger.log(`Processing ${articles.length} articles for insertion`);

      for (const article of articles) {
        const metadata: ChromaArticleMetadata = {
          title: article.title,
          link: article.link,
          creator: article.creator,
          pubDate: article.pubDate.toISOString(),
          description: article.description,
          contentEncoded: article.contentEncoded,
        };

        const documentText = this.buildDocumentText(article);
        const embedding = await this.embeddingService.generateEmbedding(documentText);

        ids.push(article.id);
        metadatas.push(metadata);
        documents.push(documentText);
        embeddings.push(embedding);
      }

      await this.collection.add({
        ids,
        metadatas,
        documents,
        embeddings,
      });

      this.logger.log(`Successfully inserted ${articles.length} articles`);
    } catch (error) {
      this.logger.error('Error inserting articles into Chroma:', error);
      throw error;
    }
  }

  private buildDocumentText(article: Article): string {
    return `${article.title} ${article.description} ${article.contentEncoded}`.trim();
  }

  async findByLink(link: string): Promise<Article | undefined> {
    try {
      if (!this.collection) {
        this.logger.warn('Chroma collection not available');
        return undefined;
      }

      const results = await this.collection.get({
        where: { link: { $eq: link } },
        include: ['metadatas'],
      }) as ChromaGetResult;

      if (!results.ids || results.ids.length === 0) {
        return undefined;
      }

      const metadata = results.metadatas[0] as ChromaArticleMetadata;
      if (!metadata) {
        return undefined;
      }

      return this.mapMetadataToArticle(results.ids[0], metadata);
    } catch (error) {
      this.logger.error('Error finding article by link:', error);
      return undefined;
    }
  }

  private mapMetadataToArticle(id: string, metadata: ChromaArticleMetadata, distance = 0): Article {
    return {
      id,
      title: metadata.title,
      link: metadata.link,
      creator: metadata.creator,
      pubDate: new Date(metadata.pubDate),
      description: metadata.description,
      contentEncoded: metadata.contentEncoded,
      distance,
    };
  }

  async find(limit: number = DEFAULT_LIMITS.FIND_RESULTS): Promise<Article[]> {
    try {
      if (!this.collection) {
        this.logger.warn('Chroma collection not available');
        return [];
      }

      const results = await this.collection.get({
        limit,
        include: ['metadatas'],
      }) as ChromaGetResult;

      if (!results.ids || !results.metadatas) {
        return [];
      }

      return this.mapGetResultsToArticles(results);
    } catch (error) {
      this.logger.error('Error getting articles:', error);
      return [];
    }
  }

  private mapGetResultsToArticles(results: ChromaGetResult): Article[] {
    const articles: Article[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      const metadata = results.metadatas[i] as ChromaArticleMetadata;
      if (metadata) {
        articles.push(this.mapMetadataToArticle(results.ids[i], metadata));
      }
    }

    return articles;
  }

  async search(searchQuery?: string, limit: number = DEFAULT_LIMITS.SEARCH_RESULTS): Promise<Article[]> {
    try {
      if (!this.collection) {
        this.logger.warn('Chroma collection not available');
        return [];
      }

      if (!searchQuery?.trim()) {
        return this.find(limit);
      }

      const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery.trim());
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['metadatas', 'distances'],
      }) as ChromaQueryResult;

      if (!results.ids?.[0] || !results.distances?.[0] || !results.metadatas?.[0]) {
        return [];
      }

      const normalizedResults: NormalizedQueryResult = {
        ids: results.ids[0],
        metadatas: results.metadatas[0],
        distances: results.distances[0],
      };

      return this.mapQueryResultsToArticles(normalizedResults);
    } catch (error) {
      this.logger.error('Error searching articles:', error);
      return [];
    }
  }

  private mapQueryResultsToArticles(results: NormalizedQueryResult): Article[] {
    const articles: Article[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      const distance = results.distances[i];
      if (distance === null || distance === undefined) {
        continue;
      }

      const metadata = results.metadatas[i] as ChromaArticleMetadata;
      if (metadata) {
        articles.push(this.mapMetadataToArticle(results.ids[i], metadata, distance));
      }
    }

    return articles.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

}
