import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';
import {
  Article,
  ChromaArticleMetadata,
} from '../interfaces/article.interface';
import { EmbeddingService } from '../services/embedding.service';

@Injectable()
export class ArticleRepository implements OnModuleInit {
  private client: ChromaClient;
  private collection: Collection;
  private readonly collectionName = 'articles';

  constructor(private readonly embeddingService: EmbeddingService) {}

  async onModuleInit() {
    try {
      await this.initializeChroma();
      console.log('Chroma vector database initialized successfully');
    } catch (error) {
      console.error('Error initializing Chroma:', error);
    }
  }

  private async initializeChroma() {
    this.client = new ChromaClient({
      host: 'localhost',
      port: 8000,
    });

    // Get or create collection for RSS articles
    try {
      this.collection = await this.client.getCollection({
        name: this.collectionName,
      });
      console.log('Using existing Chroma collection:', this.collectionName);
    } catch {
      // Collection doesn't exist, create it
      this.collection = await this.client.createCollection({
        name: this.collectionName,
      });
      console.log('Created new Chroma collection:', this.collectionName);
    }
  }

  async create(articles: Article[]): Promise<void> {
    try {
      if (!this.collection) {
        console.log(
          'Chroma collection not available, skipping batch article insertion',
        );
        return;
      }

      if (articles.length === 0) {
        console.log('No articles to insert');
        return;
      }

      const ids: string[] = [];
      const metadatas: ChromaArticleMetadata[] = [];
      const documents: string[] = [];
      const embeddings: number[][] = [];

      console.log(`Generating embeddings for ${articles.length} articles...`);

      for (const article of articles) {
        const metadata: ChromaArticleMetadata = {
          title: article.title,
          link: article.link,
          creator: article.creator,
          pubDate: article.pubDate.toISOString(),
          description: article.description,
          contentEncoded: article.contentEncoded,
        };

        const documentText = `${article.title} ${article.description} ${article.contentEncoded}`;
        const embedding =
          await this.embeddingService.generateEmbedding(documentText);

        ids.push(article.id);
        metadatas.push(metadata);
        documents.push(documentText);
        embeddings.push(embedding);
      }

      console.log(`Inserting ${articles.length} articles into Chroma...`);

      await this.collection.add({
        ids,
        metadatas,
        documents,
        embeddings,
      });

      console.log(
        `Successfully inserted ${articles.length} articles into Chroma`,
      );
    } catch (error) {
      console.log('Error inserting batch articles into Chroma:', error);
      // Don't throw error to allow seeding to continue
    }
  }

  async findByLink(link: string): Promise<Article | undefined> {
    try {
      if (!this.collection) {
        console.log('Chroma collection not available');
        return undefined;
      }

      const results = await this.collection.get({
        where: { link: { $eq: link } },
        include: ['metadatas'],
      });

      if (!results.ids || results.ids.length === 0) {
        return undefined;
      }

      const metadata = results
        .metadatas?.[0] as unknown as ChromaArticleMetadata;
      if (!metadata) return undefined;

      return {
        id: results.ids[0],
        title: metadata.title,
        link: metadata.link,
        creator: metadata.creator,
        pubDate: new Date(metadata.pubDate),
        description: metadata.description,
        contentEncoded: metadata.contentEncoded,
      };
    } catch (error) {
      console.log('Error finding article by link:', error);
      return undefined;
    }
  }

  async find(limit: number = 10): Promise<Article[]> {
    try {
      if (!this.collection) {
        console.log('Chroma collection not available, returning empty results');
        return [];
      }

      const results = await this.collection.get({
        limit,
        include: ['metadatas'],
      });

      console.log(`Find results: ${results.ids?.length || 0} articles found`);

      if (!results.ids || !results.metadatas) {
        console.log('No articles in collection');
        return [];
      }

      const articles = this.mapResultsToArticles(results, false);
      console.log(`Mapped ${articles.length} articles from find results`);

      return articles;
    } catch (error) {
      console.log('Error getting articles:', error);
      return [];
    }
  }

  async search(searchQuery?: string, limit: number = 10): Promise<Article[]> {
    try {
      if (!this.collection) {
        console.log('Chroma collection not available, returning empty results');
        return [];
      }

      if (!searchQuery || !searchQuery.trim()) {
        return this.find(limit);
      }

      console.log(
        `Searching for: "${searchQuery.trim()}" with limit: ${limit}`,
      );

      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery.trim());

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['metadatas', 'distances'],
      });

      console.log('Raw query results:', {
        ids: results.ids?.[0]?.length || 0,
        distances: results.distances?.[0]?.length || 0,
        metadatas: results.metadatas?.[0]?.length || 0,
        firstDistance: results.distances?.[0]?.[0],
      });

      if (
        !results.ids?.[0] ||
        !results.distances?.[0] ||
        !results.metadatas?.[0]
      ) {
        console.log('No results returned from Chroma query');
        return [];
      }

      // Convert query results format to consistent format
      const normalizedResults = {
        ids: results.ids[0],
        metadatas: results.metadatas[0],
        distances: results.distances[0],
      };

      const articles = this.mapResultsToArticles(normalizedResults, true);
      console.log(`Mapped ${articles.length} articles from search results`);

      return articles;
    } catch (error) {
      console.log('Error searching articles:', error);
      return [];
    }
  }

  private mapResultsToArticles(
    results: any,
    hasDistances: boolean = false,
  ): Article[] {
    const articles: Article[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      let distance = 0; // Default distance for get queries

      if (hasDistances && results.distances) {
        distance = results.distances[i];
        if (distance === null || distance === undefined) continue;
      }

      const metadata = results.metadatas[i] as unknown as ChromaArticleMetadata;
      if (metadata) {
        articles.push({
          id: results.ids[i],
          title: metadata.title,
          link: metadata.link,
          creator: metadata.creator,
          pubDate: new Date(metadata.pubDate),
          description: metadata.description,
          contentEncoded: metadata.contentEncoded,
          distance,
        });
      }
    }

    // Sort by distance (lowest first for search results, keep original order for get results)
    if (hasDistances) {
      return articles.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    return articles;
  }
}
