#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RssService } from '../services/rss.service';
import { EmbeddingService } from '../services/embedding.service';
import { RssArticle } from '../entities/rss-article.entity';
import { Repository, IsNull } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

async function updateEmbeddings() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const embeddingService = app.get(EmbeddingService);
  const rssArticleRepository = app.get<Repository<RssArticle>>(getRepositoryToken(RssArticle));

  try {
    console.log('Starting embedding update for existing articles...');

    const articlesWithoutEmbeddings = await rssArticleRepository.find({
      where: { embedding: IsNull() }
    });

    console.log(`Found ${articlesWithoutEmbeddings.length} articles without embeddings`);

    for (const article of articlesWithoutEmbeddings) {
      try {
        const textForEmbedding = `${article.title} ${article.description || ''} ${article.contentEncoded || ''}`;
        console.log(`Generating embedding for: ${article.title}`);

        const embedding = await embeddingService.generateEmbedding(textForEmbedding);
        article.embedding = embeddingService.embeddingToBuffer(embedding);

        await rssArticleRepository.save(article);
        console.log(`✓ Updated embedding for: ${article.title}`);
      } catch (error) {
        console.error(`Error updating embedding for article ${article.id}:`, error.message);
      }
    }

    console.log('Embedding update completed successfully!');
  } catch (error) {
    console.error('Error during embedding update:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

updateEmbeddings().catch((error) => {
  console.error('Application error:', error);
  process.exit(1);
});