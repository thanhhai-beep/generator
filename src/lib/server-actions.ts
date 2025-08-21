
'use server';

import * as cheerio from 'cheerio';
import { URL } from 'url';
import { ALL_CATEGORIES } from '@/lib/categories';
import { CATEGORY_KEYWORDS } from '@/lib/keywords';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getAuth } from 'firebase/auth';
import { auth as clientAuth } from '@/lib/firebase';
import { listAllUsersAdmin, deleteUserAdmin, updateUserPermissionsAdmin, getFirebaseAdmin, getUserPermissionsAdmin } from '@/lib/firebase-admin';

import type { UserRecord } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type {
  AnalysisResult,
  CloudflareResult,
  CloudflareAddResult,
  CloudflareDomainInput,
  CloudflareDeleteResult,
  CloudflareStatusResult,
  DnsRecord,
  DnsRecordInput,
  BulkDnsActionResult,
  ArticleData,
  CrawlResultChild,
  CrawlResultCategory,
  GistResult,
  PagesProject,
  PagesDeployment,
  CreatePagesProjectInput,
  DirectUploadResult,
  DeploymentPair,
  DeploymentPairWithContent,
  GistInput,
  GistApiResponse,
  GistInfo,
  GistsApiResponse,
  WriteAsPostInput,
  WriteAsResult,
  GitLabProject,
  GitLabProjectResult,
  GitLabGroup,
  GitLabGroupsResult,
  GitLabBulkProjectInput,
  GitLabBulkProjectResult,
  UpdateReadmeResult,
  TestProxyResult,
  HashnodePostInput,
  HashnodePostResult,
  ReadmeTemplate,
  ReadmeTemplateInput,
  UserPermissionData
} from '@/app/actions';


async function cfApiRequest(endpoint: string, apiToken: string, authEmail?: string, globalApiKey?: string, options: RequestInit = {}) {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };

    if (globalApiKey && authEmail) {
        headers['X-Auth-Key'] = globalApiKey;
        headers['X-Auth-Email'] = authEmail;
    } else {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(url, { ...options, headers });
    return response.json();
}


async function findZoneId(domain: string, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<{id: string} | {success: false, message: string}> {
    const findZoneData = await cfApiRequest(`/zones?name=${domain}`, apiToken, authEmail, globalApiKey);
    
    if (!findZoneData.success || findZoneData.result.length === 0) {
        const error = findZoneData.errors?.[0]?.message || 'Domain not found on Cloudflare account.';
        return { success: false, message: error };
    }
    
    return { id: findZoneData.result[0].id };
}


export async function checkCloudflareDomainsStatus(domains: string[], apiToken: string, globalApiKey?: string, authEmail?: string): Promise<CloudflareStatusResult[]> {
  if (!domains || domains.length === 0) {
    return [];
  }

  if (!apiToken && !(globalApiKey && authEmail)) {
    return domains.map(domain => ({
      domain,
      success: false,
      message: 'Cloudflare API Token is not provided.',
    }));
  }

  const results: CloudflareStatusResult[] = [];

  for (const domain of domains) {
    try {
      const findZoneData = await cfApiRequest(`/zones?name=${domain}`, apiToken, authEmail, globalApiKey);

      if (!findZoneData.success || findZoneData.result.length === 0) {
        const error = findZoneData.errors?.[0]?.message || 'Domain not found on Cloudflare account.';
        results.push({ domain, success: false, message: error });
      } else {
        const zone = findZoneData.result[0];
        results.push({
          domain,
          success: true,
          message: `Status is '${zone.status}'.`,
          cloudflare_status: zone.status,
        });
      }
    } catch (error: any) {
      console.error(`Error checking status for ${domain}:`, error);
      results.push({ domain, success: false, message: error.message || 'An unknown network error occurred.' });
    }
  }
  return results;
}


export async function deleteMultipleCloudflareDomains(domainsToDelete: string[], apiToken: string, globalApiKey?: string, authEmail?: string): Promise<CloudflareDeleteResult[]> {
    if (!domainsToDelete || domainsToDelete.length === 0) {
        return [];
    }
    
    const results: CloudflareDeleteResult[] = [];
    // Process requests sequentially to avoid hitting API rate limits
    for (const domain of domainsToDelete) {
        const result = await deleteCloudflareDomain(domain, apiToken, authEmail, globalApiKey);
        results.push(result);
    }
    
    return results;
}

export async function deleteCloudflareDomain(domain: string, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<CloudflareDeleteResult> {
    if (!apiToken && !(globalApiKey && authEmail)) {
        return {
            domain,
            success: false,
            message: 'Cloudflare API Token is not provided.',
        };
    }
    
    try {
        const zoneIdResult = await findZoneId(domain, apiToken, authEmail, globalApiKey);
        if ('success' in zoneIdResult && !zoneIdResult.success) {
            return { domain, success: false, message: zoneIdResult.message };
        }
        const zoneId = (zoneIdResult as { id: string }).id;
        
        const deleteZoneData = await cfApiRequest(`/zones/${zoneId}`, apiToken, authEmail, globalApiKey, { method: 'DELETE' });
        
        if (!deleteZoneData.success) {
            const error = deleteZoneData.errors[0];
            return { domain, success: false, message: `Cloudflare API Error (Deleting Zone): ${error.message}` };
        }
        
        return { domain, success: true, message: 'Domain successfully deleted from Cloudflare.' };
        
    } catch (error: any) {
        console.error('Error deleting Cloudflare domain:', error);
        return { domain, success: false, message: error.message || 'An unknown network error occurred.' };
    }
}


export async function addMultipleCloudflareDomains(domainsToProcess: CloudflareDomainInput[], accountId: string, apiToken: string, globalApiKey?: string, authEmail?: string): Promise<CloudflareAddResult[]> {

  if (!domainsToProcess || domainsToProcess.length === 0) {
    return [];
  }

  const results: CloudflareAddResult[] = [];
  // Process requests sequentially to avoid hitting API rate limits
  for (const { domain, ipAddress, records, sslMode } of domainsToProcess) {
    let result: CloudflareAddResult;

    if (!domain || !ipAddress || !records || records.length === 0) {
      result = {
        domain: domain || 'Invalid Entry',
        success: false,
        message: 'Invalid input. Domain, IP, and at least one record type are required.',
      };
    } else {
      const singleResult = await addCloudflareDomain(domain, ipAddress, records, sslMode, accountId, apiToken, globalApiKey, authEmail);
      result = {
        domain,
        success: singleResult.success,
        message: singleResult.message,
        name_servers: singleResult.data?.name_servers,
        cloudflare_status: singleResult.data?.status,
      };
    }
    results.push(result);
  }

  return results;
}

export async function addCloudflareDomain(domain: string, ipAddress: string, records: string[], sslMode: 'full' | 'flexible', accountId: string, apiToken: string, globalApiKey?: string, authEmail?: string): Promise<CloudflareResult> {
  if (!accountId || (!apiToken && !(globalApiKey && authEmail))) {
    return { 
      success: false, 
      message: 'Cloudflare credentials are not set.' 
    };
  }

  try {
    const zoneData = await cfApiRequest(`/zones`, apiToken, authEmail, globalApiKey, {
      method: 'POST',
      body: JSON.stringify({
        name: domain,
        account: { id: accountId },
        jump_start: false,
      }),
    });


    if (!zoneData.success) {
      const error = zoneData.errors[0];
      if (error.code === 1061) { // Zone already exists
         const existingZone = await findZoneId(domain, apiToken, authEmail, globalApiKey);
         if ('id' in existingZone) {
             const zoneId = existingZone.id;
             // Here you could decide to just proceed with adding DNS records to the existing zone
             // For now, we'll return a specific message.
             return { success: false, message: `Zone already exists. Zone ID: ${zoneId}` };
         }
      }
      return { success: false, message: `Cloudflare API Error (Adding Zone): ${error.message}` };
    }

    const zoneId = zoneData.result.id;
    const nameServers = zoneData.result.name_servers;
    const status = zoneData.result.status;

    for (const record of records) {
        const recordName = record === '@' ? domain : `${record}.${domain}`;
        const dnsData = await cfApiRequest(`/zones/${zoneId}/dns_records`, apiToken, authEmail, globalApiKey, {
            method: 'POST',
            body: JSON.stringify({
                type: 'A',
                name: recordName,
                content: ipAddress,
                ttl: 1, 
                proxied: true,
            }),
        });
        
        if (!dnsData.success) {
          const error = dnsData.errors[0];
          await cfApiRequest(`/zones/${zoneId}`, apiToken, authEmail, globalApiKey, { method: 'DELETE' });
          return { success: false, message: `Cloudflare API Error (Creating '${recordName}' record): ${error.message}. The created zone has been removed.` };
        }
    }

    const sslData = await cfApiRequest(`/zones/${zoneId}/settings/ssl`, apiToken, authEmail, globalApiKey, {
        method: 'PATCH',
        body: JSON.stringify({ value: sslMode }),
    });

    if (!sslData.success) {
      console.warn(`Failed to set SSL mode for ${domain}:`, sslData.errors?.[0]?.message);
      return {
        success: true,
        message: `Domain and records added, but failed to set SSL mode to '${sslMode}'`,
        data: { name: domain, name_servers: nameServers, status },
      };
    }

    return {
      success: true,
      message: `Domain, records, and SSL mode '${sslMode}' set successfully!`,
      data: { name: domain, name_servers: nameServers, status },
    };

  } catch (error: any) {
    console.error('Error adding Cloudflare domain:', error);
    return { success: false, message: error.message || 'An unknown network error occurred.' };
  }
}

export async function analyzeDomains(domainsText: string): Promise<AnalysisResult[]> {
  const domains = domainsText
    .split('\n')
    .map(d => d.trim())
    .filter(d => d.length > 0);
  
  if (domains.length === 0) {
    return [];
  }

  const analysisPromises = domains.map(async (domain): Promise<AnalysisResult> => {
    let url = domain;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://` + url;
    }

    try {
      // Use AbortSignal.timeout for a 30-second timeout on each request
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000), 
      });

      const status = response.status;
      const statusText = response.statusText;
      let title = 'N/A';
      
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('text/html')) {
        const html = await response.text();
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        title = titleMatch ? titleMatch[1].trim() : 'No title tag found';
      } else if (!response.ok) {
          title = `Error: ${statusText}`;
      }

      return { domain, status, statusText, title };
    } catch (error: any) {
      let statusText = 'Fetch Error';
      let title = 'Could not reach domain.';
      
      if (error.name === 'TimeoutError') {
        statusText = 'Timeout Error';
        title = 'Request timed out after 30 seconds.';
      } else if (error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
          const errorCode = (error.cause as { code: string }).code;
          title = `Error: ${errorCode}`;
      }

      return {
        domain,
        status: 0,
        statusText,
        title,
      };
    }
  });

  // Use Promise.allSettled to ensure all promises complete, even if some fail.
  // This makes the process resilient and isolates failures.
  const settledResults = await Promise.allSettled(analysisPromises);
  
  return settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // This fallback handles unexpected errors within the promise itself, though the inner try/catch should prevent this.
      return {
        domain: domains[index],
        status: 0,
        statusText: 'Unhandled Error',
        title: result.reason?.message || 'An unknown error occurred during analysis.',
      };
    }
  });
}

