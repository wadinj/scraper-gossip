import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rss_articles')
export class RssArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  link: string;

  @Column()
  creator: string;

  @Column('datetime')
  pubDate: Date;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  contentEncoded: string;

  @Column('blob', { nullable: true })
  embedding: Buffer;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}