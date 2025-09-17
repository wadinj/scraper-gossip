import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ArticleService } from 'src/services/article.service';

@Controller('search')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  async search(@Query('q') query?: string, @Query('limit') limitStr?: string) {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    try {
      const articles = await this.articleService.search(query, limit);

      return {
        query,
        count: articles.length,
        data: articles,
      };
    } catch (error) {
      throw new BadRequestException(`Search failed: ${error}`);
    }
  }
}
