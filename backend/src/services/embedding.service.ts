import { Injectable, OnModuleInit } from '@nestjs/common';
import { pipeline, PipelineType } from '@huggingface/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embedder: any;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  async onModuleInit() {
    try {
      console.log('Loading embedding model...');
      this.embedder = await pipeline('feature-extraction', this.modelName);
      console.log('Embedding model loaded successfully!');
    } catch (error) {
      console.error('Error loading embedding model:', error.message);
    }
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.embedder) {
      console.log('Embedding model not loaded, initializing...');
      await this.onModuleInit();
    }

    const cleanText = this.cleanText(text);

    try {
      const output = await this.embedder(cleanText, {
        pooling: 'mean',
        normalize: true
      });

      return output.data;
    } catch (error) {
      console.warn('Error generating embedding:', error.message);
      return this.generateDummyEmbedding(text);
    }
  }

  private generateDummyEmbedding(text: string): Float32Array {
    const embedding = new Float32Array(384);
    const hash = this.simpleHash(text);
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = (Math.sin(hash + i) + 1) / 2;
    }
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 512);
  }

  embeddingToBuffer(embedding: Float32Array): Buffer {
    return Buffer.from(embedding.buffer);
  }

  bufferToEmbedding(buffer: Buffer): Float32Array {
    return new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }
}