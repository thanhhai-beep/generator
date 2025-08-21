

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { listAllUsers, deleteUser, updateUserPermissions } from '@/lib/server-actions';
import { pagePermissions } from '@/app/(admin)/layout';
import type { UserRecord } from 'firebase-admin/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Trash2, Users, AlertTriangle, ShieldCheck, Cog, KeyRound, Pencil, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FormattedDate } from '@/components/formatted-date';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


const ALL_PERMISSIONS = ['admin'];

type UserWithPermissions = UserRecord & { permissions?: string[] };

function FirebaseAdminNotConfigured() {
    return (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Firebase Admin SDK chưa được cấu hình</AlertTitle>
            <AlertDescription>
                <p>Chức năng quản lý người dùng đã bị vô hiệu hóa. Để bật, bạn phải đặt các biến môi trường sau trong tệp `.env.local` của mình:</p>
                <ul className="list-disc list-inside my-2 font-mono text-xs bg-muted p-2 rounded-md">
                    <li>FIREBASE_PROJECT_ID="your-project-id"</li>
                    <li>FIREBASE_CLIENT_EMAIL="your-client-email"</li>
                    <li>FIREBASE_PRIVATE_KEY="your-private-key"</li>
                </ul>
                <div className="mt-3">
                     <h4 className="font-semibold mb-1 flex items-center gap-2"><Cog className="h-4 w-4"/>Cách lấy các giá trị này:</h4>
                     <ol className="list-decimal list-inside text-xs space-y-1">
                        <li>Truy cập <a href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk" target="_blank" rel="noopener noreferrer" className="underline font-medium">Bảng điều khiển Firebase</a>.</li>
                        <li>Nhấp vào nút "Generate new private key".</li>
                        <li>Mở tệp JSON đã tải xuống và sao chép các giá trị tương ứng (`project_id`, `client_email`, `private_key`) vào các biến môi trường.</li>
                        <li>Lưu ý: Đối với `FIREBASE_PRIVATE_KEY`, hãy sao chép toàn bộ chuỗi bên trong dấu ngoặc kép, bao gồm cả `-----BEGIN PRIVATE KEY-----` và `-----END PRIVATE KEY-----`.</li>
                     </ol>
                </div>
                 <Button variant="link" asChild className="p-0 h-auto mt-2">
                    <a href="https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk" target="_blank" rel="noopener noreferrer">
                       <KeyRound className="mr-2 h-4 w-4"/>
                       Đến Firebase để tạo khóa
                    </a>
                </Button>
            </AlertDescription>
        </Alert>
    );
}

