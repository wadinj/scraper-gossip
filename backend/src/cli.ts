#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RssService } from './services/rss.service';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: scraper-gossip <command> [options]');
    console.log('Commands:');
    console.log(
      ' seed             Fetch and store RSS feed data from websites',
    );
    console.log('Options:');
    console.log(
      '  --seed-website-file <file>    Path to file containing websites (default: default_seed_gossip_websites.txt)',
    );
    process.exit(1);
  }

  const command = args[0];

  if (command === 'seed') {
    await seedCommand(args.slice(1));
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

main().catch((error) => {
  console.error('Application error:', error);
  process.exit(1);
});
