import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMasterConnectorDto } from './dto/create-master-connector.dto';
import { UpdateMasterConnectorDto } from './dto/update-master-connector.dto';
import axios from 'axios';

import { parse } from 'csv-parse/sync';

import { UsersService } from '../users/users.service';

@Injectable()
export class MasterConnectorsService {
  private readonly logger = new Logger(MasterConnectorsService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async create(data: CreateMasterConnectorDto, user: any) {
    const userId = user?.id || user?.userId;
    const username = user?.username || user?.preferred_username;
    const { allowedAppIds, ...rest } = data;

    return this.prisma.masterConnector.create({
      data: {
        ...rest,
        ownerId: userId,
        createdBy: username,
        updatedBy: username,
        config: data.config ?? {},
        mapping: data.mapping ?? {},
        allowedApps: allowedAppIds
          ? {
              connect: allowedAppIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });
  }

  async findAll(user: any) {
    const userId = user.id || user.userId;
    const username = user.username || user.preferred_username;

    // 1. Find apps where the user is an admin
    // adminIds can contain UUID or username
    const adminApps = await this.prisma.applicationDefinition.findMany({
      where: {
        AND: [
          {
            OR: [
              { adminIds: { has: userId } },
              { adminIds: { has: username } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    const adminAppIds = adminApps.map((app) => app.id);

    const connectors = await this.prisma.masterConnector.findMany({
      where: {
        OR: [
          { isShared: true },
          { ownerId: userId },
          // Include connectors that are allowed for apps where the user is an admin
          {
            allowedApps: {
              some: {
                id: { in: adminAppIds },
              },
            },
          },
        ],
      },
      include: {
        allowedApps: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with user info
    return Promise.all(
      connectors.map(async (c) => {
        let createdByInfo: any = null;
        let updatedByInfo: any = null;
        if (c.createdBy) {
          createdByInfo = await this.usersService.getUserSnapshotByUsername(
            c.createdBy,
          );
        }
        if (c.updatedBy) {
          updatedByInfo = await this.usersService.getUserSnapshotByUsername(
            c.updatedBy,
          );
        }
        return {
          ...c,
          createdByInfo,
          updatedByInfo,
        };
      }),
    );
  }

  async findOne(id: string) {
    const connector = (await this.prisma.masterConnector.findUnique({
      where: { id },
      include: {
        allowedApps: {
          select: { id: true, name: true },
        },
      },
    })) as any;
    if (!connector) {
      throw new NotFoundException(`Connector with ID ${id} not found`);
    }

    if (connector.createdBy) {
      connector.createdByInfo =
        await this.usersService.getUserSnapshotByUsername(connector.createdBy);
    }
    if (connector.updatedBy) {
      connector.updatedByInfo =
        await this.usersService.getUserSnapshotByUsername(connector.updatedBy);
    }

    return connector;
  }

  async update(id: string, data: UpdateMasterConnectorDto, user?: any) {
    await this.findOne(id);
    const { allowedAppIds, ...rest } = data;
    const username = user?.username || user?.preferred_username;

    return this.prisma.masterConnector.update({
      where: { id },
      data: {
        ...rest,
        updatedBy: username, // Update updatedBy
        config: data.config ?? undefined,
        mapping: data.mapping ?? undefined,
        allowedApps: allowedAppIds
          ? {
              set: allowedAppIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.masterConnector.delete({
      where: { id },
    });
  }

  async proxy(id: string, query: string) {
    const connector = await this.findOne(id);

    if (connector.type === 'rest') {
      return this.executeRestProxy(connector, query);
    }
    if (connector.type === 'csv') {
      return this.executeCsvProxy(connector, query);
    }

    return [];
  }

  async getDataItems(id: string) {
    // Return raw data items for preview (limit 50)
    const items = await this.prisma.masterDataItem.findMany({
      where: { connectorId: id },
      take: 50,
      orderBy: { id: 'asc' }, // stable order
    });
    return items.map((item) => item.data);
  }

  async test(config: any, mapping: any, query: string, type?: string) {
    // Mock a connector object
    const connector = { config, mapping, type: type || config.type || 'rest' };
    if (connector.type === 'rest') {
      return this.executeRestProxy(connector, query);
    }
    if (connector.type === 'csv') {
      // For CSV testing
      // If it is a dry-run without ID, we can't test unless we upload file first.
      // But usually test is run on edit page.
      // If we want to simulate search against uploaded data for current edited connector...
      // Use config.id if available? Or we need ID passed from frontend test payload?
      // Actually frontend passes 'id' in URL for saving, but test endpoint is generic.
      // For now, let's assume if type is CSV, we return empty list OR
      // if we really want to test, we need the Connector ID to fetch data.
      // BUT: the test payload currently doesn't include connector ID.
      // So we can't really search against DB without ID.

      // FIXME: To properly test CSV, we need the connector ID.
      // However, seeing the previous implementation of executeCsvProxy, it relies on connector.id.
      // If we don't have it, we return [].

      // Let's assume for now this test is just a syntax check or dry run
      // If we want to support real data search, we need to pass ID.
      return [];
    }
    return [];
  }

  async importCsv(id: string, buffer: Buffer) {
    // Validate connector exists
    await this.findOne(id);

    // Parse CSV
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    this.logger.log(`Parsed ${records.length} records for connector ${id}`);

    // Transaction: Delete old items, insert new ones
    await this.prisma.$transaction(async (tx) => {
      await tx.masterDataItem.deleteMany({
        where: { connectorId: id },
      });

      // Insert in chunks if needed, but for now simple createMany
      // Note: createMany is not supported for SQLite if we were using it, but we are on Postgres.
      // However, to be safe with large datasets, chunking is good.
      const chunkSize = 1000;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        await tx.masterDataItem.createMany({
          data: chunk.map((record) => ({
            connectorId: id,
            data: record as any,
          })),
        });
      }
    });

    return { count: records.length };
  }

  private async executeCsvProxy(connector: any, query: string) {
    const mapping = connector.mapping || {};
    const labelKey = mapping.label; // The key in JSON to search against

    if (!labelKey) {
      return [];
    }

    // Note: Using memory filtering for now - consider raw query for large datasets
    // where: { data: { path: [labelKey], string_contains: query } } -> string_contains is case sensitive

    // Better approach: Prisma raw query
    // const rawItems = await this.prisma.$queryRaw`
    //    SELECT * FROM "master_data_items"
    //    WHERE "connector_id" = ${connector.id}
    //    AND "data"->>${labelKey} ILIKE ${'%' + query + '%'}
    //    LIMIT 50
    // `;
    // TypeScript issues might occur with $queryRaw matching types.

    // Let's implement memory filtering for now as a safe MVP step, then optimize.
    // Fetching ONLY connector items.
    const allItems = await this.prisma.masterDataItem.findMany({
      where: { connectorId: connector.id },
      take: 2000, // Limit to avoid memory explosion
    });

    const filtered = allItems
      .filter((item) => {
        if (!query) return true;
        const val = (item.data as any)[labelKey];
        return val && String(val).toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, 50); // Limit results

    // Normalize
    return filtered.map((item) => {
      const row = item.data;
      const label = this.getValueByPath(row, mapping.label) || 'Unknown';
      const value = this.getValueByPath(row, mapping.value) || 'unknown';

      // Metadata
      const metadata: any = {};
      const metaMap = mapping.metadata || {};
      for (const [key, path] of Object.entries(metaMap)) {
        const val = this.getValueByPath(row, path as string);
        if (val !== undefined) {
          metadata[key] = val;
        }
      }

      return {
        label: String(label),
        value: String(value),
        metadata,
      };
    });
  }

  private async executeRestProxy(connector: any, query: string) {
    const config = connector.config || {};
    const mapping = connector.mapping || {};

    let url = config.url as string;
    const method = config.method || 'GET';
    const headers = config.headers || {};
    const authType = config.authType;

    // Inject Auth
    if (authType === 'bearer' && config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    } else if (authType === 'basic' && config.authUsername) {
      const token = Buffer.from(
        `${config.authUsername}:${config.authPassword}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    } else if (authType === 'apikey') {
      if (config.authApiKeyIn === 'header') {
        headers[config.authApiKeyName] = config.authApiKeyValue;
      } else {
        // Append to URL (handled below or need logic)
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}${config.authApiKeyName}=${config.authApiKeyValue}`;
      }
    }

    // Inject Query Parameter (GET ONLY usually)
    const queryParamName = config.queryParamName || 'q';
    if (method === 'GET' && query && queryParamName) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}${queryParamName}=${encodeURIComponent(query)}`;
    }

    // Handle Body for POST/PUT
    let dataPayload = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method) && config.body) {
      let bodyStr = config.body;
      if (query) {
        bodyStr = bodyStr.replace(/\{\{q\}\}/g, query);
      }

      try {
        dataPayload = JSON.parse(bodyStr);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      } catch {
        // Send as string/text if not JSON
        dataPayload = bodyStr;
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'text/plain';
        }
      }
    }

    this.logger.log(`Proxying to ${method} ${url}`);

    try {
      const response = await axios({
        url,
        method,
        headers,
        data: dataPayload,
      });

      const data = response.data;

      // Data Root Path (if list is nested, e.g. { results: [...] })
      const rootPath = mapping.rootPath;
      let list = data;
      if (rootPath) {
        list = this.getValueByPath(data, rootPath);
      }

      if (!Array.isArray(list)) {
        this.logger.warn(`Response is not an array (rootPath: ${rootPath})`);
        return [];
      }

      // Normalize
      return list.map((item) => {
        const label =
          this.getValueByPath(item, mapping.label || 'name') || 'Unknown';
        const value =
          this.getValueByPath(item, mapping.value || 'id') || 'unknown';

        // Metadata
        const metadata: any = {};
        const metaMap = mapping.metadata || {};
        for (const [key, path] of Object.entries(metaMap)) {
          const val = this.getValueByPath(item, path as string);
          if (val !== undefined) {
            metadata[key] = val;
          }
        }

        return {
          label: String(label),
          value: String(value),
          metadata,
        };
      });
    } catch (error) {
      this.logger.error(`Proxy failed: ${String(error)}`);
      throw error;
    }
  }

  private getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    if (path === '$' || path === '') return obj;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
}
