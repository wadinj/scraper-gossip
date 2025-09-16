import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { RssArticle } from '../entities/rss-article.entity';
import { EmbeddingService } from './embedding.service';

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
  constructor(
    @InjectRepository(RssArticle)
    private rssArticleRepository: Repository<RssArticle>,
    private embeddingService: EmbeddingService,
  ) {}

  async findRssFeed(websiteUrl: string): Promise<string[]> {
    const possibleFeeds: string[] = [];

    try {
      // First, try common RSS feed patterns
      const baseUrl = new URL(websiteUrl);
      const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/feed/', '/rss/'];

      for (const path of commonPaths) {
        const feedUrl = `${baseUrl.origin}${path}`;
        try {
          const response = await axios.head(feedUrl, { timeout: 5000 });
          if (response.status === 200) {
            possibleFeeds.push(feedUrl);
          }
        } catch (error) {
          // Continue to next path
        }
      }

      // If no feeds found, parse the HTML for RSS links
      if (possibleFeeds.length === 0) {
        try {
          const response = await axios.get(websiteUrl, { timeout: 10000 });
          const $ = cheerio.load(response.data);

          // Look for RSS links in the HTML
          $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              // Convert relative URLs to absolute
              const feedUrl = href.startsWith('http') ? href : new URL(href, websiteUrl).toString();
              possibleFeeds.push(feedUrl);
            }
          });

          // Look for RSS links in anchor tags
          $('a[href*="rss"], a[href*="feed"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              const feedUrl = href.startsWith('http') ? href : new URL(href, websiteUrl).toString();
              possibleFeeds.push(feedUrl);
            }
          });
        } catch (error) {
          console.warn(`Could not parse HTML for ${websiteUrl}:`, error.message);
        }
      }

      return [...new Set(possibleFeeds)]; // Remove duplicates
    } catch (error) {
      console.error(`Error finding RSS feed for ${websiteUrl}:`, error.message);
      return [];
    }
  }

  async fetchAndStoreRssFeed(url: string): Promise<void> {
    try {
      const response = await axios.get(url);
      const parsedData = await parseXml(response.data) as RssFeed;

      const items = parsedData.rss.channel[0].item;

      for (const item of items) {
        const existingArticle = await this.rssArticleRepository.findOne({
          where: { link: item.link[0] }
        });

        if (!existingArticle) {
          const article = new RssArticle();
          article.title = item.title[0];
          article.link = item.link[0];
          article.creator = item['dc:creator'] ? item['dc:creator'][0] : '';
          article.pubDate = new Date(item.pubDate[0]);
          article.description = item.description ? item.description[0] : '';
          article.contentEncoded = item['content:encoded'] ? item['content:encoded'][0] : '';

          const textForEmbedding = `${article.title} ${article.description || ''} ${article.contentEncoded || ''}`;
          console.log(`Generating embedding for: ${article.title}`);
          const embedding = await this.embeddingService.generateEmbedding(textForEmbedding);
          article.embedding = this.embeddingService.embeddingToBuffer(embedding);

          await this.rssArticleRepository.save(article);
          console.log(`Saved article with embedding: ${article.title}`);
        } else {
          console.log(`Article already exists: ${item.title[0]}`);
        }
      }

      console.log(`Successfully processed RSS feed from ${url}`);
    } catch (error) {
      console.error('Error fetching RSS feed:', error);
      throw error;
    }
  }

  async processWebsitesFromFile(filePath: string): Promise<void> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const websites = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments

      console.log(`Processing ${websites.length} websites from ${filePath}`);

      for (const website of websites) {
        console.log(`\n--- Processing website: ${website} ---`);

        const rssFeeds = await this.findRssFeed(website);

        if (rssFeeds.length === 0) {
          console.log(`No RSS feeds found for ${website}`);
          continue;
        }

        console.log(`Found ${rssFeeds.length} RSS feed(s) for ${website}:`);
        rssFeeds.forEach(feed => console.log(`  - ${feed}`));

        // Process each RSS feed found
        for (const feedUrl of rssFeeds) {
          try {
            console.log(`\nProcessing RSS feed: ${feedUrl}`);
            await this.fetchAndStoreRssFeed(feedUrl);
          } catch (error) {
            console.error(`Error processing RSS feed ${feedUrl}:`, error.message);
          }
        }
      }

      console.log('\nFinished processing all websites');
    } catch (error) {
      console.error('Error reading website file:', error);
      throw error;
    }
  }
}