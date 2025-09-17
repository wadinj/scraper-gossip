import { Injectable } from '@nestjs/common';
import { ArticleRepository } from '../repositories/article.repository';
import { Article } from '../interfaces/article.interface';

@Injectable()
export class ArticleService {
  constructor(private readonly articleRepository: ArticleRepository) {}

  async create(articles: Article[]): Promise<void> {
    return this.articleRepository.create(articles);
  }

  async findByLink(link: string): Promise<Article | undefined> {
    return await this.articleRepository.findByLink(link);
  }

  async search(query?: string, limit: number = 10): Promise<Article[]> {
    return this.articleRepository.search(query, limit);
  }
}
