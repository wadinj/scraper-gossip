import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';
import {
  Article,
  Article,
  ChromaArticleMetadata,
} from '../interfaces/article.interface';

@Injectable()
export class VectorService implements OnModuleInit {
  private client: ChromaClient;
  private collection: Collection;
  private readonly collectionName = 'rss_articles';

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
    } catch (error) {
      // Collection doesn't exist, create it
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'RSS articles vector embeddings' },
      });
      console.log('Created new Chroma collection:', this.collectionName);
    }
  }

  async insertArticle(article: Article): Promise<void> {
    try {
      if (!this.collection) {
        console.log(
          'Chroma collection not available, skipping article insertion',
        );
        return;
      }

      const metadata: ChromaArticleMetadata = {
        title: article.title,
        link: article.link,
        creator: article.creator,
        pubDate: article.pubDate.toISOString(),
        description: article.description,
        contentEncoded: article.contentEncoded,
      };

      // Insert article with metadata into Chroma collection (ChromaDB will generate embeddings)
      await this.collection.add({
        ids: [article.id],
        metadatas: [metadata],
        documents: [
          `${article.title} ${article.description} ${article.contentEncoded}`,
        ],
      });

      console.log(
        `Inserted article ${article.id} into Chroma: ${article.title}`,
      );
    } catch (error) {
      console.log('Error inserting article into Chroma:', error.message);
      // Don't throw error to allow seeding to continue
    }
  }

  async findArticleByLink(link: string): Promise<Article | null> {
    try {
      if (!this.collection) {
        console.log('Chroma collection not available');
        return null;
      }

      const results = await this.collection.get({
        where: { link: { $eq: link } },
        include: ['metadatas'],
      });

      if (!results.ids || results.ids.length === 0) {
        return null;
      }

      const metadata = results
        .metadatas?.[0] as unknown as ChromaArticleMetadata;
      if (!metadata) return null;

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
      console.log('Error finding article by link:', error.message);
      return null;
    }
  }

  async searchSimilarArticles(
    query: string,
    limit: number = 10,
    threshold: number = 0.1,
  ): Promise<Article[]> {
    try {
      if (!this.collection) {
        console.log('Chroma collection not available, returning empty results');
        return [];
      }

      // Query Chroma for similar documents (ChromaDB will handle embeddings)
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        include: ['metadatas', 'distances'],
      });

      if (
        !results.ids?.[0] ||
        !results.distances?.[0] ||
        !results.metadatas?.[0]
      ) {
        return [];
      }

      // Convert results to ArticleWithSimilarity format
      const articles: Article[] = [];

      for (let i = 0; i < results.ids[0].length; i++) {
        const distance = results.distances?.[0]?.[i];
        if (distance === null || distance === undefined) continue;

        const similarity = 1 / (1 + distance); // Convert distance to similarity

        // Apply threshold filter
        if (similarity >= threshold) {
          const metadata = results.metadatas?.[0]?.[
            i
          ] as unknown as ChromaArticleMetadata;
          if (metadata) {
            articles.push({
              id: results.ids[0][i] as string,
              title: metadata.title,
              link: metadata.link,
              creator: metadata.creator,
              pubDate: new Date(metadata.pubDate),
              description: metadata.description,
              contentEncoded: metadata.contentEncoded,
              similarity,
            });
          }
        }
      }

      // Sort by similarity (highest first)
      return articles.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.log(
        'Chroma vector search not available, returning empty results:',
        error.message,
      );
      return [];
    }
  }

  // Optional: Method to get collection stats
  async getCollectionInfo() {
    try {
      if (!this.collection) return null;

      const count = await this.collection.count();
      return {
        name: this.collectionName,
        count,
      };
    } catch (error) {
      console.log('Error getting collection info:', error.message);
      return null;
    }
  }
}
