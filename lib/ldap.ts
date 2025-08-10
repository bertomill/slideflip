import { Client } from 'ldapjs';

export interface LDAPConfig {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  userSearchBase: string;
  userSearchFilter: string;
  groupSearchBase?: string;
  groupSearchFilter?: string;
}

export interface LDAPUser {
  dn: string;
  uid: string;
  cn: string;
  email: string;
  givenName?: string;
  sn?: string;
  memberOf?: string[];
}

export class LDAPClient {
  private config: LDAPConfig;

  constructor(config: LDAPConfig) {
    this.config = config;
  }

  private createClient(): Client {
    const client = new Client({
      url: this.config.url,
      timeout: 5000,
      connectTimeout: 5000,
    });
    return client;
  }

  async authenticate(username: string, password: string): Promise<LDAPUser | null> {
    const client = this.createClient();

    try {
      // First, bind with admin credentials to search for the user
      await new Promise<void>((resolve, reject) => {
        client.bind(this.config.bindDN, this.config.bindPassword, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Search for the user
      const searchFilter = this.config.userSearchFilter.replace('{username}', username);
      const searchResult = await new Promise<LDAPUser | null>((resolve, reject) => {
        client.search(this.config.userSearchBase, {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', 'uid', 'cn', 'mail', 'givenName', 'sn', 'memberOf']
        }, (err, search) => {
          if (err) {
            reject(err);
            return;
          }

          let user: LDAPUser | null = null;

          search.on('searchEntry', (entry) => {
            const attributes = entry.pojo.attributes;
            user = {
              dn: entry.pojo.objectName || '',
              uid: this.getAttributeValue(attributes, 'uid') || username,
              cn: this.getAttributeValue(attributes, 'cn') || '',
              email: this.getAttributeValue(attributes, 'mail') || '',
              givenName: this.getAttributeValue(attributes, 'givenName'),
              sn: this.getAttributeValue(attributes, 'sn'),
              memberOf: this.getAttributeValues(attributes, 'memberOf'),
            };
          });

          search.on('error', reject);
          search.on('end', () => resolve(user));
        });
      });

      if (!searchResult) {
        return null;
      }

      // Now try to bind with the user's credentials to verify password
      await new Promise<void>((resolve, reject) => {
        client.bind(searchResult.dn, password, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return searchResult;

    } catch (error) {
      console.error('LDAP authentication error:', error);
      return null;
    } finally {
      client.unbind();
    }
  }

  private getAttributeValue(attributes: any[], name: string): string | undefined {
    const attr = attributes.find(a => a.type === name);
    return attr?.values?.[0];
  }

  private getAttributeValues(attributes: any[], name: string): string[] | undefined {
    const attr = attributes.find(a => a.type === name);
    return attr?.values;
  }

  async testConnection(): Promise<boolean> {
    const client = this.createClient();

    try {
      await new Promise<void>((resolve, reject) => {
        client.bind(this.config.bindDN, this.config.bindPassword, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return true;
    } catch (error) {
      console.error('LDAP connection test failed:', error);
      return false;
    } finally {
      client.unbind();
    }
  }
}

export function createLDAPClient(): LDAPClient {
  const config: LDAPConfig = {
    url: process.env.LDAP_URL!,
    baseDN: process.env.LDAP_BASE_DN!,
    bindDN: process.env.LDAP_BIND_DN!,
    bindPassword: process.env.LDAP_BIND_PASSWORD!,
    userSearchBase: process.env.LDAP_USER_SEARCH_BASE!,
    userSearchFilter: process.env.LDAP_USER_SEARCH_FILTER!,
    groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE,
    groupSearchFilter: process.env.LDAP_GROUP_SEARCH_FILTER,
  };

  return new LDAPClient(config);
}