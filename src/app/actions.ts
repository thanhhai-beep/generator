
'use server';

export type AnalysisResult = {
  domain: string;
  status: number;
  statusText: string;
  title: string;
};

export type CloudflareResult = {
  success: boolean;
  message: string;
  data?: {
    name: string;
    status: string;
    name_servers: string[];
  };
};

export type CloudflareAddResult = {
  domain: string;
  success: boolean;
  message: string;
  name_servers?: string[];
  cloudflare_status?: string;
};

export type CloudflareDomainInput = {
    domain: string;
    ipAddress: string;
    records: string[];
    sslMode: 'full' | 'flexible';
}

export type CloudflareDeleteResult = {
    domain: string;
    success: boolean;
    message: string;
};

export type CloudflareStatusResult = {
    domain: string;
    success: boolean;
    message: string;
    cloudflare_status?: string;
};

export type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  zone_id: string;
  zone_name: string;
};

export type DnsRecordInput = {
  type: string;
  name:string;
  content: string;
  proxied: boolean;
  ttl: number;
}

export type BulkDnsActionResult = {
  domain: string;
  success: boolean;
  message: string;
};

export type ArticleData = {
  title: string;
  description: string;
  content: string;
  url: string;
};

export type CrawlResultChild = {
    url: string;
    url_site: string;
    title: string;
    img_url: string;
    img_alt: string;
    description?: string;
    keywords?: string;
    faviconUrl?: string;
    content?: string; 
    suggestedCategories?: { id: number; name: string }[];
    error?: string;
    processedSteps: ('crawled' | 'metadata' | 'categorized')[];
    categoryInfo?: { name: string; url: string };
};

export type CrawlResultCategory = {
    cate_url: string;
    cate_name: string;
    cate_id?: number;
    children: CrawlResultChild[];
};

export type GistResult = {
    gistUrl: string;
    rawUrls: string[];
    error?: string;
}

export type PagesProject = {
  id: string;
  name: string;
  domains: string[];
  subdomain: string;
  production_branch: string;
  source: {
    type: string;
    config: {
      owner: string;
      repo_name: string;
      production_branch: string;
    };
  };
  created_on: string;
  latest_deployment: PagesDeployment;
};

export type PagesDeployment = {
  id: string;
  url: string;
  created_on: string;
  latest_stage: {
    name: string;
    status: string;
  };
  deployment_trigger: {
    metadata: {
      branch: string;
      commit_hash: string;
      commit_message: string;
    };
  };
};

export type CreatePagesProjectInput = {
  name: string;
  repo: string; // "user/repo"
  production_branch: string;
};

export type DirectUploadResult = {
    projectName: string;
    success: boolean;
    url?: string;
    message: string;
};

export type DeploymentPair = {
    projectName: string;
    htmlFileId: string;
};

export type DeploymentPairWithContent = {
    projectName: string;
    htmlContent: string;
}

export type GistInput = {
    description: string;
    filename: string;
    content: string;
    public: boolean;
    gistId?: string; // For updates
};

export type GistApiResponse = {
    success: boolean;
    url?: string;
    message: string;
}

export type GistInfo = {
  id: string;
  url: string;
  description: string;
  createdAt: string;
};

export type GistsApiResponse = {
    success: boolean;
    data?: GistInfo[];
    message: string;
}


export type WriteAsPostInput = {
    title: string;
    content: string;
    proxy?: string;
    protocol?: 'http' | 'https' | 'socks4' | 'socks5';
};

export type WriteAsResult = {
    title: string;
    success: boolean;
    url?: string;
    message?: string;
};

export type GitLabProject = {
  id: number;
  name: string;
  web_url: string;
  path_with_namespace: string;
  readme_url: string | null;
};

export type GitLabProjectResult = {
    success: boolean;
    url?: string;
    message: string;
};

export type GitLabGroup = {
    id: number;
    name: string;
    path: string;
    full_name: string;
    full_path: string;
};

export type GitLabGroupsResult = {
    success: boolean;
    data?: GitLabGroup[];
    message: string;
};

export type GitLabBulkProjectInput = {
  name: string;
  path: string;
  description: string;
  visibility: 'public' | 'internal' | 'private';
  namespace_id?: number;
  initialize_with_readme: boolean;
  readme_content: string;
  create_pages?: boolean;
};

export type GitLabBulkProjectResult = {
    projectName: string;
    success: boolean;
    url?: string;
    pagesUrl?: string;
    message: string;
};

export type UpdateReadmeResult = {
    projectId: number;
    success: boolean;
    message: string;
};

export type TestProxyResult = {
    success: boolean;
    message: string;
    data?: {
        ip: string;
        country: string;
    }
};

export type HashnodePostInput = {
    token: string;
    publicationId: string;
    title: string;
    contentMarkdown: string;
    tags: string[];
    hideFromHostFeed?: boolean;
};

export type HashnodePostResult = {
    success: boolean;
    message: string;
    url?: string;
};

export type ReadmeTemplate = {
  id: string;
  name: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReadmeTemplateInput = {
    name: string;
    content: string;
}

export type UserPermissionData = {
    uid: string;
    email?: string;
    permissions: string[];
};
