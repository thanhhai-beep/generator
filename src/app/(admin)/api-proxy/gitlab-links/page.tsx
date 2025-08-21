
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, KeyRound, Link as LinkIcon, Copy } from 'lucide-react';
import { getAllGitlabProjects } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type GitLabAccount = {
  id: string;
  name: string;
  token: string;
};

const GitLabLogo = () => (
    <svg role="img" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>GitLab</title><path d="M23.955 13.587l-1.34-4.124L18.488.54l-3.35 10.28H8.854L5.503.54 1.378 9.462.025 13.587A.813.813 0 0 0 .81 14.83l11.183 8.625a.8.8 0 0 0 .992 0L23.18 14.83a.813.813 0 0 0 .774-1.243z"/></svg>
);


export default function GitlabLinksPage() {
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState<GitLabAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const activeToken = useMemo(() => accounts.find(acc => acc.id === selectedAccountId)?.token, [accounts, selectedAccountId]);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState('');

  useEffect(() => {
    try {
        const savedAccounts = localStorage.getItem('gitlabApiAccounts');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts).reverse();
          setAccounts(parsedAccounts);
          if (parsedAccounts.length > 0) {
              setSelectedAccountId(parsedAccounts[0].id);
          }
        }
    } catch (error) {
        console.error("Could not parse GitLab accounts from localStorage", error);
        toast({ title: "Lỗi", description: "Không thể tải các tài khoản GitLab đã lưu." });
    }
  }, [toast]);


  const handleFetchLinks = async () => {
    if (!activeToken) {
        toast({ title: 'Chưa chọn tài khoản', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    setResults('');
    
    try {
        const result = await getAllGitlabProjects(activeToken);
        if (result.success && result.data) {
            setResults(result.data.join('\n'));
            toast({ title: 'Thành công!', description: `Đã tìm thấy ${result.data.length} kho lưu trữ.` });
        } else {
            toast({ title: 'Thất bại', description: result.message, variant: 'destructive' });
        }
    } catch (error: any) {
        toast({ title: 'Đã xảy ra lỗi không mong muốn', description: error.message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCopy = () => {
    if (!results) return;
    navigator.clipboard.writeText(results);
    toast({ title: 'Đã sao chép!', description: 'Tất cả các liên kết đã được sao chép vào clipboard.' });
  };
  
  const isAccountAvailable = accounts.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitLabLogo />
            Get All GitLab Project Links
          </CardTitle>
          <CardDescription>
            Lấy tất cả các liên kết đến kho lưu trữ thuộc sở hữu của một tài khoản GitLab đã chọn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
                <Label htmlFor="active-account-select">Tài khoản GitLab đang hoạt động</Label>
                <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId} disabled={!isAccountAvailable || isLoading}>
                    <SelectTrigger id="active-account-select">
                        <SelectValue placeholder="Chọn một tài khoản..." />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1 self-end">
                 <Button asChild variant="outline" className="w-full">
                    <Link href="/api-proxy/gitlab">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Quản lý tất cả tài khoản
                    </Link>
                </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
            <Button onClick={handleFetchLinks} disabled={!activeToken || isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LinkIcon className="mr-2"/>}
                Lấy tất cả liên kết kho lưu trữ
            </Button>
        </CardFooter>
      </Card>
      
      {results && (
          <Card>
              <CardHeader>
                  <CardTitle>Kết quả</CardTitle>
                   <CardDescription>Danh sách tất cả các liên kết kho lưu trữ đã tìm thấy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                    readOnly
                    value={results}
                    className="min-h-96 font-mono text-xs"
                />
              </CardContent>
              <CardFooter>
                <Button onClick={handleCopy} variant="secondary">
                    <Copy className="mr-2 h-4 w-4" /> Sao chép tất cả
                </Button>
              </CardFooter>
          </Card>
      )}
    </div>
  );
}
