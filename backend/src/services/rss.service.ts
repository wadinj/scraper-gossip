import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { ArticleService } from './article.service';
import { Article } from '../interfaces/article.interface';
import * as crypto from 'crypto';

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
  constructor(private articleService: ArticleService) {}

  async findRssFeed(websiteUrl: string): Promise<string[]> {
    const possibleFeeds: string[] = [];

    try {
      // First, try common RSS feed patterns
      const baseUrl = new URL(websiteUrl);
      const commonPaths = [
        '/feed',
        '/rss',
        '/feed.xml',
        '/rss.xml',
        '/feed/',
        '/rss/',
      ];

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
          $(
            'link[type="application/rss+xml"], link[type="application/atom+xml"]',
          ).each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              // Convert relative URLs to absolute
              const feedUrl = href.startsWith('http')
                ? href
                : new URL(href, websiteUrl).toString();
              possibleFeeds.push(feedUrl);
            }
          });

          // Look for RSS links in anchor tags
          $('a[href*="rss"], a[href*="feed"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
              const feedUrl = href.startsWith('http')
                ? href
                : new URL(href, websiteUrl).toString();
              possibleFeeds.push(feedUrl);
            }
          });
        } catch (error) {
          console.warn(
            `Could not parse HTML for ${websiteUrl}:`,
            error.message,
          );
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
      const parsedData = (await parseXml(response.data)) as RssFeed;

      const items = parsedData.rss.channel[0].item;
      const newArticles: Article[] = [];

      console.log(`Processing ${items.length} articles from RSS feed...`);

      // First pass: check which articles don't exist and build array for batch insert
      for (const item of items) {
        const link = item.link[0];

        // Check if article already exists in Chroma
        const existingArticle = await this.articleService.findByLink(link);

        if (!existingArticle) {
          // Generate a unique ID for the article
          const id = crypto.createHash('md5').update(link).digest('hex');

          const article: Article = {
            id,
            title: item.title[0],
            link,
            creator: item['dc:creator'] ? item['dc:creator'][0] : '',
            pubDate: new Date(item.pubDate[0]),
            description: item.description ? item.description[0] : '',
            contentEncoded: item['content:encoded']
              ? item['content:encoded'][0]
              : '',
          };

          newArticles.push(article);
        } else {
          console.log(`Article already exists: ${item.title[0]}`);
        }
      }

      // Batch insert all new articles
      if (newArticles.length > 0) {
        console.log(`Batch inserting ${newArticles.length} new articles...`);
        await this.articleService.create(newArticles);
        console.log(
          `Successfully batch inserted ${newArticles.length} articles`,
        );
        
      } else {
        console.log('No new articles to insert');
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
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#')); // Remove empty lines and comments

      console.log(`Processing ${websites.length} websites from ${filePath}`);

      for (const website of websites) {
        console.log(`\n--- Processing website: ${website} ---`);

        const rssFeeds = await this.findRssFeed(website);

        if (rssFeeds.length === 0) {
          console.log(`No RSS feeds found for ${website}`);
          continue;
        }

        console.log(`Found ${rssFeeds.length} RSS feed(s) for ${website}:`);
        rssFeeds.forEach((feed) => console.log(`  - ${feed}`));

        // Process each RSS feed found
        for (const feedUrl of rssFeeds) {
          try {
            console.log(`\nProcessing RSS feed: ${feedUrl}`);
            await this.fetchAndStoreRssFeed(feedUrl);
          } catch (error) {
            console.error(
              `Error processing RSS feed ${feedUrl}:`,
              error.message,
            );
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
