import { Module } from '@nestjs/common';
import { RssService } from './services/rss.service';
import { ArticleService } from './services/article.service';
import { EmbeddingService } from './services/embedding.service';
import { SeedingService } from './services/seeding.service';
import { AppInitService } from './services/app-init.service';
import { ArticleRepository } from './repositories/article.repository';
import { ArticleController } from './controllers/article.controller';

@Module({
  imports: [],
  controllers: [ArticleController],
  providers: [
    RssService,
    ArticleService,
    EmbeddingService,
    SeedingService,
    AppInitService,
    ArticleRepository,
  ],
})
export class AppModule {}
