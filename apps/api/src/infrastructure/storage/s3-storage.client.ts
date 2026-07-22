import { Inject, Injectable } from '@nestjs/common';

import { API_CONFIG } from '../../bootstrap/api-config.module';

import type { ApiConfig } from '../../bootstrap/configuration';

export type PutObjectInput = {
  organizationId: string;
  relativePath: string;
  body: Uint8Array;
  contentType: string;
};

@Injectable()
export class S3StorageClient {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  buildObjectKey(organizationId: string, relativePath: string): string {
    const normalized = relativePath.replace(/^\/+/, '');
    if (normalized.includes('..')) {
      throw new Error('Relative object path must not contain parent segments');
    }
    return `org/${organizationId}/${normalized}`;
  }

  isConfigured(): boolean {
    return (
      this.config.s3.bucket !== undefined &&
      this.config.s3.endpoint !== undefined &&
      this.config.s3.accessKeyId !== undefined &&
      this.config.s3.secretAccessKey !== undefined
    );
  }

  /**
   * Sprint-02 wires configuration and key conventions only.
   * Upload/download SDK integration lands with document module work.
   */
  describeTarget(input: PutObjectInput): {
    bucket: string;
    key: string;
    contentType: string;
    configured: boolean;
  } {
    const bucket = this.config.s3.bucket ?? 'unconfigured';
    return {
      bucket,
      key: this.buildObjectKey(input.organizationId, input.relativePath),
      contentType: input.contentType,
      configured: this.isConfigured(),
    };
  }
}
