
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Wand2, PlusCircle, Trash2, Copy, Download, X, UploadCloud, Archive, List, Loader2, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/auth-context';
import { 
    getReadmeTemplates, 
    addReadmeTemplate, 
    updateReadmeTemplate, 
    deleteReadmeTemplate,
    listAllUsers
} from '@/lib/server-actions';
import type { ReadmeTemplate } from '@/app/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import JSZip from "jszip";
import { saveAs } from "file-saver";


interface ProcessedFile {
  name: string;
  content: string;
}

function generateRandomSubdomain(length: number = 8): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


export default function KeywordCombinerPage() {
  const [keywordLists, setKeywordLists] = useState<string[]>(['', '']);
  const [suffix, setSuffix] = useState('2008TH');
  
  const [allTemplates, setAllTemplates] = useState<ReadmeTemplate[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<ReadmeTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<ReadmeTemplate | null>(null);

  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);

  const { toast } = useToast();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const combinedTemplates = useMemo(() => [...allTemplates, ...sessionTemplates], [allTemplates, sessionTemplates]);

  const fetchPermissions = useCallback(async () => {
    if (!user) return;
    try {
        const result = await listAllUsers();
        if (result.success && result.users) {
            const currentUser = result.users.find(u => u.uid === user.uid);
            setIsAdmin(currentUser?.permissions?.includes('admin') || user.email === 'haido30112002@gmail.com');
        }
    } catch(e) {
        // This can fail if the admin SDK is not configured, which is fine.
        // We'll just rely on the hardcoded email check.
        if (user.email === 'haido30112002@gmail.com') {
            setIsAdmin(true);
        }
        console.warn("Could not fetch user permissions, functionality may be limited.", e);
    }
  }, [user]);

  const fetchTemplates = useCallback(async () => {
      setIsTemplateLoading(true);
      try {
          const result = await getReadmeTemplates();
          if (result.success && result.data) {
              setAllTemplates(result.data);
              if (!editingTemplate && result.data.length > 0) {
                  setEditingTemplate(result.data[0]);
              }
          } else {
              toast({ 
                  title: 'Lỗi tải mẫu từ CSDL', 
                  description: `Đã xảy ra lỗi: ${result.message}`, 
                  variant: 'destructive',
                  duration: 10000,
              });
          }
      } catch (error: any) {
          toast({ 
              title: 'Lỗi không mong muốn', 
              description: `Không thể tải các mẫu README từ cơ sở dữ liệu. Vui lòng kiểm tra console để biết thêm chi tiết. Lỗi: ${error.message}`, 
              variant: 'destructive',
              duration: 10000,
          });
          console.error("Fetch templates error:", error);
      } finally {
          setIsTemplateLoading(false);
      }
  }, [toast, editingTemplate]);

  useEffect(() => {
    fetchPermissions();
    fetchTemplates();
  }, [fetchPermissions, fetchTemplates]);

  const handleListChange = (index: number, value: string) => {
    const newLists = [...keywordLists];
    newLists[index] = value;
    setKeywordLists(newLists);
  };

  const addList = () => {
    setKeywordLists([...keywordLists, '']);
  };

  const removeList = (index: number) => {
    if (keywordLists.length <= 2) {
        toast({ title: "Không thể xóa", description: "Phải có ít nhất 2 danh sách.", variant: "destructive"});
        return;
    }
    const newLists = keywordLists.filter((_, i) => i !== index);
    setKeywordLists(newLists);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileReadPromises = Array.from(files).map(file => {
      return new Promise<ReadmeTemplate>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve({ id: `session-${Date.now()}-${Math.random()}`, name: file.name, content });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    });

    Promise.all(fileReadPromises)
      .then(newFiles => {
        setSessionTemplates(prev => [...prev, ...newFiles]);
        toast({ title: 'Tệp đã được thêm', description: `${newFiles.length} mẫu tạm thời đã được thêm cho phiên làm việc này.` });
      })
      .catch(error => {
        toast({ title: 'Lỗi đọc tệp', description: `Đã xảy ra lỗi khi đọc tệp: ${error}`, variant: 'destructive' });
      });
      
    if (event.target) {
        event.target.value = "";
    }
  };

  const handleProcess = () => {
    setIsLoading(true);

    if (combinedTemplates.length === 0) {
      toast({ title: 'Chưa có mẫu README', description: 'Vui lòng tải lên hoặc tạo ít nhất một mẫu README.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const firstList = keywordLists[0].split('\n').map(item => item.trim()).filter(Boolean);
    
    if (firstList.length === 0) {
        toast({ title: 'Dữ liệu từ khóa không hợp lệ', description: 'Danh sách từ khóa đầu tiên (Chính) không được để trống.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }
    
    const otherLists = keywordLists.slice(1).map(list => list.split('\n').map(item => item.trim()).filter(Boolean));

    const updatedFiles = firstList.map((firstKeyword, index) => {
        const combo = [firstKeyword];
        otherLists.forEach(list => {
            if (list.length > 0) {
                const randomKeyword = list[Math.floor(Math.random() * list.length)];
                combo.push(randomKeyword);
            }
        });
        
        const titleForFile = combo.join(' - ');
        const titleForReadme = combo.join(' - ');

        let randomReadmeContent = combinedTemplates[Math.floor(Math.random() * combinedTemplates.length)].content;

        const urlRegex = /(https?:\/\/)([a-zA-Z0-9-]+)(\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        randomReadmeContent = randomReadmeContent.replace(urlRegex, (match, protocol, subdomain, domain) => {
            return `${protocol}${generateRandomSubdomain()}${domain}`;
        });

        const readmeHeader = `# ${titleForReadme} - ${suffix.trim()}`;
        const updatedContent = `${readmeHeader}\n${randomReadmeContent}`;
      
        return {
            name: titleForFile,
            content: updatedContent,
        };
    });

    setProcessedFiles(updatedFiles);
    toast({ title: 'Xử lý hoàn tất!', description: `${updatedFiles.length} tệp đã được tạo với tiêu đề và nội dung ngẫu nhiên.` });
    setIsLoading(false);
  };
  
    // Tải xuống 1 file readme.md
    const handleDownloadSingleFile = (file: ProcessedFile) => {
    try {
        if (!file) return;
        const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
        saveAs(blob, "readme.md");
    } catch (error) {
        console.error(error);
        toast({
        title: "Lỗi tải xuống",
        description: "Không thể tải thư viện cần thiết.",
        variant: "destructive",
        });
    }
    };

    // Tải xuống tất cả dưới dạng ZIP
    const handleDownloadZip = async () => {
    if (!processedFiles || processedFiles.length === 0) return;
    setIsDownloadingZip(true);

    try {
        const zip = new JSZip();

        processedFiles.forEach((file, index) => {
        const folder = zip.folder((index + 1).toString());
        folder?.file("readme.md", file.content);
        });

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "updated_readmes.zip");
    } catch (error) {
        console.error(error);
        toast({
        title: "Lỗi tạo ZIP",
        description: "Không thể tạo tệp ZIP.",
        variant: "destructive",
        });
    } finally {
        setIsDownloadingZip(false);
    }
    };

    // Tải xuống danh sách titles
    const handleDownloadTitles = () => {
    if (!processedFiles || processedFiles.length === 0) return;

    try {
        const titlesString = processedFiles.map(file => `"${file.name}"`).join(", ");
        const blob = new Blob([titlesString], { type: "text/plain;charset=utf-8" });
        saveAs(blob, "titles.txt");
    } catch (error) {
        console.error(error);
        toast({
        title: "Lỗi tải xuống",
        description: "Không thể tải thư viện cần thiết.",
        variant: "destructive",
        });
    }
    };
  
  const handleSaveTemplate = async () => {
      if (!isAdmin || !editingTemplate) return;
      if (!editingTemplate.name || !editingTemplate.content) {
          toast({ title: 'Thiếu trường', description: 'Tên và nội dung mẫu là bắt buộc.', variant: 'destructive' });
          return;
      }
      
      setIsLoading(true);
      try {
          let result;
          if (editingTemplate.id && !editingTemplate.id.startsWith('session-')) {
              result = await updateReadmeTemplate(editingTemplate.id, { name: editingTemplate.name, content: editingTemplate.content });
          } else {
              result = await addReadmeTemplate({ name: editingTemplate.name, content: editingTemplate.content });
          }

          if (result.success) {
              toast({ title: 'Thành công', description: 'Mẫu đã được lưu vào cơ sở dữ liệu.'});
              fetchTemplates(); // Refresh list
          } else {
              toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
          }
      } catch (error: any) {
          toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleNewTemplate = () => {
    if (!isAdmin) return;
    const newTemplate = { id: `session-${Date.now()}`, name: 'Mẫu mới.md', content: ''};
    setEditingTemplate(newTemplate);
  }
  
  const handleDeleteTemplate = async () => {
      if (!isAdmin || !editingTemplate || !editingTemplate.id || editingTemplate.id.startsWith('session-')) {
          toast({ title: 'Không thể xóa', description: 'Không thể xóa mẫu tạm thời hoặc mẫu chưa được chọn.', variant: 'destructive' });
          return;
      }
      if (confirm(`Bạn có chắc muốn xóa vĩnh viễn mẫu "${editingTemplate.name}" không?`)) {
          setIsLoading(true);
          try {
              const result = await deleteReadmeTemplate(editingTemplate.id);
              if (result.success) {
                  toast({ title: 'Đã xóa', description: 'Mẫu đã được xóa khỏi cơ sở dữ liệu.'});
                  setEditingTemplate(null);
                  fetchTemplates();
              } else {
                  toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
              }
          } catch (error: any) {
               toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
          } finally {
              setIsLoading(false);
          }
      }
  }

  const totalCombinations = keywordLists[0].split('\n').filter(Boolean).length;

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Trình tạo & Cập nhật README hàng loạt</CardTitle>
          <CardDescription>
            Quản lý kho mẫu README chung, kết hợp từ khóa để tạo tiêu đề, sau đó xử lý để tạo ra các tệp hoàn chỉnh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* Step 1: Manage Templates */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1" className="border rounded-lg">
                    <AccordionTrigger className="p-4 bg-muted/50 rounded-t-lg hover:no-underline">
                        <h3 className="font-semibold text-lg">Bước 1: Quản lý mẫu README</h3>
                    </AccordionTrigger>
                    <AccordionContent className="p-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left: Template List */}
                            <div className="md:col-span-1 space-y-2">
                                <Label>Các mẫu có sẵn ({combinedTemplates.length})</Label>
                                <div className="flex items-center gap-2">
                                    {isAdmin && <Button onClick={handleNewTemplate} size="sm" className="flex-1"><PlusCircle className="mr-2 h-4 w-4"/> Mới</Button>}
                                    <Button asChild variant="outline" size="sm" className="flex-1">
                                        <label htmlFor="file-upload-input" className="cursor-pointer">
                                            <UploadCloud className="mr-2 h-4 w-4" /> Tải lên (Tạm thời)
                                        </label>
                                    </Button>
                                    <input id="file-upload-input" type="file" multiple accept=".md,.txt" onChange={handleFileChange} className="hidden" disabled={isLoading} />
                                </div>
                                <ScrollArea className="h-64 border rounded bg-background">
                                   {isTemplateLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
                                        </div>
                                   ) : (
                                       <div className="p-2 space-y-1">
                                         {combinedTemplates.map((template) => (
                                            <Button
                                                key={template.id}
                                                variant={editingTemplate?.id === template.id ? 'secondary' : 'ghost'}
                                                className="w-full justify-start text-left h-auto"
                                                onClick={() => setEditingTemplate(template)}
                                            >
                                                <div className="flex flex-col">
                                                  <span>{template.name}</span>
                                                  {template.id.startsWith('session-') && <Badge variant="outline" className="text-[10px] w-fit">Tạm thời</Badge>}
                                                </div>
                                            </Button>
                                         ))}
                                       </div>
                                   )}
                                </ScrollArea>
                            </div>
                            {/* Right: Template Editor */}
                            <div className="md:col-span-2 space-y-3">
                                {editingTemplate ? (
                                    <>
                                        <div className="space-y-1">
                                            <Label htmlFor="template-name">Tên Mẫu</Label>
                                            <Input 
                                                id="template-name" 
                                                value={editingTemplate.name} 
                                                onChange={e => setEditingTemplate(prev => prev ? {...prev, name: e.target.value} : null)}
                                                disabled={!isAdmin || isLoading}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="template-content">Nội dung Mẫu</Label>
                                            <Textarea 
                                                id="template-content" 
                                                value={editingTemplate.content} 
                                                onChange={e => setEditingTemplate(prev => prev ? {...prev, content: e.target.value} : null)}
                                                className="h-48 font-mono text-xs"
                                                disabled={!isAdmin || isLoading}
                                            />
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-2">
                                                <Button onClick={handleSaveTemplate} disabled={isLoading}>
                                                    <Save className="mr-2 h-4 w-4"/> Lưu vào CSDL
                                                </Button>
                                                <Button 
                                                    variant="destructive"
                                                    onClick={handleDeleteTemplate} 
                                                    disabled={isLoading || !editingTemplate.id || editingTemplate.id.startsWith('session-')}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4"/> Xóa khỏi CSDL
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        {isTemplateLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <p>Chọn một mẫu để xem hoặc chỉnh sửa.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Step 2: Combine Keywords */}
            <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Bước 2: Tạo Tiêu đề</h3>
                    <Badge>{totalCombinations} tiêu đề sẽ được tạo</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {keywordLists.map((list, index) => (
                        <div key={index} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <Label htmlFor={`list-${index}`}>Danh sách từ khóa {index + 1} {index === 0 && <span className="text-xs font-normal text-muted-foreground">(Chính)</span>}</Label>
                                {keywordLists.length > 2 && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => removeList(index)} disabled={isLoading}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <Textarea
                                id={`list-${index}`}
                                value={list}
                                onChange={(e) => handleListChange(index, e.target.value)}
                                className="min-h-40"
                                placeholder={`Từ khóa 1\nTừ khóa 2`}
                                disabled={isLoading}
                            />
                        </div>
                    ))}
                </div>
                <div className="flex items-end gap-4 pt-4">
                    <Button variant="outline" onClick={addList} disabled={isLoading}>
                        <PlusCircle className="mr-2" /> Thêm danh sách
                    </Button>
                    <div className="space-y-1.5 max-w-xs">
                        <Label htmlFor="suffix">Hậu tố (Thêm vào cuối tiêu đề)</Label>
                        <Input id="suffix" value={suffix} onChange={e => setSuffix(e.target.value)} placeholder="ví dụ: 2008TH" disabled={isLoading}/>
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleProcess} disabled={isLoading || totalCombinations === 0 || combinedTemplates.length === 0}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2" />}
            Bước 3: Xử lý và tạo {totalCombinations} tệp
          </Button>
        </CardFooter>
      </Card>
      
      {processedFiles.length > 0 && (
         <Card>
            <CardHeader>
                <div className="flex flex-wrap justify-between items-center gap-2">
                    <div>
                        <CardTitle>Kết quả đã xử lý</CardTitle>
                        <CardDescription>Các tệp của bạn đã được cập nhật. Tải xuống từng tệp hoặc tất cả dưới dạng tệp ZIP.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button onClick={handleDownloadTitles} variant="outline" size="sm">
                            <Copy className="mr-2 h-4 w-4" />
                            Tải xuống Tiêu đề
                        </Button>
                        <Button onClick={handleDownloadZip} disabled={isDownloadingZip}>
                            {isDownloadingZip ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Archive className="mr-2 h-4 w-4" />}
                            Tải tất cả ({processedFiles.length} tệp)
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
               <div className="border rounded-md max-h-96 overflow-y-auto">
                <ul className="divide-y">
                    {processedFiles.map((file, index) => (
                        <li key={index} className="flex items-center justify-between p-3">
                           <div className="flex items-center gap-3">
                             <List className="h-5 w-5 text-muted-foreground" />
                             <span className="font-mono text-sm">{file.content.split('\n')[0].replace('# ', '')}</span>
                           </div>
                           <Button variant="ghost" size="sm" onClick={() => handleDownloadSingleFile(file)}>
                               <Download className="mr-2 h-4 w-4" />
                               Tải xuống
                           </Button>
                        </li>
                    ))}
                </ul>
            </div>
            </CardContent>
         </Card>
      )}

    </div>
  );
}