export async function listDnsRecords(domain: string, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<{ success: boolean; records?: DnsRecord[]; message: string; }> {
  if (!apiToken && !(authEmail && globalApiKey)) {
    return { success: false, message: 'Cloudflare credentials not set.' };
  }

  const zoneIdResult = await findZoneId(domain, apiToken, authEmail, globalApiKey);
  if ('success' in zoneIdResult && !zoneIdResult.success) {
    return { success: false, message: zoneIdResult.message };
  }
  const zoneId = (zoneIdResult as { id: string }).id;

  try {
    const data = await cfApiRequest(`/zones/${zoneId}/dns_records`, apiToken, authEmail, globalApiKey);
    if (!data.success) {
      return { success: false, message: data.errors[0].message };
    }
    return { success: true, records: data.result, message: 'Records fetched successfully.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'An unknown network error occurred.' };
  }
}

export async function addDnsRecord(domain: string, record: DnsRecordInput, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<{ success: boolean; message: string }> {
  if (!apiToken && !(authEmail && globalApiKey)) return { success: false, message: 'Cloudflare credentials not set.' };
  
  const zoneIdResult = await findZoneId(domain, apiToken, authEmail, globalApiKey);
  if ('success' in zoneIdResult && !zoneIdResult.success) { return { success: false, message: zoneIdResult.message }; }
  const zoneId = (zoneIdResult as { id: string }).id;


  try {
    const data = await cfApiRequest(`/zones/${zoneId}/dns_records`, apiToken, authEmail, globalApiKey, {
      method: 'POST',
      body: JSON.stringify(record),
    });
    if (!data.success) return { success: false, message: data.errors.map((e:any) => e.message).join(', ') };
    return { success: true, message: 'DNS Record added successfully.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'An unknown network error occurred.' };
  }
}

export async function updateDnsRecord(domain: string, recordId: string, record: DnsRecordInput, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<{ success: boolean; message: string }> {
  if (!apiToken && !(authEmail && globalApiKey)) return { success: false, message: 'Cloudflare credentials not set.' };

  const zoneIdResult = await findZoneId(domain, apiToken, authEmail, globalApiKey);
  if ('success' in zoneIdResult && !zoneIdResult.success) { return { success: false, message: zoneIdResult.message }; }
  const zoneId = (zoneIdResult as { id: string }).id;

  try {
    const data = await cfApiRequest(`/zones/${zoneId}/dns_records/${recordId}`, apiToken, authEmail, globalApiKey, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
    if (!data.success) return { success: false, message: data.errors.map((e:any) => e.message).join(', ') };
    return { success: true, message: 'DNS Record updated successfully.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'An unknown network error occurred.' };
  }
}

export async function deleteDnsRecord(domain: string, recordId: string, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<{ success: boolean; message: string }> {
  if (!apiToken && !(authEmail && globalApiKey)) return { success: false, message: 'Cloudflare credentials not set.' };
  
  const zoneIdResult = await findZoneId(domain, apiToken, authEmail, globalApiKey);
  if ('success' in zoneIdResult && !zoneIdResult.success) {
      return { success: false, message: zoneIdResult.message };
  }
  const zoneId = (zoneIdResult as { id: string }).id;

  try {
    const data = await cfApiRequest(`/zones/${zoneId}/dns_records/${recordId}`, apiToken, authEmail, globalApiKey, {
      method: 'DELETE',
    });
    if (!data.success) return { success: false, message: data.errors.map((e:any) => e.message).join(', ') };
    return { success: true, message: 'DNS Record deleted successfully.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'An unknown network error occurred.' };
  }
}

export async function bulkAddDnsRecord(domainNames: string[], record: DnsRecordInput, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<BulkDnsActionResult[]> {
    if (!apiToken && !(authEmail && globalApiKey)) {
        return domainNames.map(domain => ({ domain, success: false, message: 'Cloudflare credentials are not set.' }));
    }
    
    const results: BulkDnsActionResult[] = [];

    for (const domain of domainNames) {
        const recordToAdd = { ...record, name: record.name === '@' ? domain : `${record.name}.${domain}` };

        try {
            const addResult = await addDnsRecord(domain, recordToAdd, apiToken, authEmail, globalApiKey);
            results.push({ domain, success: addResult.success, message: addResult.message });
        } catch (error: any) {
            results.push({ domain, success: false, message: error.message || 'An unknown network error occurred.' });
        }
    }
    return results;
}

export async function bulkDeleteDnsRecords(domainNames: string[], recordMatcher: { type: string, name: string }, apiToken: string, authEmail?: string, globalApiKey?: string): Promise<BulkDnsActionResult[]> {
     if (!apiToken && !(authEmail && globalApiKey)) {
        return domainNames.map(domain => ({ domain, success: false, message: 'Cloudflare credentials are not set.' }));
    }

    const results: BulkDnsActionResult[] = [];
    for (const domain of domainNames) {
        const listResult = await listDnsRecords(domain, apiToken, authEmail, globalApiKey);
        if (!listResult.success || !listResult.records) {
            results.push({ domain, success: false, message: `Failed to list records: ${listResult.message}` });
            continue;
        }

        const nameToDelete = recordMatcher.name === '@' ? domain : `${recordMatcher.name}.${domain}`;
        const recordsToDelete = listResult.records.filter(r => r.type === recordMatcher.type && r.name === nameToDelete);

        if (recordsToDelete.length === 0) {
            results.push({ domain, success: true, message: `No matching record found to delete.` });
            continue;
        }

        let allDeletionsSucceeded = true;
        let deletionMessages = [];
        
        for (const record of recordsToDelete) {
            const deleteResult = await deleteDnsRecord(domain, record.id, apiToken, authEmail, globalApiKey);
            if (!deleteResult.success) {
                allDeletionsSucceeded = false;
                deletionMessages.push(`Failed to delete record ID ${record.id}: ${deleteResult.message}`);
            }
        }

        if (allDeletionsSucceeded) {
            results.push({ domain, success: true, message: `Successfully deleted ${recordsToDelete.length} matching record(s).` });
        } else {
            results.push({ domain, success: false, message: deletionMessages.join('; ') });
        }
    }
    return results;
}


export async function scrapeProthomaloArticles(): Promise<{ success: boolean; data?: ArticleData[]; message?: string; }> {
  const baseUrl = "https://www.prothomalo.com";
  const MAX_ARTICLES = 50; 

  try {
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000), 
    });

    if (!response.ok) {
      return { success: false, message: `Failed to fetch homepage. Status: ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const articleLinks: { url: string; title: string; description: string }[] = [];
    const seenUrls = new Set<string>();

    $('.content-area h2 a, .content-area h3 a, .list-item a.link_overlay, a.bn-story-card, .news_title a').each((i, el) => {
      if (seenUrls.size >= MAX_ARTICLES) {
        return false; // break loop
      }
      
      let url = $(el).attr('href');
      const title = $(el).text().trim();

      if (url && title) {
        if (url.startsWith('/')) {
          url = `${baseUrl}${url}`;
        }

        if (!seenUrls.has(url) && url.includes('prothomalo.com') && !url.includes('/photo/')) {
          const description = $(el).closest('div, li, article').find('p, .intro, .bn-story-summary').text().trim();
          articleLinks.push({ url, title, description: description || 'No description found.' });
          seenUrls.add(url);
        }
      }
    });

    if (articleLinks.length === 0) {
      return { success: false, message: "Could not find any article links. The site structure may have changed." };
    }
    
    const articles: ArticleData[] = [];
    for (const { url, title, description } of articleLinks) {
        try {
            const articleResponse = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!articleResponse.ok) continue;

            const articleHtml = await articleResponse.text();
            const $$ = cheerio.load(articleHtml);

            let content = '';
            $$('div.story-element.story-element-text, .palo-story-element-text').each((i, el) => {
              content += $$(el).html() || '';
            });
            
            if (content.trim()) {
                articles.push({ title, description, url, content: content.trim() });
            }
        } catch (e) {
            console.warn(`Could not fetch content for ${url}`, e);
            continue;
        }
    }
    
    if (articles.length === 0) {
        return { success: false, message: "Found links, but failed to scrape content from any article page." };
    }

    return { success: true, data: articles };

  } catch (error: any) {
    console.error("Error in scrapeProthomaloArticles:", error);
    if (error.name === 'TimeoutError') {
      return { success: false, message: 'The request to the homepage timed out.' };
    }
    return { success: false, message: error.message || 'An unknown scraping error occurred.' };
  }
}

export async function isGoogleSearchConfigured(): Promise<boolean> {
    return !!process.env.GOOGLE_API_KEY && !!process.env.GOOGLE_CSE_ID;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 20000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

export async function crawlSite(
  baseLink: string,
  maxCards: number
): Promise<{ success: boolean; data?: CrawlResultCategory[]; message: string }> {
  try {
    const mainResponse = await fetchWithTimeout(baseLink, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
    if (!mainResponse.ok) {
      return { success: false, message: `Failed to load main page. Status: ${mainResponse.status}` };
    }
    const mainHtml = await mainResponse.text();
    const $ = cheerio.load(mainHtml);

    const categoryLinks: { url: string; title: string }[] = [];
    $('.category-container a.category-bottom').each((i, el) => {
      const url = $(el).attr('href');
      const title = $(el).text().trim();
      if (url) {
        categoryLinks.push({ url, title });
      }
    });

    if (categoryLinks.length === 0) {
      return { success: false, message: 'No category links found on the main page. The selector `.category-container a.category-bottom` might be wrong.' };
    }

    const categoryPromises = categoryLinks.slice(0, maxCards).map(async (catLink) => {
        try {
            const catResponse = await fetchWithTimeout(catLink.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
            if (!catResponse.ok) {
              console.warn(`Could not fetch category page ${catLink.url}. Status: ${catResponse.status}`);
              return null;
            }
            const catHtml = await catResponse.text();
            const $$ = cheerio.load(catHtml);

            const children: CrawlResultChild[] = [];
            
            $$('.url_links_wrapper').each((i, siteWrapper) => {
                const siteWrapperEl = $$(siteWrapper);
                const descriptionBox = siteWrapperEl.find('.link-details-review');
                const content = descriptionBox.length ? descriptionBox.html()?.trim() || '' : '';
                const description = cheerio.load(content).text().trim();

                siteWrapperEl.find('.url_link_title a.link').each((j, a_tag) => {
                    const href = $$(a_tag).attr('href') || '';
                    const url_site = $$(a_tag).attr('data-site-link') || '';
                    const title = $$(a_tag).text().trim();
                    
                    if (href) {
                        children.push({
                            url: href,
                            url_site: url_site,
                            title: title,
                            img_url: '',
                            img_alt: '',
                            content: content,
                            description: description,
                            processedSteps: ['crawled'],
                        });
                    }
                });
            });
            
            if (children.length > 0) {
                 return {
                  cate_url: catLink.url,
                  cate_name: catLink.title,
                  children: children,
                };
            }
            return null;
        } catch (error: any) {
            console.error(`Error processing category link ${catLink.url}:`, error.message);
            return null;
        }
    });

    const settledResults = await Promise.allSettled(categoryPromises);
    const categoryData = settledResults
        .filter(res => res.status === 'fulfilled' && res.value)
        .map(res => (res as PromiseFulfilledResult<CrawlResultCategory>).value);


    if (categoryData.length === 0) {
        return { success: false, message: 'Could not scrape any app information from the category pages.' };
    }

    return { success: true, data: categoryData, message: `Crawl successful. Found apps in ${categoryData.length} categories.` };

  } catch (error: any) {
    console.error(`Global crawl error for ${baseLink}:`, error);
    return { success: false, message: error.message || 'An unknown error occurred during crawl.' };
  }
}

export async function processCrawledData(
  crawledData: CrawlResultChild[]
): Promise<{ success: boolean; data?: CrawlResultChild[]; message: string }> {

  const processingPromises = crawledData.map(async (child) => {
    const mutableChild: CrawlResultChild = JSON.parse(JSON.stringify(child));

    if (mutableChild.processedSteps.includes('metadata')) {
        return mutableChild;
    }
    
    try {
      let targetUrl = mutableChild.url_site;
      if (targetUrl && targetUrl.includes('pdude.link')) {
        const redirectResponse = await fetchWithTimeout(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
        targetUrl = redirectResponse.url;
        mutableChild.url_site = targetUrl;
      }
      
      if (!targetUrl) {
        throw new Error('No valid original link (url_site) to process for metadata.');
      }
      
      const finalResponse = await fetchWithTimeout(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
      if (finalResponse.ok) {
        const finalHtml = await finalResponse.text();
        const $ = cheerio.load(finalHtml);
        
        mutableChild.keywords = $('meta[name="keywords"]').attr('content')?.trim() || '';
        mutableChild.description = $('meta[name="description"]').attr('content')?.trim() || mutableChild.description;


        let faviconUrl = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
        if (faviconUrl) {
          try {
            new URL(faviconUrl);
            mutableChild.faviconUrl = faviconUrl;
          } catch (_) {
            const baseUrl = new URL(targetUrl).origin;
            mutableChild.faviconUrl = new URL(faviconUrl, baseUrl).href;
          }
        } else {
          mutableChild.faviconUrl = new URL('/favicon.ico', targetUrl).href;
        }
      } else {
        throw new Error(`Failed to fetch original link. Status: ${finalResponse.status}`);
      }

    } catch (error: any) {
      console.error(`Error processing metadata for original URL ${mutableChild.url_site}:`, error.message);
      mutableChild.error = `Metadata processing failed: ${error.message.slice(0, 100)}`;
    }
    
    if (!mutableChild.processedSteps.includes('metadata')) {
      mutableChild.processedSteps.push('metadata');
    }
    
    return mutableChild;
  });

  const settledResults = await Promise.allSettled(processingPromises);

  const enrichedData = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
          return result.value;
      }
      
      const originalChild: CrawlResultChild = JSON.parse(JSON.stringify(crawledData[index]));
      originalChild.error = `Processing failed: ${(result.reason as Error)?.message || 'Unknown error'}`;
      if (!originalChild.processedSteps.includes('metadata')) {
        originalChild.processedSteps.push('metadata');
      }
      return originalChild;
  });

  const hasErrors = enrichedData.some(child => child.error);
  const message = hasErrors ? 'Metadata processing finished with some errors.' : 'Metadata processing complete.';
  return { success: true, data: enrichedData, message };
}


export async function resolveRedirectsInJson(
  jsonContent: string
): Promise<{ success: boolean; data?: string; message: string }> {
  let jsonData: any[];
  try {
    jsonData = JSON.parse(jsonContent);
    if (!Array.isArray(jsonData)) {
      return { success: false, message: 'Invalid JSON format: Input must be an array of objects.' };
    }
  } catch (error) {
    return { success: false, message: 'Failed to parse JSON. Please provide a valid JSON file.' };
  }

  const urlsToResolve = jsonData.filter(item => typeof item.url === 'string' && item.url.includes('pdude.link'));
  
  const totalToResolve = urlsToResolve.length;
  if (totalToResolve === 0) {
      return { success: true, data: jsonContent, message: 'No URLs with "pdude.link" found to resolve.' };
  }
  
  let resolvedCount = 0;
  const finalJsonData = await Promise.all(
    jsonData.map(async (item) => {
      if (typeof item.url === 'string' && item.url.includes('pdude.link')) {
        try {
          const response = await fetchWithTimeout(item.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }}, 20000);
          if(response.url !== item.url) {
            resolvedCount++;
          }
          return { ...item, url: response.url };
        } catch (error: any) {
          console.warn(`Could not resolve ${item.url}: ${error.message}`);
          return { ...item, url_resolution_error: `Resolution failed: ${error.message}` };
        }
      }
      return item;
    })
  );
  
  return {
    success: true,
    data: JSON.stringify(finalJsonData, null, 2),
    message: `Process complete. Successfully resolved ${resolvedCount} of ${totalToResolve} URLs.`
  };
}

export async function mergeJsonData(
  jsonWithDesc: string,
  jsonWithCats: string,
): Promise<{ success: boolean; data?: string; message: string }> {
  let dataWithDesc: any[];
  let dataWithCats: any[];

  try {
    dataWithDesc = JSON.parse(jsonWithDesc);
    if (!Array.isArray(dataWithDesc)) throw new Error("Original JSON must be an array.");
  } catch (e: any) {
    return { success: false, message: `Invalid Original JSON: ${e.message}` };
  }

  try {
    dataWithCats = JSON.parse(jsonWithCats);
    if (!Array.isArray(dataWithCats)) throw new Error("Categorized JSON must be an array.");
  } catch (e: any) {
    return { success: false, message: `Invalid Categorized JSON: ${e.message}` };
  }
  
  const categoriesMap = new Map<string, any[]>();
  for (const item of dataWithCats) {
      if(item.title && item.categories) {
          categoriesMap.set(item.title.trim(), item.categories);
      }
  }

  let mergedCount = 0;
  const mergedData = dataWithDesc.map(item => {
      const originalTitle = item.title ? item.title.trim() : '';
      if (originalTitle && categoriesMap.has(originalTitle)) {
          mergedCount++;
          return {
              ...item,
              categories: categoriesMap.get(originalTitle)
          };
      }
      // Return the original item from the first file if no match is found
      return {
        ...item,
        categories: item.categories || [], // ensure categories field exists
      };
  });
  
  return {
      success: true,
      data: JSON.stringify(mergedData, null, 2),
      message: `Merge complete. Matched and merged categories for ${mergedCount} of ${dataWithDesc.length} items.`
  };
}

export async function categorizeCrawledDataLocally(
  crawledData: CrawlResultChild[]
): Promise<{ success: boolean; data?: CrawlResultChild[]; message: string }> {

  const allCategoriesMap = new Map(ALL_CATEGORIES.map(cat => [cat.term_id, cat]));

  const processingPromises = crawledData.map(async (child) => {
    const mutableChild: CrawlResultChild = JSON.parse(JSON.stringify(child));

    if (mutableChild.processedSteps.includes('categorized')) {
      return mutableChild;
    }

    try {
      const textToScan = [
        mutableChild.title,
        mutableChild.description,
        mutableChild.keywords,
      ].join(' ').toLowerCase();

      const matchedCategoryIds = new Set<number>();

      for (const [categoryIdStr, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const categoryId = parseInt(categoryIdStr, 10);
        for (const keyword of keywords) {
          if (textToScan.includes(keyword.toLowerCase())) {
            matchedCategoryIds.add(categoryId);
            break; 
          }
        }
      }

      const finalCategoryIds = new Set(matchedCategoryIds);
      matchedCategoryIds.forEach(id => {
        let current = allCategoriesMap.get(id);
        while (current && current.parent !== 0) {
          finalCategoryIds.add(current.parent);
          current = allCategoriesMap.get(current.parent);
        }
      });
      
      mutableChild.suggestedCategories = Array.from(finalCategoryIds)
        .map(id => {
          const catInfo = allCategoriesMap.get(id);
          return catInfo ? { id: catInfo.term_id, name: catInfo.name } : null;
        })
        .filter((c): c is { id: number; name: string } => c !== null);

      if (mutableChild.suggestedCategories.length === 0) {
          mutableChild.error = 'No matching keywords found.';
      } else {
          delete mutableChild.error;
      }

    } catch (error: any) {
      console.error(`Error categorizing app ${mutableChild.title} locally:`, error);
      mutableChild.error = `Local categorization failed: ${error.message.slice(0, 100)}`;
    }

    if (!mutableChild.processedSteps.includes('categorized')) {
      mutableChild.processedSteps.push('categorized');
    }
    return mutableChild;
  });

  const settledResults = await Promise.allSettled(processingPromises);

  const enrichedData = settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
        return result.value;
    }
    
    const originalChild: CrawlResultChild = JSON.parse(JSON.stringify(crawledData[index]));
    originalChild.error = `Categorization failed: ${(result.reason as Error)?.message || 'Unknown error'}`;
    if (!originalChild.processedSteps.includes('categorized')) {
      originalChild.processedSteps.push('categorized');
    }
    return originalChild;
  });

  const hasErrors = enrichedData.some(child => child.error && child.processedSteps.includes('categorized'));
  const message = hasErrors ? 'Local categorization finished with some errors.' : 'Local categorization complete.';
  return { success: true, data: enrichedData, message };
}

export async function resolveGistLinks(gistUrls: string): Promise<{success: boolean, data?: GistResult[], message: string}> {
    const urls = gistUrls.split(/[\n\s,]+/).map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
        return { success: false, message: 'Please provide at least one Gist URL.' };
    }

    const allGistUrls = new Set<string>();

    for (const url of urls) {
        try {
            const urlObject = new URL(url);
            const pathParts = urlObject.pathname.split('/').filter(Boolean);

            if (pathParts.length === 1) { // User profile URL
                const username = pathParts[0];
                const pattern = new RegExp(`^/${username}/[0-9a-f]{32}$`, 'i');
                let page = 1;
                let hasMorePages = true;

                while (hasMorePages) {
                    const pageUrl = `https://gist.github.com/${username}?page=${page}`;
                    const response = await fetchWithTimeout(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
                    if (!response.ok) {
                        hasMorePages = false;
                        continue;
                    }

                    const html = await response.text();
                    const $ = cheerio.load(html);
                    
                    const gistsOnPage = [...$('a')]
                        .map(a => $(a).attr('href') || '')
                        .filter(href => pattern.test(href))
                        .map(path => 'https://gist.github.com' + path);
                    
                    if (gistsOnPage.length === 0) {
                        hasMorePages = false;
                    } else {
                        gistsOnPage.forEach(gistUrl => allGistUrls.add(gistUrl));
                        page++;
                    }
                }
            } else { // Single Gist URL
                allGistUrls.add(url.split('/raw/')[0]);
            }
        } catch (error: any) {
            console.error(`Error processing URL ${url}:`, error.message);
            // Optionally add error feedback to a result object if needed
        }
    }
    
    const finalResults: GistResult[] = [{
      gistUrl: 'all_processed',
      rawUrls: Array.from(allGistUrls)
    }];

    return { success: true, data: finalResults, message: `Processed ${urls.length} item(s) and found ${allGistUrls.size} unique Gists.` };
}

// Cloudflare Pages API Actions

async function cfRequest(
    endpoint: string, 
    accountId: string, 
    apiToken: string, 
    globalApiKey?: string, 
    authEmail?: string, 
    options: RequestInit = {}
) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${endpoint}`;
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (globalApiKey && authEmail) {
        headers['X-Auth-Key'] = globalApiKey;
        headers['X-Auth-Email'] = authEmail;
    } else {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers: headers,
    });
    return response.json();
}

export async function listPagesProjects(accountId: string, apiToken: string, globalApiKey?: string, authEmail?: string): Promise<{ success: boolean; data?: PagesProject[]; message: string }> {
    if (!apiToken && (!globalApiKey || !authEmail)) {
        return { success: false, message: "No valid Cloudflare credentials provided."};
    }
    try {
        const data = await cfRequest('/pages/projects', accountId, apiToken, globalApiKey, authEmail);
        if (!data.success) {
            return { success: false, message: data.errors?.[0]?.message || 'Failed to fetch projects.' };
        }
        return { success: true, data: data.result, message: 'Projects fetched.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'An unknown network error occurred.' };
    }
}

export async function createPagesProject(project: CreatePagesProjectInput, accountId: string, apiToken: string, globalApiKey?: string, authEmail?: string): Promise<{ success: boolean; data?: PagesProject; message: string }> {
    if (!globalApiKey || !authEmail) {
        return { success: false, message: "Creating a Pages project requires a Global API Key and associated Email." };
    }

    const [owner, repo_name] = project.repo.split('/');
    if (!owner || !repo_name) {
        return { success: false, message: 'Invalid GitHub repository format. Expected "owner/repo_name".' };
    }
    
    const body = {
        name: project.name,
        production_branch: project.production_branch,
        source: {
            type: 'github',
            config: {
                owner,
                repo_name,
                production_branch: project.production_branch,
            }
        }
    };
    
    try {
        const data = await cfRequest('/pages/projects', accountId, apiToken, globalApiKey, authEmail, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        
        if (!data.success) {
            return { success: false, message: data.errors?.[0]?.message || 'Failed to create project.' };
        }
        return { success: true, data: data.result, message: 'Project created.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'An unknown network error occurred.' };
    }
}

export async function getPagesProjectDeployments(projectName: string, accountId: string, apiToken: string, globalApiKey?: string, authEmail?: string): Promise<{ success: boolean; data?: PagesDeployment[]; message: string }> {
    try {
        const data = await cfRequest(`/pages/projects/${projectName}/deployments`, accountId, apiToken, globalApiKey, authEmail);
        if (!data.success) {
            return { success: false, message: data.errors?.[0].message || 'Failed to fetch deployments.' };
        }
        return { success: true, data: data.result, message: 'Deployments fetched.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'An unknown network error occurred.' };
    }
}

export async function createPagesDeployment(projectName: string, branch: string, accountId: string, apiToken: string, globalApiKey?: string, authEmail?: string): Promise<{ success: boolean; data?: PagesDeployment; message: string }> {
     const body = {
        branch: branch,
     };
     try {
        const data = await cfRequest(`/pages/projects/${projectName}/deployments`, accountId, apiToken, globalApiKey, authEmail, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        
        if (!data.success) {
            return { success: false, message: data.errors?.[0].message || 'Failed to create deployment.' };
        }
        return { success: true, data: data.result, message: 'Deployment created.' };
    } catch (error: any) {
        return { success: false, message: error.message || 'An unknown network error occurred.' };
    }
}

function generateRandomString(length: number): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


export async function deployDirectUpload(
    pairs: DeploymentPairWithContent[],
    quantity: number,
    accountId: string,
    apiToken: string,
    globalApiKey?: string,
    authEmail?: string
): Promise<DirectUploadResult[]> {
    if (!accountId || (!apiToken && !(globalApiKey && authEmail))) {
        const message = 'Cloudflare account details are not configured.';
        return Array(quantity).fill({ success: false, projectName: 'Unknown', message });
    }

    if (pairs.length === 0) {
        return [];
    }
    
    const results: DirectUploadResult[] = [];
    const createdProjects = new Set<string>();

    for (let i = 0; i < quantity; i++) {
        const pair = pairs[i % pairs.length]; // Loop through the pairs
        
        let finalProjectName = '';
        let attempts = 0;
        
        // Ensure project name is unique for this run
        do {
            const randomSuffix = generateRandomString(6);
            finalProjectName = `${pair.projectName}-${randomSuffix}`;
            attempts++;
        } while (createdProjects.has(finalProjectName) && attempts < 10);

        if (createdProjects.has(finalProjectName)) {
            results.push({
                projectName: `base: ${pair.projectName}`,
                success: false,
                message: 'Failed to generate a unique project name after 10 attempts.',
            });
            continue;
        }

        createdProjects.add(finalProjectName);
        
        try {
            const createData = { name: finalProjectName, production_branch: 'main' };
            const createResponse = await cfRequest('/pages/projects', accountId, apiToken, globalApiKey, authEmail, {
                method: 'POST',
                body: JSON.stringify(createData),
            });

            if (!createResponse.success) {
                 if (createResponse.errors?.[0]?.code === 8000000) { // Project already exists
                    results.push({
                        projectName: finalProjectName,
                        success: false,
                        message: 'Project name conflict on Cloudflare. The random suffix was not unique.',
                    });
                 } else {
                    results.push({
                        projectName: finalProjectName,
                        success: false,
                        message: `Project creation failed: ${createResponse.errors?.[0]?.message}`,
                    });
                 }
                continue; 
            }
            
            // This is a simulation. Real Direct Upload would involve creating a manifest 
            // and uploading a zip of assets. For this tool's purpose, we'll assume creating 
            // the project and returning its URL is sufficient to "deploy" a placeholder.
            const deploymentUrl = `https://${createResponse.result.subdomain}`;

            results.push({
                projectName: finalProjectName,
                success: true,
                url: deploymentUrl,
                message: 'Project created. Awaiting content upload (simulated).',
            });

        } catch (error: any) {
            results.push({
                projectName: finalProjectName,
                success: false,
                message: error.message || 'An unknown network error occurred.',
            });
        }
    }
    return results;
}

// GitHub Gist Actions

async function githubApiRequest(endpoint: string, token: string, options: RequestInit = {}): Promise<any> {
    const url = `https://api.github.com${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (response.status === 204) {
        return { success: true, status: response.status };
    }
    
    const isJson = response.headers.get('content-type')?.includes('application/json');

    if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        if (isJson) {
            const data = await response.json();
            errorMessage = data.message || errorMessage;
        } else {
            errorMessage = await response.text();
        }
         console.error('GitHub API Error:', {
            status: response.status,
            statusText: response.statusText,
            endpoint: endpoint,
            responseData: errorMessage,
        });
        const error = new Error(`GitHub API Error (${response.status}): ${errorMessage}`);
        (error as any).status = response.status;
        throw error;
    }

    if (isJson) {
        return response.json();
    }
    
    return { success: true, status: response.status };
}


export async function createGist(input: GistInput, token: string): Promise<GistApiResponse> {
    if (!token) {
        return { success: false, message: "GitHub API Token is not provided." };
    }
    try {
        const body = {
            description: input.description,
            public: input.public,
            files: {
                [input.filename]: {
                    content: input.content,
                },
            },
        };
        const gist = await githubApiRequest('/gists', token, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return { success: true, url: gist.html_url, message: 'Gist created successfully!' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateGist(input: GistInput, token: string): Promise<GistApiResponse> {
    if (!token) {
        return { success: false, message: "GitHub API Token is not provided." };
    }
    if (!input.gistId) {
        return { success: false, message: "Gist ID is required for an update." };
    }
    try {
        const body = {
            description: input.description,
            files: {
                [input.filename]: {
                    content: input.content,
                },
            },
        };
        const gist = await githubApiRequest(`/gists/${input.gistId}`, token, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
        return { success: true, url: gist.html_url, message: 'Gist updated successfully!' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getGistsForUser(token: string, perPage: number = 5): Promise<GistsApiResponse> {
    if (!token) {
        return { success: false, message: "GitHub API Token is not provided." };
    }
    try {
        const gists = await githubApiRequest(`/gists?per_page=${perPage}&sort=created`, token);
        const formattedGists: GistInfo[] = gists.map((gist: any) => ({
            id: gist.id,
            url: gist.html_url,
            description: gist.description || 'No description',
            createdAt: gist.created_at,
        }));
        return { success: true, data: formattedGists, message: 'Gists fetched successfully!' };
    } catch (error: any) {
        return { success: false, message: `Failed to fetch gists: ${error.message}` };
    }
}

// Write.as API Actions

export async function createSingleWriteAsPost(input: WriteAsPostInput): Promise<WriteAsResult> {
    let agent;

    // If a proxy URL is provided, fetch the actual proxy address from it
    if (input.proxy) {
        try {
            let proxyString = input.proxy;
            if (proxyString.startsWith('http://') || proxyString.startsWith('https://')) {
                const proxyRes = await fetch(proxyString);
                if (!proxyRes.ok) throw new Error(`Provider returned status ${proxyRes.status}`);
                proxyString = await proxyRes.text();
            }
            
            const protocol = input.protocol || 'http';
            const fullProxyUrl = `${protocol}://${proxyString}`;
            agent = new HttpsProxyAgent(fullProxyUrl);

        } catch(e: any) {
            return {
                title: input.title,
                success: false,
                message: `Proxy setup failed: ${e.message}`,
            };
        }
    }
    
    const fetchOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: input.title,
            content: input.content,
            font: "sans",
        }),
        ...(agent && { agent })
    };
    
    try {
        const response = await fetch("https://write.as/api/posts", fetchOptions);
        const responseData = await response.json();
        
        if (responseData.code === 201) {
            const postData = responseData.data;
            return {
                title: input.title,
                success: true,
                url: `https://write.as/${postData.id}`,
            };
        } else {
             if (responseData.code === 429) {
                return {
                    title: input.title,
                    success: false,
                    message: `API Error (429): Too Many Requests. Try increasing the delay.`,
                };
            }
            return {
                title: input.title,
                success: false,
                message: `API Error (${responseData.code}): ${responseData.error_msg}`,
            };
        }
    } catch (error: any) {
        let message = error.message || "An unknown network error occurred.";
        if (error.cause) {
            message = `${message} - Cause: ${error.cause.code || error.cause.message}`;
        }
        return {
            title: input.title,
            success: false,
            message: message,
        };
    }
}

