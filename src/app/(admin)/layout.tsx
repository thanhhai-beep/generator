
'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScanLine, Cloud, CloudUpload, Globe, BookText, Search, Home, LogOut, Loader2, KeyRound, ChevronRight, Webhook, FileJson, Github, ShieldQuestion, FileUp, Settings, FilePen, FolderGit, Server, FilePenLine, Wand2, Camera, Link as LinkIcon, Users, Combine, FileText as ReadmeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { getUserPermissions } from '@/lib/server-actions';

// --- START: Page Permissions Configuration ---
// This object now serves as the master list of all manageable pages.
// The `canAccess` function will use this list to determine access rights.
export const pagePermissions: { [key: string]: { label: string, group: string } } = {
  '/cloudflare/deploy': { label: 'Git Deployments', group: 'Cloudflare' },
  '/cloudflare/direct-upload': { label: 'Direct Upload', group: 'Cloudflare' },
  '/cloudflare/domains': { label: 'Domains', group: 'Cloudflare' },
  '/cloudflare/accounts': { label: 'Accounts', group: 'Cloudflare' },
  '/api-proxy/github': { label: 'GitHub Accounts', group: 'GitHub' },
  '/api-proxy/gist': { label: 'Gist Manager', group: 'GitHub' },
  '/api-proxy/gitlab': { label: 'GitLab Accounts', group: 'GitLab' },
  '/api-proxy/gitlab-repo': { label: 'GitLab Bulk Creator', group: 'GitLab' },
  '/api-proxy/gitlab-manager': { label: 'GitLab Repo Manager', group: 'GitLab' },
  '/api-proxy/gitlab-links': { label: 'Get GitLab Links', group: 'GitLab' },
  '/hashnode/poster': { label: 'Poster', group: 'Hashnode' },
  '/hashnode/accounts': { label: 'Accounts', group: 'Hashnode' },
  '/api-proxy/proxies': { label: 'Proxy Manager', group: 'Misc' },
  '/user-management': { label: 'User Management', group: 'Misc' },
  '/bangladesh': { label: 'Bangladesh Content', group: 'Misc' },
  '/site-crawler': { label: 'Site Crawler', group: 'Misc' },
  '/json-resolver': { label: 'JSON Tools', group: 'Misc' },
  '/gist-resolver': { label: 'Gist Resolver', group: 'Misc' },
  '/writeas-poster': { label: 'Write.as Poster', group: 'Misc' },
  '/product-importer': { label: 'Product Importer', group: 'Misc' },
  '/domain-analyzer': { label: 'Domain Analyzer', group: 'Misc' },
  '/keyword-combiner': { label: 'README Updater', group: 'Misc' },
};

const menuGroups = {
    cloudflare: ['/cloudflare/deploy', '/cloudflare/direct-upload', '/cloudflare/domains', '/cloudflare/accounts'],
    github: ['/api-proxy/github', '/api-proxy/gist'],
    gitlab: ['/api-proxy/gitlab', '/api-proxy/gitlab-repo', '/api-proxy/gitlab-manager', '/api-proxy/gitlab-links'],
    hashnode: ['/hashnode/poster', '/hashnode/accounts'],
};

// New, more flexible permission checking
const canAccess = (userPermissions: string[], pagePath: string, userEmail: string | null | undefined) => {
    // Hardcoded rule for the main admin to have access to everything.
    if (userEmail === 'haido30112002@gmail.com') return true;
    
    // Admins can access everything.
    if (userPermissions.includes('admin')) return true;

    // All authenticated users can access the domain analyzer and keyword combiner
    if (pagePath === '/domain-analyzer' || pagePath === '/keyword-combiner') return true;

    // Check if the specific page path is in the user's permissions array
    return userPermissions.includes(pagePath);
};

const hasAccessToGroup = (userPermissions: string[], groupPaths: string[], userEmail: string | null | undefined) => {
    // Admins can see all groups
    if (userEmail === 'haido30112002@gmail.com' || userPermissions.includes('admin')) return true;
    
    // Check if user has permission for at least one page in the group
    return groupPaths.some(path => userPermissions.includes(path));
}
// --- END: Page Permissions Configuration ---

const GitLabLogo = () => (
    <svg role="img" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>GitLab</title><path d="M23.955 13.587l-1.34-4.124L18.488.54l-3.35 10.28H8.854L5.503.54 1.378 9.462.025 13.587A.813.813 0 0 0 .81 14.83l11.183 8.625a.8.8 0 0 0 .992 0L23.18 14.83a.813.813 0 0 0 .774-1.243z"/></svg>
);


