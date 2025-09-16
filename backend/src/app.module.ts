import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RssArticle } from './entities/rss-article.entity';
import { RssService } from './services/rss.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/scraper-gossip.db',
      entities: [RssArticle],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([RssArticle]),
  ],
  controllers: [AppController],
  providers: [AppService, RssService],
})
export class AppModule {}
