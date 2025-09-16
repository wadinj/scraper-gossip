#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RssService } from './services/rss.service';
import { EmbeddingService } from './services/embedding.service';
import { RssArticle } from './entities/rss-article.entity';
import { Repository, IsNull } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: scraper-gossip <command> [options]');
    console.log('Commands:');
    console.log('  seed             Fetch and store RSS feed data from websites');
    console.log('  update-embeddings Update embeddings for existing articles');
    console.log('Options:');
    console.log(
      '  --seed-website-file <file>    Path to file containing websites (default: default_seed_gossip_websites.txt)',
    );
    process.exit(1);
  }

  const command = args[0];

  if (command === 'seed') {
    await seedCommand(args.slice(1));
  } else if (command === 'update-embeddings') {
    await updateEmbeddingsCommand();
  } else {
    console.log(`Unknown command: ${command}`);
    process.exit(1);
  }
}

async function seedCommand(args: string[]) {
  const app = await NestFactory.createApplicationContext(AppModule);
  const rssService = app.get(RssService);

  // Parse arguments
  let websiteFile = 'default_seed_gossip_websites.txt';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed-website-file' && i + 1 < args.length) {
      websiteFile = args[i + 1];
      i++; // Skip the next argument as it's the file path
    }
  }

  // Resolve file path relative to the backend directory
  const filePath = path.resolve(process.cwd(), websiteFile);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Website file not found: ${filePath}`);
    process.exit(1);
  }

  try {
    console.log('Starting RSS feed seeding from websites...');
    console.log(`Using website file: ${filePath}`);
    await rssService.processWebsitesFromFile(filePath);
    console.log('RSS feed seeding completed successfully!');
  } catch (error) {
    console.error('Error during RSS feed seeding:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

async function updateEmbeddingsCommand() {
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

main().catch((error) => {
  console.error('Application error:', error);
  process.exit(1);
});
