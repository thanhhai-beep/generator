
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Cog, KeyRound } from 'lucide-react';
import Link from 'next/link';

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

function FirebaseNotConfigured() {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
            <Card className="w-full max-w-2xl border-destructive">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                        <CardTitle className="text-2xl text-destructive">Yêu cầu Cấu hình Firebase</CardTitle>
                    </div>
                     <CardDescription>
                        Ứng dụng chưa được kết nối với Firebase. Chức năng đăng nhập sẽ bị vô hiệu hóa cho đến khi bạn hoàn tất cấu hình.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><KeyRound className="h-5 w-5" />Biến Môi Trường Là Gì?</h3>
                        <p className="text-muted-foreground">
                            Đây là các "chìa khóa" cho phép ứng dụng của bạn kết nối an toàn đến dự án Firebase.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><Cog className="h-5 w-5" />Cách Lấy Giá Trị</h3>
                         <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                            <li>Truy cập <Link href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Bảng điều khiển Firebase</Link> và chọn dự án.</li>
                            <li>Nhấp vào biểu tượng bánh răng (⚙️) và chọn <strong>Cài đặt dự án</strong>.</li>
                            <li>Trong tab <strong>Chung</strong>, cuộn xuống phần <strong>Ứng dụng của bạn</strong>.</li>
                            <li>Chọn ứng dụng web của bạn (hoặc tạo mới bằng biểu tượng {'</>'}).</li>
                            <li>Trong mục <strong>Cấu hình SDK</strong>, chọn <strong>Config</strong>.</li>
                            <li>Sao chép các khóa hiển thị vào tệp <strong>.env.local</strong> ở thư mục gốc của dự án.</li>
                        </ol>
                    </div>

                    <div className="rounded-md border bg-muted p-4 font-mono text-sm text-foreground/80 space-y-1">
                        <p>NEXT_PUBLIC_FIREBASE_API_KEY="<span className="text-destructive">...giá trị của bạn...</span>"</p>
                        <p>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="<span className="text-destructive">...giá trị của bạn...</span>"</p>
                        <p>NEXT_PUBLIC_FIREBASE_PROJECT_ID="<span className="text-destructive">...giá trị của bạn...</span>"</p>
                        <p>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="<span className="text-destructive">...giá trị của bạn...</span>"</p>
                        <p>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="<span className="text-destructive">...giá trị của bạn...</span>"</p>
                        <p>NEXT_PUBLIC_FIREBASE_APP_ID="<span className="text-destructive">...giá trị của bạn...</span>"</p>
                    </div>
                    <p className="font-semibold text-foreground">
                        Quan trọng: Sau khi cập nhật tệp .env.local, bạn phải khởi động lại máy chủ để các thay đổi có hiệu lực.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export const FirebaseConfigCheck = ({ children }: { children: ReactNode }) => {
    if (!isFirebaseConfigured) {
        return <FirebaseNotConfigured />;
    }
    return <>{children}</>;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
        setLoading(false);
        return;
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
