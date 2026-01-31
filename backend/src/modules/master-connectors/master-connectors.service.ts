import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMasterConnectorDto } from './dto/create-master-connector.dto';
import { UpdateMasterConnectorDto } from './dto/update-master-connector.dto';
import axios from 'axios';

@Injectable()
export class MasterConnectorsService {
  private readonly logger = new Logger(MasterConnectorsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: CreateMasterConnectorDto, userId: string) {
    return this.prisma.masterConnector.create({
      data: {
        ...data,
        ownerId: userId,
        config: data.config ?? {},
        mapping: data.mapping ?? {},
      },
    });
  }

  async findAll() {
    return this.prisma.masterConnector.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const connector = await this.prisma.masterConnector.findUnique({
      where: { id },
    });
    if (!connector) {
      throw new NotFoundException(`Connector with ID ${id} not found`);
    }
    return connector;
  }

  async update(id: string, data: UpdateMasterConnectorDto) {
    await this.findOne(id);
    return this.prisma.masterConnector.update({
      where: { id },
      data: {
        ...data,
        config: data.config ?? undefined,
        mapping: data.mapping ?? undefined,
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
    
    // Future: SQL, CSV
    return [];
  }

  async test(config: any, mapping: any, query: string) {
      // Mock a connector object
      const connector = { config, mapping, type: 'rest' }; 
      if (connector.type === 'rest') {
          return this.executeRestProxy(connector, query);
      }
      return [];
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
          const token = Buffer.from(`${config.authUsername}:${config.authPassword}`).toString('base64');
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

      // Inject Query Parameter
      // Setup mapping: user says where to put the keyword. e.g. "q" -> ?q=keyword
      const queryParamName = config.queryParamName || 'q';
      if (query && queryParamName) {
           const separator = url.includes('?') ? '&' : '?';
           url += `${separator}${queryParamName}=${encodeURIComponent(query)}`;
      }

      this.logger.log(`Proxying to ${method} ${url}`);

      try {
          const response = await axios({
              url,
              method,
              headers,
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
          return list.map(item => {
              const label = this.getValueByPath(item, mapping.label || 'name') || 'Unknown';
              const value = this.getValueByPath(item, mapping.value || 'id') || 'unknown';
              
              // Metadata
              const metadata: any = {};
              const metaMap = mapping.metadata || {};
              for (const [key, path] of Object.entries(metaMap)) {
                  const val = this.getValueByPath(item, path as string);
                  if (val !== undefined) {
                      metadata[key] = val;
                  }
              }

              // this.logger.debug(`Mapped item: label=${label}, value=${value}, metadata=${JSON.stringify(metadata)}`);

              return {
                  label: String(label),
                  value: String(value),
                  metadata
              };
          });

      } catch (error) {
          this.logger.error(`Proxy failed: ${error}`);
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
