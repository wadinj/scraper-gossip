import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import { ArticleService } from './article.service';
import { Article } from '../interfaces/article.interface';
import * as crypto from 'crypto';

const RSS_CONFIG = {
  TIMEOUT: 10000,
  HEAD_TIMEOUT: 5000,
  COMMON_RSS_PATHS: [
    '/feed',
    '/rss',
    '/feed.xml',
    '/rss.xml',
    '/feed/',
    '/rss/',
  ],
  RSS_SELECTORS: {
    RSS_LINKS:
      'link[type="application/rss+xml"], link[type="application/atom+xml"]',
    FEED_ANCHORS: 'a[href*="rss"], a[href*="feed"]',
  },
} as const;

const parseXml = promisify(parseString);

interface RssItem {
  title: string[];
  link: string[];
  'dc:creator': string[];
  pubDate: string[];
  description: string[];
  'content:encoded': string[];
}

interface RssChannel {
  item: RssItem[];
}

interface RssFeed {
  rss: {
    channel: RssChannel[];
  };
}

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);

  constructor(private readonly articleService: ArticleService) {}

  async findRssFeed(websiteUrl: string): Promise<string[]> {
    const possibleFeeds: string[] = [];

    try {
      const baseUrl = new URL(websiteUrl);

      // First, try common RSS feed patterns
      for (const path of RSS_CONFIG.COMMON_RSS_PATHS) {
        const feedUrl = `${baseUrl.origin}${path}`;
        try {
          const response = await axios.head(feedUrl, {
            timeout: RSS_CONFIG.HEAD_TIMEOUT,
          });
          if (response.status === 200) {
            possibleFeeds.push(feedUrl);
          }
        } catch {
          // Continue to next path
        }
      }

      // If no feeds found, parse the HTML for RSS links
      if (possibleFeeds.length === 0) {
        try {
          const response: AxiosResponse<string> = await axios.get(websiteUrl, {
            timeout: RSS_CONFIG.TIMEOUT,
          });
          const $ = cheerio.load(response.data);

          // Look for RSS links in the HTML
          $(RSS_CONFIG.RSS_SELECTORS.RSS_LINKS).each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              const feedUrl = this.normalizeUrl(href, websiteUrl);
              possibleFeeds.push(feedUrl);
            }
          });

          // Look for RSS links in anchor tags
          $(RSS_CONFIG.RSS_SELECTORS.FEED_ANCHORS).each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              const feedUrl = this.normalizeUrl(href, websiteUrl);
              possibleFeeds.push(feedUrl);
            }
          });
        } catch (error) {
          this.logger.warn(`Could not parse HTML for ${websiteUrl}:`, error);
        }
      }

      return [...new Set(possibleFeeds)];
    } catch (error) {
      this.logger.error(`Error finding RSS feed for ${websiteUrl}:`, error);
      return [];
    }
  }

  private normalizeUrl(href: string, baseUrl: string): string {
    return href.startsWith('http') ? href : new URL(href, baseUrl).toString();
  }

  async fetchAndStoreRssFeed(url: string): Promise<void> {
    try {
      const response: AxiosResponse<string> = await axios.get(url, {
        timeout: RSS_CONFIG.TIMEOUT,
      });
      const parsedData = (await parseXml(response.data)) as RssFeed;

      const items = parsedData.rss.channel[0].item;
      if (!items || items.length === 0) {
        this.logger.warn(`No articles found in RSS feed: ${url}`);
        return;
      }

      const newArticles: Article[] = [];
      this.logger.log(`Processing ${items.length} articles from RSS feed`);

      for (const item of items) {
        const link = item.link[0];
        if (!link) {
          this.logger.warn('Skipping article without link');
          continue;
        }

        const existingArticle = await this.articleService.findByLink(link);
        if (!existingArticle) {
          const article = this.buildArticleFromRssItem(item);
          newArticles.push(article);
        }
      }

      if (newArticles.length > 0) {
        this.logger.log(`Inserting ${newArticles.length} new articles`);
        await this.articleService.create(newArticles);
        this.logger.log(`Successfully inserted ${newArticles.length} articles`);
      } else {
        this.logger.log('No new articles to insert');
      }

      this.logger.log(`Successfully processed RSS feed from ${url}`);
    } catch (error) {
      this.logger.error('Error fetching RSS feed:', error);
      throw error;
    }
  }

  private buildArticleFromRssItem(item: RssItem): Article {
    const link = item.link[0];
    const id = crypto.createHash('md5').update(link).digest('hex');

    return {
      id,
      title: item.title?.[0] ?? '',
      link,
      creator: item['dc:creator']?.[0] ?? '',
      pubDate: new Date(item.pubDate?.[0] ?? Date.now()),
      description: item.description?.[0] ?? '',
      contentEncoded: item['content:encoded']?.[0] ?? '',
    };
  }

  async processWebsitesFromFile(filePath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const websites = this.parseWebsiteFile(fileContent);

      this.logger.log(
        `Processing ${websites.length} websites from ${filePath}`,
      );

      for (const website of websites) {
        this.logger.log(`Processing website: ${website}`);

        const rssFeeds = await this.findRssFeed(website);

        if (rssFeeds.length === 0) {
          this.logger.warn(`No RSS feeds found for ${website}`);
          continue;
        }

        this.logger.log(`Found ${rssFeeds.length} RSS feed(s) for ${website}`);

        for (const feedUrl of rssFeeds) {
          try {
            this.logger.log(`Processing RSS feed: ${feedUrl}`);
            await this.fetchAndStoreRssFeed(feedUrl);
          } catch (error) {
            this.logger.error(`Error processing RSS feed ${feedUrl}:`, error);
          }
        }
      }

      this.logger.log('Finished processing all websites');
    } catch (error) {
      this.logger.error('Error reading website file:', error);
      throw error;
    }
  }

  private parseWebsiteFile(fileContent: string): string[] {
    return fileContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  }
}