const NavLink = ({ href, tooltip, children, permissions, userEmail }: { href: string; tooltip: string; children: React.ReactNode, permissions: string[], userEmail: string | null | undefined }) => {
    const pathname = usePathname();
    const isActive = pathname === href || (href !== '/domain-analyzer' && href !== '/keyword-combiner' && pathname.startsWith(href));
    
    if (!canAccess(permissions, href, userEmail)) {
        return null;
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={tooltip} isActive={isActive}>
                <Link href={href}>
                    {children}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
};

function SignOutButton() {
    const router = useRouter();
    const handleSignOut = async () => {
        await signOut(auth);
        router.push('/login');
    };

    return (
        <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
                 <LogOut />
                <span>Sign Out</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

// Client Component to handle UI and interactivity
function ClientAdminLayout({
    children,
    user,
    permissions
}: {
    children: React.ReactNode;
    user: User;
    permissions: string[];
}) {
    const router = useRouter();
    const pathname = usePathname();

    const [isCloudflareOpen, setIsCloudflareOpen] = useState(false);
    const [isGitHubOpen, setIsGitHubOpen] = useState(false);
    const [isGitLabOpen, setIsGitLabOpen] = useState(false);
    const [isHashnodeOpen, setIsHashnodeOpen] = useState(false);
    
    useEffect(() => {
        if (!canAccess(permissions, pathname, user.email)) {
            router.replace('/domain-analyzer');
        }
    }, [pathname, user, permissions, router]);

    useEffect(() => {
        setIsCloudflareOpen(pathname.startsWith('/cloudflare'));
        setIsGitHubOpen(pathname.startsWith('/api-proxy/github') || pathname.startsWith('/api-proxy/gist'));
        setIsGitLabOpen(pathname.startsWith('/api-proxy/gitlab'));
        setIsHashnodeOpen(pathname.startsWith('/hashnode'));
    }, [pathname]);

      const pageTitles: { [key: string]: string } = {
        "/domain-analyzer": "Web Insight Analyzer",
        "/cloudflare/deploy": "Cloudflare Git Deployments",
        "/cloudflare/domains": "Cloudflare Domains",
        "/cloudflare/accounts": "Cloudflare Accounts",
        "/cloudflare/direct-upload": "Cloudflare Direct Upload",
        "/bangladesh": "Bangladesh Content Fetcher",
        "/site-crawler": "Site Crawler",
        "/json-resolver": "JSON Tools",
        "/gist-resolver": "Gist Resolver",
        "/api-proxy/github": "GitHub Accounts Manager",
        "/api-proxy/gist": "Gist Manager",
        "/api-proxy/gitlab": "GitLab Accounts Manager",
        "/api-proxy/gitlab-repo": "GitLab Bulk Creator",
        "/api-proxy/gitlab-manager": "GitLab Repo Manager",
        "/api-proxy/gitlab-links": "Get GitLab Links",
        "/api-proxy/proxies": "Proxy Manager",
        "/writeas-poster": "Write.as Bulk Poster",
        "/hashnode/poster": "Hashnode Poster",
        "/hashnode/accounts": "Hashnode Accounts",
        "/product-importer": "Product Importer",
        "/user-management": "User Management",
        "/keyword-combiner": "Title Generator & README Updater",
      };

    const title = pageTitles[pathname] || "Dashboard";

    return (
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" asChild>
                    <Link href="/domain-analyzer">
                        <Home />
                    </Link>
                 </Button>
                <h2 className="text-lg font-semibold">Admin Panel</h2>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <NavLink href="/domain-analyzer" tooltip="Domain Analyzer" permissions={permissions} userEmail={user.email}>
                    <ScanLine />
                    <span>Domain Analyzer</span>
                </NavLink>

                {hasAccessToGroup(permissions, menuGroups.cloudflare, user.email) && (
                  <Collapsible open={isCloudflareOpen} onOpenChange={setIsCloudflareOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={pathname.startsWith('/cloudflare')} className="w-full">
                              <div className="flex flex-1 items-center gap-2">
                                 <Cloud />
                                 <span>Cloudflare</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isCloudflareOpen ? "rotate-90" : ""}`} />
                          </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                        <SidebarMenu className="mx-3.5 my-1 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5">
                          <NavLink href="/cloudflare/deploy" tooltip="Git Deployments" permissions={permissions} userEmail={user.email}>
                              <CloudUpload />
                              <span>Git Deployments</span>
                          </NavLink>
                          <NavLink href="/cloudflare/direct-upload" tooltip="Direct Upload" permissions={permissions} userEmail={user.email}>
                              <FileUp />
                              <span>Direct Upload</span>
                          </NavLink>
                          <NavLink href="/cloudflare/domains" tooltip="Cloudflare Domains" permissions={permissions} userEmail={user.email}>
                              <Globe />
                              <span>Domains</span>
                          </NavLink>
                          <NavLink href="/cloudflare/accounts" tooltip="Cloudflare Accounts" permissions={permissions} userEmail={user.email}>
                              <KeyRound />
                              <span>Accounts</span>
                          </NavLink>
                        </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {hasAccessToGroup(permissions, menuGroups.github, user.email) && (
                   <Collapsible open={isGitHubOpen} onOpenChange={setIsGitHubOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={pathname.startsWith('/api-proxy/github') || pathname.startsWith('/api-proxy/gist')} className="w-full">
                              <div className="flex flex-1 items-center gap-2">
                                 <Github />
                                 <span>GitHub</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isGitHubOpen ? "rotate-90" : ""}`} />
                          </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                        <SidebarMenu className="mx-3.5 my-1 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5">
                          <NavLink href="/api-proxy/github" tooltip="GitHub Accounts" permissions={permissions} userEmail={user.email}>
                              <KeyRound />
                              <span>Accounts</span>
                          </NavLink>
                          <NavLink href="/api-proxy/gist" tooltip="Gist Manager" permissions={permissions} userEmail={user.email}>
                              <FilePen />
                              <span>Gist Manager</span>
                          </NavLink>
                        </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {hasAccessToGroup(permissions, menuGroups.gitlab, user.email) && (
                  <Collapsible open={isGitLabOpen} onOpenChange={setIsGitLabOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={pathname.startsWith('/api-proxy/gitlab')} className="w-full">
                              <div className="flex flex-1 items-center gap-2">
                                 <GitLabLogo />
                                 <span>GitLab</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isGitLabOpen ? "rotate-90" : ""}`} />
                          </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                        <SidebarMenu className="mx-3.5 my-1 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5">
                           <NavLink href="/api-proxy/gitlab" tooltip="GitLab Accounts" permissions={permissions} userEmail={user.email}>
                              <KeyRound />
                              <span>Accounts</span>
                          </NavLink>
                           <NavLink href="/api-proxy/gitlab-repo" tooltip="GitLab Bulk Creator" permissions={permissions} userEmail={user.email}>
                              <FolderGit />
                              <span>Bulk Creator</span>
                          </NavLink>
                           <NavLink href="/api-proxy/gitlab-manager" tooltip="GitLab Repo Manager" permissions={permissions} userEmail={user.email}>
                              <Wand2 />
                              <span>Repo Manager</span>
                          </NavLink>
                          <NavLink href="/api-proxy/gitlab-links" tooltip="Get GitLab Links" permissions={permissions} userEmail={user.email}>
                              <LinkIcon />
                              <span>Get Links</span>
                          </NavLink>
                        </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                
                {hasAccessToGroup(permissions, menuGroups.hashnode, user.email) && (
                   <Collapsible open={isHashnodeOpen} onOpenChange={setIsHashnodeOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={pathname.startsWith('/hashnode')} className="w-full">
                              <div className="flex flex-1 items-center gap-2">
                                 <FilePenLine />
                                 <span>Hashnode</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isHashnodeOpen ? "rotate-90" : ""}`} />
                          </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                        <SidebarMenu className="mx-3.5 my-1 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5">
                           <NavLink href="/hashnode/poster" tooltip="Hashnode Poster" permissions={permissions} userEmail={user.email}>
                              <FilePen />
                              <span>Poster</span>
                          </NavLink>
                           <NavLink href="/hashnode/accounts" tooltip="Hashnode Accounts" permissions={permissions} userEmail={user.email}>
                              <KeyRound />
                              <span>Accounts</span>
                          </NavLink>
                        </SidebarMenu>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                
                <NavLink href="/api-proxy/proxies" tooltip="Proxy Manager" permissions={permissions} userEmail={user.email}>
                    <Server />
                    <span>Proxy Manager</span>
                </NavLink>
                <NavLink href="/product-importer" tooltip="Product Importer" permissions={permissions} userEmail={user.email}>
                    <Camera />
                    <span>Product Importer</span>
                </NavLink>
                 <NavLink href="/user-management" tooltip="User Management" permissions={permissions} userEmail={user.email}>
                    <Users />
                    <span>User Management</span>
                </NavLink>
                <NavLink href="/keyword-combiner" tooltip="README Updater" permissions={permissions} userEmail={user.email}>
                    <Combine />
                    <span>README Updater</span>
                </NavLink>
                <NavLink href="/bangladesh" tooltip="Bangladesh Content" permissions={permissions} userEmail={user.email}>
                    <BookText />
                    <span>Bangladesh Content</span>
                </NavLink>
                 <NavLink href="/site-crawler" tooltip="Site Crawler" permissions={permissions} userEmail={user.email}>
                    <Webhook />
                    <span>Site Crawler</span>
                </NavLink>
                 <NavLink href="/json-resolver" tooltip="JSON Tools" permissions={permissions} userEmail={user.email}>
                    <FileJson />
                    <span>JSON Tools</span>
                </NavLink>
                <NavLink href="/gist-resolver" tooltip="Gist Resolver" permissions={permissions} userEmail={user.email}>
                    <Github />
                    <span>Gist Resolver</span>
                </NavLink>
                <NavLink href="/writeas-poster" tooltip="Write.as Poster" permissions={permissions} userEmail={user.email}>
                    <FilePen />
                    <span>Write.as Poster</span>
                </NavLink>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SignOutButton />
                </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      );
}


// Server Component Wrapper to fetch data
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const router = useRouter();

  const loadData = useCallback(async () => {
    if (!user) {
        setDataLoading(false);
        return;
    }
    
    setDataLoading(true);
    const result = await getUserPermissions();
    setPermissions(result.permissions || []);
    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        loadData();
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router, loadData]);


  if (loading || dataLoading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Pass the fetched permissions to the client component
  return (
    <ClientAdminLayout user={user} permissions={permissions}>
        {children}
    </ClientAdminLayout>
  );
}
