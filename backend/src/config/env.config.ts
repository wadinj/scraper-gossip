export interface EnvironmentConfig {
  // Server Configuration
  readonly backendPort: number;
  readonly corsOrigins: string[];

  // Chroma Configuration
  readonly chromaHost: string;
  readonly chromaPort: number;

  // Application Configuration
  readonly nodeEnv: string;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
}

class EnvConfigService {
  private static instance: EnvConfigService;
  private readonly config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): EnvConfigService {
    if (!EnvConfigService.instance) {
      EnvConfigService.instance = new EnvConfigService();
    }
    return EnvConfigService.instance;
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  private loadConfiguration(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';

    return {
      // Server Configuration
      backendPort: parseInt(process.env.BACKEND_PORT || '4243', 10),
      corsOrigins: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
        : ['http://localhost:4242'],

      // Chroma Configuration
      chromaHost: process.env.CHROMA_HOST || 'localhost',
      chromaPort: parseInt(process.env.CHROMA_PORT || '8000', 10),

      // Application Configuration
      nodeEnv,
      isProduction: nodeEnv === 'production',
      isDevelopment: nodeEnv === 'development',
    };
  }

  // Convenience getters for commonly used config values
  public get chroma() {
    return {
      host: this.config.chromaHost,
      port: this.config.chromaPort,
    };
  }

  public get server() {
    return {
      port: this.config.backendPort,
      corsOrigins: this.config.corsOrigins,
    };
  }

  public get app() {
    return {
      nodeEnv: this.config.nodeEnv,
      isProduction: this.config.isProduction,
      isDevelopment: this.config.isDevelopment,
    };
  }
}

// Export singleton instance
export const envConfig = EnvConfigService.getInstance();