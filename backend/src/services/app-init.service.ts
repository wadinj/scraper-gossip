import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SeedingService } from './seeding.service';

@Injectable()
export class AppInitService implements OnModuleInit {
  private readonly logger = new Logger(AppInitService.name);

  constructor(private readonly seedingService: SeedingService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedingService.checkAndSeedIfEmpty();
    } catch (error) {
      this.logger.error('Error during app initialization:', error);
    }
  }
}
