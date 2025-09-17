import { Injectable, OnModuleInit } from '@nestjs/common';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embedder?: FeatureExtractionPipeline = undefined;

  async onModuleInit() {
    try {
      console.log('Initializing embedding model: all-MiniLM-L6-v2...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: false },
      );
      console.log('Embedding model initialized successfully');
    } catch (error) {
      console.error('Error initializing embedding model:', error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    try {
      // Clean and normalize text
      const cleanText = text.replace(/<[^>]*>/g, '').trim();

      // Generate embedding
      const result = await this.embedder(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      const embedding = Array.from(result.data) as number[];

      console.log(
        `Generated embedding for text (length: ${cleanText.length}), embedding dim: ${embedding.length}`,
      );
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
}