function EditPermissionsDialog({
    user,
    onClose,
    onPermissionsUpdate,
}: {
    user: UserWithPermissions;
    onClose: () => void;
    onPermissionsUpdate: () => void;
}) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(user.permissions || []);
    
    const isAdmin = selectedPermissions.includes('admin');
    
    const handlePermissionChange = (permission: string, checked: boolean) => {
        setSelectedPermissions(prev => 
            checked ? [...prev, permission] : prev.filter(p => p !== permission)
        );
    };

    const groupedPages = useMemo(() => {
        return Object.entries(pagePermissions).reduce((acc, [path, { label, group }]) => {
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push({ path, label });
            return acc;
        }, {} as Record<string, { path: string; label: string }[]>);
    }, []);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateUserPermissions(user.uid, selectedPermissions, user.email);
            if (result.success) {
                toast({ title: 'Thành công', description: 'Quyền hạn người dùng đã được cập nhật.' });
                onPermissionsUpdate();
                onClose();
            } else {
                toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Lỗi không mong muốn', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa quyền hạn cho</DialogTitle>
                    <DialogDescription>{user.email || user.uid}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                    <div className="py-4 pr-6 space-y-4">
                        <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-md border">
                            <Checkbox
                                id="perm-admin"
                                checked={isAdmin}
                                onCheckedChange={(checked) => handlePermissionChange('admin', !!checked)}
                            />
                            <Label htmlFor="perm-admin" className="font-semibold text-base">Quản trị viên (Admin)</Label>
                            <Badge variant="destructive">Toàn quyền truy cập</Badge>
                        </div>
                        
                        <Accordion type="multiple" defaultValue={Object.keys(groupedPages)} className="w-full">
                           {Object.entries(groupedPages).map(([groupName, pages]) => (
                               <AccordionItem value={groupName} key={groupName}>
                                   <AccordionTrigger className="text-base font-medium">{groupName}</AccordionTrigger>
                                   <AccordionContent>
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 pl-2">
                                           {pages.map(page => (
                                               <div key={page.path} className="flex items-center space-x-2">
                                                   <Checkbox
                                                       id={`perm-${page.path}`}
                                                       checked={isAdmin || selectedPermissions.includes(page.path)}
                                                       onCheckedChange={(checked) => handlePermissionChange(page.path, !!checked)}
                                                       disabled={isAdmin}
                                                   />
                                                   <Label htmlFor={`perm-${page.path}`} className="font-normal">{page.label}</Label>
                                               </div>
                                           ))}
                                       </div>
                                   </AccordionContent>
                               </AccordionItem>
                           ))}
                        </Accordion>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Hủy</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Lưu thay đổi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const { toast } = useToast();

  const fetchUsersAndConfig = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const result = await listAllUsers();
      if (result.success && result.users) {
        setUsers(result.users);
        setIsConfigured(true);
      } else {
        setUsers([]);
        setIsConfigured(false);
        // Don't show a toast for config error, the UI will handle it.
        if (result.message && !result.message.includes('Firebase Admin SDK is not configured')) {
            toast({
              title: 'Error fetching users',
              description: result.message,
              variant: 'destructive',
            });
        }
      }
    } catch (error: any) {
      setUsers([]);
      setIsConfigured(false);
      toast({
        title: 'An unexpected error occurred',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsersAndConfig();
  }, [fetchUsersAndConfig]);

  const handleDeleteUser = async (uid: string) => {
    setIsDeleting(uid);
    try {
        const result = await deleteUser(uid);
        if (result.success) {
            toast({
                title: 'User Deleted',
                description: `Successfully deleted user ${uid}.`,
            });
            fetchUsersAndConfig(); // Refresh the list
        } else {
            toast({
                title: 'Deletion Failed',
                description: result.message,
                variant: 'destructive',
            });
        }
    } catch (error: any) {
        toast({
            title: 'An unexpected error occurred during deletion',
            description: error.message,
            variant: 'destructive',
        });
    } finally {
        setIsDeleting(null);
    }
  };
  
  const getPermissionDisplayName = (permission: string) => {
    if (permission === 'admin') return 'Admin';
    return pagePermissions[permission]?.label || permission;
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          View and manage users who can log into this application and their permissions stored in Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured ? (
          <FirebaseAdminNotConfigured />
        ) : isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>User ID (UID)</TableHead>
                  <TableHead>Quyền hạn</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         {user.email}
                         {user.emailVerified && <ShieldCheck className="h-4 w-4 text-green-500" title="Email Verified"/>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{user.uid}</Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {user.permissions?.length ? user.permissions.map(p => (
                                <Badge key={p} variant={p === 'admin' ? 'default' : 'secondary'} className="capitalize">{getPermissionDisplayName(p)}</Badge>
                            )) : <Badge variant="outline">Không có</Badge>}
                        </div>
                    </TableCell>
                    <TableCell>
                      <FormattedDate date={user.metadata.creationTime} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingUser(user)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={isDeleting === user.uid}
                              >
                                {isDeleting === user.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This will permanently delete the user <strong className="font-mono">{user.email || user.uid}</strong> and all their permissions. This action cannot be undone.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.uid)} className="bg-destructive hover:bg-destructive/90">
                                      Yes, delete user
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    {editingUser && (
        <EditPermissionsDialog 
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onPermissionsUpdate={fetchUsersAndConfig}
        />
    )}
    </>
  );
}
