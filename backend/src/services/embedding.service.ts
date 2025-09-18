import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { pipeline, FeatureExtractionPipeline, env } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private embedder?: FeatureExtractionPipeline = undefined;

  async onModuleInit() {
    try {
      this.logger.log('Initializing embedding model: all-MiniLM-L6-v2...');

      // Disable ONNX runtime and force WASM backend for Node.js/Docker
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.simd = false;
      env.backends.onnx.wasm.proxy = false;

      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          quantized: true,
          local_files_only: false,
        },
      );
      this.logger.log('Embedding model initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing embedding model:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const cleanText = text.replace(/<[^>]*>/g, '').trim();

      const result = await this.embedder(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = Array.from(result.data) as number[];

      this.logger.debug(
        `Generated embedding for text (length: ${cleanText.length}), embedding dim: ${embedding.length}`,
      );
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
}