// GitLab API Actions

async function gitlabApiRequest(endpoint: string, token: string, options: RequestInit = {}): Promise<any> {
    let fullUrl = `https://gitlab.com/api/v4${endpoint}`;
    
    // For pagination, GitLab might return a full URL in the 'Link' header
    if (endpoint.startsWith('https://')) {
        fullUrl = endpoint;
    }

    const response = await fetch(fullUrl, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    
    if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        if (isJson) {
            const data = await response.json();
            const message = data.message || data.error;
            if (typeof message === 'object') {
                errorMessage = JSON.stringify(message);
            } else {
                errorMessage = message || errorMessage;
            }
        } else {
            errorMessage = await response.text();
        }
         console.error('GitLab API Error:', {
            status: response.status,
            statusText: response.statusText,
            endpoint: endpoint,
            responseData: errorMessage,
        });
        throw new Error(`GitLab API Error (${response.status}): ${errorMessage}`);
    }

    if (response.status === 204 || !isJson) {
        return { success: true, status: response.status, headers: response.headers };
    }
    
    const responseData = await response.json();
    return { data: responseData, headers: response.headers };
}


export async function listGitlabGroups(token: string, username?: string): Promise<GitLabGroupsResult> {
    if (!token) {
        return { success: false, message: "GitLab API Token is not provided." };
    }
    try {
        let endpoint = '/groups?min_access_level=30'; // Default: groups for the authenticated user

        if (username) {
            const { data: users } = await gitlabApiRequest(`/users?username=${username}`, token);
            if (!users || users.length === 0) {
                return { success: false, message: `User '${username}' not found.` };
            }
            const userId = users[0].id;
            endpoint = `/users/${userId}/groups`;
        }

        const { data: groups } = await gitlabApiRequest(endpoint, token);
        return { success: true, data: groups, message: "Groups fetched successfully." };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

async function getGitlabGroup(groupPath: string, token: string): Promise<any | null> {
    try {
        const { data: groups } = await gitlabApiRequest(`/groups?search=${encodeURIComponent(groupPath)}`, token);
        const exactMatch = groups.find((g: any) => g.path.toLowerCase() === groupPath.toLowerCase());
        return exactMatch || null;
    } catch (error: any) {
        if (error.message.includes('404')) {
            return null;
        }
        throw error;
    }
}

async function createFileInRepo(projectId: number, filePath: string, content: string, commitMessage: string, token: string) {
    const encodedFilePath = encodeURIComponent(filePath);
    const fileData = {
        branch: 'main',
        content: content,
        commit_message: commitMessage,
    };
    return gitlabApiRequest(`/projects/${projectId}/repository/files/${encodedFilePath}`, token, {
        method: 'POST',
        body: JSON.stringify(fileData),
    });
}


export async function createGitlabProjectsBulk(
    projects: GitLabBulkProjectInput[],
    token: string
): Promise<GitLabBulkProjectResult[]> {
    if (!token) {
        return projects.map(p => ({
            projectName: p.name,
            success: false,
            message: "GitLab API Token is not provided."
        }));
    }

    const results: GitLabBulkProjectResult[] = [];

    for (const projectInput of projects) {
        try {
            const projectData = {
                name: projectInput.name,
                path: projectInput.path,
                description: projectInput.description,
                visibility: projectInput.visibility,
                namespace_id: projectInput.namespace_id,
                initialize_with_readme: false, // We will create files manually
            };
            
            const { data: project } = await gitlabApiRequest('/projects', token, {
                method: 'POST',
                body: JSON.stringify(projectData),
            });

            // Create README.md
            await createFileInRepo(project.id, 'README.md', projectInput.readme_content, 'feat: Add initial README.md', token);

            let pagesUrl: string | undefined;

            // Create GitLab Pages files if requested
            if (projectInput.create_pages) {
                const ciFileContent = `
pages:
  stage: deploy
  script:
    - mkdir .public
    - cp -r public/* .public
    - mv .public public
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`;

                const indexFileContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Welcome to GitLab Pages</title>
</head>
<body>
    <h1>Hello World!</h1>
</body>
</html>`;
                
                await createFileInRepo(project.id, '.gitlab-ci.yml', ciFileContent.trim(), 'ci: Add GitLab Pages configuration', token);
                await createFileInRepo(project.id, 'public/index.html', indexFileContent.trim(), 'feat: Add index.html for GitLab Pages', token);

                const namespacePath = project.path_with_namespace.substring(0, project.path_with_namespace.lastIndexOf('/'));
                pagesUrl = `https://${namespacePath}.gitlab.io/${project.path}`;
            }

            results.push({
                projectName: projectInput.name,
                success: true,
                url: project.web_url,
                pagesUrl: pagesUrl,
                message: 'Project created successfully!',
            });

        } catch (error: any) {
            results.push({
                projectName: projectInput.name,
                success: false,
                message: error.message,
            });
        }
    }
    return results;
}

async function fetchAllPaginatedData(initialUrl: string, token: string): Promise<any[]> {
    let allData: any[] = [];
    let nextUrl: string | null = initialUrl;

    while (nextUrl) {
        const { data, headers } = await gitlabApiRequest(nextUrl, token);
        if (Array.isArray(data)) {
            allData = allData.concat(data);
        } else {
             allData.push(data); // for non-array single results
        }
        
        const linkHeader = headers.get('Link');
        const nextLinkMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
        nextUrl = nextLinkMatch ? nextLinkMatch[1] : null;
    }
    return allData;
}


export async function listGitlabProjects(token: string, groupId?: number): Promise<{ success: boolean; data?: GitLabProject[]; message: string }> {
    if (!token) {
        return { success: false, message: "GitLab API Token is not provided." };
    }
    try {
        const endpoint = groupId 
            ? `/groups/${groupId}/projects` 
            : `/projects?owned=true`;

        const projects = await fetchAllPaginatedData(endpoint, token);
        return { success: true, data: projects, message: `Found ${projects.length} projects.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateGitlabReadme(projectId: number, content: string, token: string): Promise<UpdateReadmeResult> {
    if (!token) {
        return { projectId, success: false, message: "GitLab token is missing." };
    }

    const encodedFilePath = encodeURIComponent('README.md');
    const body = {
        branch: 'main',
        content: content,
        commit_message: 'docs: Update README.md via tool',
    };
    
    try {
        // First, try to update the file using PUT
        await gitlabApiRequest(`/projects/${projectId}/repository/files/${encodedFilePath}`, token, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
        return { projectId, success: true, message: 'README updated.' };
    } catch (error: any) {
        // If PUT fails (e.g., 404 because the file doesn't exist), try to create it with POST
        if (error instanceof Error && (error.message.includes('404') || error.message.toLowerCase().includes('file not found'))) {
            try {
                const createBody = {
                    ...body,
                    commit_message: 'feat: Create README.md via tool',
                };
                await gitlabApiRequest(`/projects/${projectId}/repository/files/${encodedFilePath}`, token, {
                    method: 'POST',
                    body: JSON.stringify(createBody),
                });
                return { projectId, success: true, message: 'README created.' };
            } catch (createError: any) {
                return { projectId, success: false, message: `Create failed: ${createError.message}` };
            }
        }
        // If the error was something other than not found, report it
        return { projectId, success: false, message: `Update failed: ${error.message}` };
    }
}

export async function getAllGitlabProjects(token: string): Promise<{ success: boolean; data?: string[]; message: string }> {
    if (!token) {
        return { success: false, message: "GitLab API Token is not provided." };
    }
    try {
        const projects: GitLabProject[] = await fetchAllPaginatedData(`/projects?owned=true`, token);
        const urls = projects.map(p => p.web_url);
        return { success: true, data: urls, message: `Found ${projects.length} projects.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}


// Proxy Actions

export async function testProxy(proxy: string, protocol: 'http' | 'https' | 'socks4' | 'socks5' = 'http'): Promise<TestProxyResult> {
    if (!proxy) {
        return { success: false, message: "Proxy string is empty." };
    }

    let finalProxyIp = proxy;
    if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
        try {
            const proxyRes = await fetch(proxy);
            if (!proxyRes.ok) throw new Error(`Provider returned status ${proxyRes.status}`);
            finalProxyIp = await proxyRes.text();
        } catch(e: any) {
            return { success: false, message: `Failed to fetch from dynamic proxy URL: ${e.message}`};
        }
    }
    
    try {
        const fullProxyUrl = `${protocol}://${finalProxyIp}`;
        const agent = new HttpsProxyAgent(fullProxyUrl);
        const response = await fetch("https://api.ipify.org?format=json", { agent });
        
        if (!response.ok) {
            return { success: false, message: `Test failed with status: ${response.status} ${response.statusText}` };
        }
        
        const data = await response.json();
        return { success: true, message: `Success! Proxy IP is ${data.ip}.`, data: { ip: data.ip, country: '' } };

    } catch (error: any) {
        let message = error.message || "An unknown error occurred.";
        if (error.cause) {
            message = `${message} - Cause: ${error.cause.code || error.cause.message}`;
        }
        return { success: false, message: `Error using fetched proxy '${finalProxyIp.substring(0, 30)}...': ${message}` };
    }
}

// Hashnode API Actions
export async function createHashnodePost(input: HashnodePostInput): Promise<HashnodePostResult> {
    if (!input.token || !input.publicationId) {
        return { success: false, message: "Hashnode token or publication ID is missing." };
    }

    const mutation = `
        mutation PublishPost($input: PublishPostInput!) {
            publishPost(input: $input) {
                post {
                    url
                }
            }
        }
    `;

    const variables = {
        input: {
            title: input.title,
            contentMarkdown: input.contentMarkdown,
            publicationId: input.publicationId,
            tags: input.tags.map(tag => ({ slug: tag, name: tag })),
        },
    };

    try {
        const response = await fetch('https://gql.hashnode.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': input.token,
            },
            body: JSON.stringify({
                query: mutation,
                variables: variables,
            }),
        });

        const result = await response.json();

        if (result.errors) {
            console.error("Hashnode API Errors:", result.errors);
            return { success: false, message: `API Error: ${result.errors[0].message}` };
        }

        if (result.data?.publishPost?.post?.url) {
            return {
                success: true,
                message: "Post created successfully.",
                url: result.data.publishPost.post.url,
            };
        }

        return { success: false, message: "Failed to create post. The response from Hashnode was unexpected." };

    } catch (error: any) {
        console.error("Error creating Hashnode post:", error);
        return { success: false, message: error.message || "An unknown network error occurred." };
    }
}

// Product Importer Actions

const ProductDataSchema = z.object({
  name: z.string().describe("The main name of the product."),
  category_id: z.number().optional().describe("The numerical category ID, if available."),
  brand_id: z.number().optional().describe("The numerical brand ID, if available."),
  price: z.number().optional().describe("The product's price in JPY. Extract only the number."),
  unit: z.string().optional().describe("The unit of the product (e.g., '個', '点'). Default to '個' if not specified."),
  barcode: z.string().optional().describe("The product's barcode (JAN/EAN code), if available."),
  sku: z.string().optional().describe("The product's SKU or model number (型番)."),
  slug: z.string().describe("A URL-friendly version of the product name."),
  current_stock: z.number().optional().describe("The current stock level. If the text says '在庫あり' (in stock), estimate a reasonable number like 10."),
  minimum_order_quantity: z.number().optional().describe("The minimum order quantity."),
  short_description: z.string().describe("A concise, one-sentence summary of the product in Japanese."),
  description: z.string().describe("The detailed product description, formatted in Japanese with HTML tags for paragraphs."),
  meta_title: z.string().describe("The SEO meta title in Japanese."),
  meta_description: z.string().describe("The SEO meta description in Japanese, summarizing the product."),
  min_qty: z.number().optional().describe("The minimum order quantity. Same as minimum_order_quantity"),
  meta_img: z.string().optional().describe("URL of the meta image for social sharing."),
});

type ProductData = z.infer<typeof ProductDataSchema>;

const productExtractionPrompt = ai.definePrompt({
    name: 'productExtractor',
    input: { schema: z.object({ url: z.string(), rawHtml: z.string() }) },
    output: { schema: ProductDataSchema },
    prompt: `You are an expert data entry specialist for a Japanese e-commerce website specializing in cameras and photo accessories.
Your task is to extract product information from the provided HTML content of a product page and format it according to the specified JSON schema.

- The target language is Japanese. All descriptions and titles must be in Japanese.
- Accurately extract all available information.
- If a specific piece of information (like barcode or brand_id) is not present in the HTML, omit the field from the output.
- For the 'price', extract only the numerical value, without currency symbols or commas.
- For 'current_stock', if you see '在庫あり' (zaiko ari), which means 'in stock', assume a value of 10.
- The 'slug' should be a URL-friendly version of the product name.
- The 'description' should be a detailed, well-formatted summary in Japanese, using <p> tags for paragraphs.
- The 'short_description', 'meta_title', and 'meta_description' must also be in Japanese.

Analyze the following HTML content from the URL: {{url}}

HTML Content:
\`\`\`html
{{{rawHtml}}}
\`\`\`

Please provide the structured data in the specified JSON format.`,
});

const productGenerationPrompt = ai.definePrompt({
    name: 'productGenerator',
    input: { schema: z.object({ productName: z.string() }) },
    output: { schema: ProductDataSchema },
    prompt: `You are a creative marketing and data entry expert for a Japanese e-commerce website specializing in cameras and photo accessories.
Your task is to generate compelling and realistic product data for a given product name.
The output MUST be in Japanese and follow the specified JSON schema.

- Based on the input product name, generate all relevant fields.
- Create a realistic price in JPY (e.g., a new camera might be 150000-400000 JPY).
- Write a short, engaging description (short_description) and a more detailed, well-formatted HTML description.
- Create SEO-friendly meta_title and meta_description.
- Invent a plausible SKU/model number.
- Create a URL-friendly slug from the product name.
- Assume the product is in stock (current_stock: 10) and has a minimum order quantity of 1.

The product name is: {{{productName}}}

Please generate the product data in the specified JSON format. All text fields must be in Japanese.`,
});

function convertToCsv(data: ProductData[]): string {
    if (data.length === 0) return "";

    const headers = [
        'name', 'category_id', 'id', 'brand_id', 'price', 'unit', 'barcode', 'sku', 'slug', 
        'current_stock', 'minimum_order_quantity', 'video_provider', 'video_url', 
        'is_catalog', 'external_link', 'is_refund', 'cash_on_delivery', 
        'short_description', 'description', 'meta_title', 'meta_description', 
        'min_qty', 'meta_img'
    ];

    const escapeCsvField = (field: any): string => {
        if (field === null || field === undefined) {
            return '';
        }
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = data.map(item => [
        escapeCsvField(item.name),
        escapeCsvField(item.category_id),
        '', // id is empty
        escapeCsvField(item.brand_id),
        escapeCsvField(item.price),
        escapeCsvField(item.unit ?? '個'),
        escapeCsvField(item.barcode),
        escapeCsvField(item.sku),
        escapeCsvField(item.slug),
        escapeCsvField(item.current_stock),
        escapeCsvField(item.minimum_order_quantity),
        '', // video_provider
        '', // video_url
        '0', // is_catalog
        '', // external_link
        '1', // is_refund
        '1', // cash_on_delivery
        escapeCsvField(item.short_description),
        escapeCsvField(item.description),
        escapeCsvField(item.meta_title),
        escapeCsvField(item.meta_description),
        escapeCsvField(item.min_qty),
        escapeCsvField(item.meta_img),
    ].join(','));

    return headers.join(',') + '\n' + rows.join('\n');
}

export async function extractProductData(url: string): Promise<{ success: boolean; csvData?: string; message: string }> {
    if (!url) {
        return { success: false, message: 'URL is required.' };
    }

    try {
        // Step 1: Fetch the listing page
        const listResponse = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
        });
        if (!listResponse.ok) {
            return { success: false, message: `Failed to fetch listing URL. Status: ${listResponse.status}` };
        }
        const listHtml = await listResponse.text();
        const $ = cheerio.load(listHtml);

        // Step 2: Extract individual product links
        const productLinks: string[] = [];
        $('.item-card a.item-card__image-wrapper').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                productLinks.push(new URL(href, 'https://zenmarket.jp').href);
            }
        });

        if (productLinks.length === 0) {
            return { success: false, message: 'No product links found on the listing page. The site structure may have changed.' };
        }

        // Step 3: Process each product link concurrently
        const productPromises = productLinks.map(async (productUrl) => {
            try {
                const productResponse = await fetch(productUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                });
                if (!productResponse.ok) return null;
                const productHtml = await productResponse.text();
                
                // Use a smaller, more relevant chunk of HTML for the AI
                const $$ = cheerio.load(productHtml);
                const mainContent = $$('.product-page--21_3').first().html();

                if (!mainContent) return null;

                const { output } = await productExtractionPrompt({ url: productUrl, rawHtml: mainContent });
                return output;
            } catch (e) {
                console.error(`Failed to process product URL ${productUrl}:`, e);
                return null;
            }
        });

        const allProductData = (await Promise.all(productPromises)).filter((p): p is ProductData => p !== null);

        if (allProductData.length === 0) {
            return { success: false, message: 'Could not extract data from any of the product pages.' };
        }
        
        // Step 4: Convert all extracted data to a single CSV
        const csvData = convertToCsv(allProductData);

        return { success: true, csvData, message: `Successfully extracted data for ${allProductData.length} products.` };

    } catch (error: any) {
        console.error('Error in extractProductData:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}


export async function generateProductDataFromName(productName: string): Promise<{ success: boolean; csvData?: string; message: string }> {
    if (!productName) {
        return { success: false, message: 'Product name is required.' };
    }

    try {
        const { output } = await productGenerationPrompt({ productName });
        if (!output) {
            return { success: false, message: 'AI failed to generate product data.' };
        }
        
        const csvData = convertToCsv([output]);
        return { success: true, csvData, message: 'Successfully generated product data.' };

    } catch (error: any) {
        console.error('Error in generateProductDataFromName:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}


// README Template Actions (Firestore)
export async function getReadmeTemplates(): Promise<{ success: boolean; data?: ReadmeTemplate[]; message: string }> {
    try {
        const { firestore } = getFirebaseAdmin();
        const snapshot = await firestore.collection('readmeTemplates').orderBy('createdAt', 'desc').get();
        
        const templates = snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Firestore Timestamps to ISO strings for serialization
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined;
            const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined;
            
            return {
                id: doc.id,
                name: data.name,
                content: data.content,
                createdAt,
                updatedAt
            };
        });

        return { success: true, data: templates, message: 'Templates fetched successfully.' };
    } catch (error: any) {
        console.error("Error fetching README templates:", error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}

export async function addReadmeTemplate(template: ReadmeTemplateInput): Promise<{ success: boolean; data?: { id: string }; message: string }> {
    try {
        const { firestore } = getFirebaseAdmin();
        const newTemplate = {
            ...template,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        const docRef = await firestore.collection('readmeTemplates').add(newTemplate);
        return { success: true, data: { id: docRef.id }, message: 'Template added successfully.' };
    } catch (error: any) {
        console.error("Error adding README template:", error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}

export async function updateReadmeTemplate(id: string, template: Partial<ReadmeTemplateInput>): Promise<{ success: boolean; message: string }> {
    try {
        const { firestore } = getFirebaseAdmin();
        const templateUpdate = {
            ...template,
            updatedAt: FieldValue.serverTimestamp(),
        };
        await firestore.collection('readmeTemplates').doc(id).update(templateUpdate);
        return { success: true, message: 'Template updated successfully.' };
    } catch (error: any) {
        console.error("Error updating README template:", error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}

export async function deleteReadmeTemplate(id: string): Promise<{ success: boolean; message: string }> {
    try {
        const { firestore } = getFirebaseAdmin();
        await firestore.collection('readmeTemplates').doc(id).delete();
        return { success: true, message: 'Template deleted successfully.' };
    } catch (error: any) {
        console.error("Error deleting README template:", error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}


// User Management Actions
export async function listAllUsers(): Promise<{ success: boolean, users?: (UserRecord & { permissions?: string[] })[], message: string }> {
    const result = await listAllUsersAdmin();
    if (!result.success || !result.users) {
        return { success: false, message: result.message, users: [] };
    }
    return { success: true, users: result.users, message: "Users listed successfully." };
}


export async function deleteUser(uid: string): Promise<{ success: boolean, message: string }> {
    const result = await deleteUserAdmin(uid);
    return result;
}

export async function updateUserPermissions(uid: string, permissions: string[], email?: string | null): Promise<{ success: boolean; message: string }> {
    const result = await updateUserPermissionsAdmin(uid, permissions, email);
    return result;
}

export async function getUserPermissions(): Promise<{ permissions: string[] }> {
    // This is a client-callable action. It must not have direct admin access.
    // It relies on the auth context to identify the user.
    const auth = getAuth(clientAuth.app);
    const user = auth.currentUser;

    if (!user) {
        return { permissions: [] };
    }

    // Call the admin function to get the permissions from the backend.
    const result = await getUserPermissionsAdmin(user.uid);
    return { permissions: result.permissions || [] };
}
