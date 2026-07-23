import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { type Readable } from 'node:stream';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';

import { API_CONFIG } from '../../bootstrap/api-config.module';

import type { ApiConfig } from '../../bootstrap/configuration';

export type PutObjectInput = {
  organizationId: string;
  relativePath: string;
  body: Uint8Array;
  contentType: string;
};

export type GetObjectResult = {
  body: Uint8Array;
  contentType: string;
  key: string;
};

export type ObjectUrlResult = {
  url: string;
  mode: 's3' | 'local';
  expiresInSeconds?: number;
};

const LOCAL_STORAGE_ROOT = join(process.cwd(), '.data', 'object-storage');
const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

@Injectable()
export class S3StorageClient {
  private client: S3Client | null = null;

  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  /** Clears local disk fallback store (tests). */
  static clearLocalStore(): void {
    if (existsSync(LOCAL_STORAGE_ROOT)) {
      rmSync(LOCAL_STORAGE_ROOT, { recursive: true, force: true });
    }
  }

  buildObjectKey(organizationId: string, relativePath: string): string {
    const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
    if (normalized.length === 0 || normalized.includes('..') || normalized.includes('\0')) {
      throw new Error('Relative object path must not contain parent segments');
    }
    return `org/${organizationId}/${normalized}`;
  }

  /**
   * Ensures a stored object key is scoped to the caller's organization.
   * Rejects cross-org keys and parent-segment traversal.
   */
  assertOrganizationObjectKey(organizationId: string, objectKey: string): void {
    const prefix = `org/${organizationId}/`;
    const normalized = objectKey.replace(/\\/g, '/');
    if (
      !normalized.startsWith(prefix) ||
      normalized.includes('..') ||
      normalized.includes('\0') ||
      normalized.length <= prefix.length
    ) {
      throw new Error('OBJECT_KEY_TENANT_MISMATCH');
    }
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
   * @deprecated Prefer putObject / getObject / getSignedOrLocalUrl.
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

  async putObject(input: PutObjectInput): Promise<{ key: string; mode: 's3' | 'local' }> {
    const key = this.buildObjectKey(input.organizationId, input.relativePath);

    if (this.isConfigured()) {
      const client = this.getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.s3.bucket!,
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
      return { key, mode: 's3' };
    }

    const absolutePath = this.resolveLocalPathFromKey(key);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.body);
    return { key, mode: 'local' };
  }

  /**
   * Fetch by full object key (`org/{orgId}/...`) returned from putObject,
   * or by organizationId + relativePath.
   * Returns null when the object is missing (local or S3 NoSuchKey).
   */
  async getObject(objectKey: string): Promise<GetObjectResult | null>;
  async getObject(organizationId: string, relativePath: string): Promise<GetObjectResult | null>;
  async getObject(
    objectKeyOrOrganizationId: string,
    relativePath?: string,
  ): Promise<GetObjectResult | null> {
    const key =
      relativePath !== undefined
        ? this.buildObjectKey(objectKeyOrOrganizationId, relativePath)
        : objectKeyOrOrganizationId;

    if (key.includes('..') || key.includes('\0')) {
      throw new Error('Object key must not contain parent segments');
    }

    if (this.isConfigured()) {
      try {
        const client = this.getS3Client();
        const result = await client.send(
          new GetObjectCommand({
            Bucket: this.config.s3.bucket!,
            Key: key,
          }),
        );
        const bytes = await this.streamToUint8Array(result.Body);
        return {
          body: bytes,
          contentType: result.ContentType ?? 'application/octet-stream',
          key,
        };
      } catch (error) {
        if (this.isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    }

    try {
      const absolutePath = this.resolveLocalPathFromKey(key);
      await access(absolutePath);
      const body = await readFile(absolutePath);
      return {
        body: new Uint8Array(body),
        contentType: 'application/octet-stream',
        key,
      };
    } catch {
      return null;
    }
  }

  /**
   * When S3 is configured, returns a time-limited pre-signed GET URL.
   * Otherwise returns a relative download path for the local org-scoped store.
   */
  async getSignedOrLocalUrl(
    organizationId: string,
    relativePath: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<ObjectUrlResult> {
    const key = this.buildObjectKey(organizationId, relativePath);

    if (this.isConfigured()) {
      const client = this.getS3Client();
      const command = new GetObjectCommand({
        Bucket: this.config.s3.bucket!,
        Key: key,
      });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return { url, mode: 's3', expiresInSeconds };
    }

    this.resolveLocalPathFromKey(key);
    return {
      url: `/v1/organizations/${organizationId}/object-storage/${encodeURIComponent(relativePath)}`,
      mode: 'local',
    };
  }

  private getS3Client(): S3Client {
    if (this.client !== null) {
      return this.client;
    }
    this.client = new S3Client({
      region: this.config.s3.region,
      endpoint: this.config.s3.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.s3.accessKeyId!,
        secretAccessKey: this.config.s3.secretAccessKey!,
      },
    });
    return this.client;
  }

  /**
   * Maps `org/{orgId}/relative/...` → `.data/object-storage/{orgId}/relative/...`
   * Rejects path escape via normalization + prefix check.
   */
  private resolveLocalPathFromKey(objectKey: string): string {
    const normalized = objectKey.replace(/^\/+/, '').replace(/\\/g, '/');
    if (normalized.length === 0 || normalized.includes('..') || normalized.includes('\0')) {
      throw new Error('Object key must not contain parent segments');
    }

    const match = /^org\/([^/]+)\/(.+)$/.exec(normalized);
    if (match === null) {
      throw new Error('Object key must be org/{organizationId}/...');
    }
    const organizationId = match[1]!;
    const relative = match[2]!;

    if (!existsSync(LOCAL_STORAGE_ROOT)) {
      mkdirSync(LOCAL_STORAGE_ROOT, { recursive: true });
    }

    const orgRoot = resolve(LOCAL_STORAGE_ROOT, organizationId);
    const absolutePath = resolve(orgRoot, ...relative.split('/'));
    const orgRootWithSep = orgRoot.endsWith(sep) ? orgRoot : `${orgRoot}${sep}`;
    if (absolutePath !== orgRoot && !absolutePath.startsWith(orgRootWithSep)) {
      throw new Error('Object path escapes organization storage root');
    }
    return absolutePath;
  }

  private isNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const name = 'name' in error ? String((error as { name: unknown }).name) : '';
    const code =
      '$metadata' in error &&
      typeof (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
        'number'
        ? (error as { $metadata: { httpStatusCode: number } }).$metadata.httpStatusCode
        : undefined;
    return name === 'NoSuchKey' || name === 'NotFound' || code === 404;
  }

  private async streamToUint8Array(body: unknown): Promise<Uint8Array> {
    if (body === undefined || body === null) {
      return new Uint8Array();
    }
    if (body instanceof Uint8Array) {
      return body;
    }
    if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
      const transformable = body as { transformToByteArray: () => Promise<Uint8Array> };
      return transformable.transformToByteArray();
    }
    const chunks: Buffer[] = [];
    const readable = body as Readable;
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
    }
    return new Uint8Array(Buffer.concat(chunks));
  }
}
