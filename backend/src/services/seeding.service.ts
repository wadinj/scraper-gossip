import { Injectable, Logger } from '@nestjs/common';
import { RssService } from './rss.service';
import { ArticleRepository } from '../repositories/article.repository';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class SeedingService {
  private readonly logger = new Logger(SeedingService.name);
  private readonly defaultSeedFile = 'default_seed_gossip_websites.txt';

  constructor(
    private readonly rssService: RssService,
    private readonly articleRepository: ArticleRepository,
  ) {}

  async checkAndSeedIfEmpty(): Promise<void> {
    try {
      const count = await this.articleRepository.count();

      if (count === 0) {
        this.logger.log('Collection is empty, triggering automatic seeding...');
        await this.seedFromDefaultFile();
      } else {
        this.logger.log(
          `Collection contains ${count} articles, skipping auto-seed`,
        );
      }
    } catch (error) {
      this.logger.error('Error during auto-seeding check:', error);
    }
  }

  async seedFromDefaultFile(): Promise<void> {
    const filePath = path.resolve(process.cwd(), this.defaultSeedFile);

    try {
      await fs.access(filePath);
      this.logger.log(`Starting automatic seeding from: ${filePath}`);
      await this.rssService.processWebsitesFromFile(filePath);
      this.logger.log('Automatic seeding completed successfully');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn(`Default seed file not found: ${filePath}`);
        this.logger.warn(
          'Skipping automatic seeding. Run manual seed command if needed.',
        );
      } else {
        this.logger.error('Error during automatic seeding:', error);
      }
    }
  }
}
