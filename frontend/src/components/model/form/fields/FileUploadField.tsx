import { useState, useRef, useCallback, useEffect } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText, Download, Loader2 } from 'lucide-react';

interface FileInfo {
    id: string;
    filename: string;
    size: number;
    status: 'pending' | 'uploaded' | 'error';
}

interface FileUploadFieldProps {
    fieldId: string;
    control: Control<any>;
    readOnly?: boolean;
    required?: boolean;
    acceptedTypes?: string;
    maxSize?: number; // MB
    multiple?: boolean;
    maxFiles?: number;
    value?: string | string[];
}

const MAX_FILE_SIZE_MB = 10;

export default function FileUploadField({
    fieldId,
    control,
    readOnly = false,
    required,
    acceptedTypes,
    maxSize = MAX_FILE_SIZE_MB,
    multiple = false,
    maxFiles,
    value
}: FileUploadFieldProps) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load existing file info on mount
    useEffect(() => {
        const fetchFileInfos = async () => {
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            if (ids.length === 0) return;

            // Avoid refetching if we already have info
            const missingIds = ids.filter(id => !fileInfos.find(f => f.id === id));
            if (missingIds.length === 0) return;

            try {
                const newInfos = await Promise.all(missingIds.map(async id => {
                    try {
                        const res = await api.get<FileInfo>(`/files/${id}`);
                        return res;
                    } catch {
                        return null;
                    }
                }));
                
                setFileInfos(prev => {
                    const validNewInfos = newInfos.filter(Boolean) as FileInfo[];
                    // Merge and deduplicate
                    // Use a Map to ensure uniqueness by ID
                    const map = new Map();
                    [...prev, ...validNewInfos].forEach(item => map.set(item.id, item));
                    return Array.from(map.values());
                });
            } catch (err) {
                console.error('Failed to fetch file infos:', err);
            }
        };

        fetchFileInfos();
    }, [value]);

    const handleUpload = useCallback(async (
        files: File[],
        onChange: (value: string | string[]) => void,
        currentValue: string | string[]
    ) => {
        setError(null);
        setUploading(true);
        setProgress(0);

        // Check max files limit for MULTIPLE mode
        if (multiple && maxFiles) {
            const currentCount = Array.isArray(currentValue) ? currentValue.length : currentValue ? 1 : 0;
            if (currentCount + files.length > maxFiles) {
                setError(`アップロードできるファイル数は最大${maxFiles}個です`);
                setUploading(false);
                return;
            }
        }

        // Check file count for SINGLE mode
        if (!multiple) {
            if (files.length > 1) {
                setError('アップロードできるファイルは1つのみです');
                setUploading(false);
                return;
            }
            
            // Check if file already exists (prevent silent replacement if user wants strict "1 file" warning)
            if (currentValue && (Array.isArray(currentValue) ? currentValue.length > 0 : true)) {
                setError('すでにファイルが設定されています。変更する場合は削除してからアップロードしてください。');
                setUploading(false);
                return;
            }
        }

        const uploadedIds: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Validate size
            if (file.size > maxSize * 1024 * 1024) {
                setError(`ファイルサイズが上限 (${maxSize}MB) を超えています: ${file.name}`);
                continue;
            }

            // Validate type
            if (acceptedTypes) {
                const ext = '.' + file.name.split('.').pop()?.toLowerCase();
                const allowed = acceptedTypes.split(',').map(t => t.trim().toLowerCase());
                if (!allowed.includes(ext)) {
                    setError(`許可されていないファイル形式です: ${file.name}`);
                    continue;
                }
            }

            try {
                // 1. Get presigned URL
                const presignRes = await api.post<{ fileId: string; uploadUrl: string }>('/files/presign', {
                    filename: file.name,
                    mimeType: file.type,
                    size: file.size,
                });

                // 2. Upload directly to MinIO
                const xhr = new XMLHttpRequest();
                await new Promise<void>((resolve, reject) => {
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const pct = Math.round(((i + e.loaded / e.total) / files.length) * 100);
                            setProgress(pct);
                        }
                    };
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            reject(new Error('Upload failed'));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Network error'));
                    xhr.open('PUT', presignRes.uploadUrl);
                    xhr.setRequestHeader('Content-Type', file.type);
                    xhr.send(file);
                });

                // 3. Confirm upload
                await api.post(`/files/${presignRes.fileId}/confirm`, {});

                uploadedIds.push(presignRes.fileId);
                setFileInfos(prev => [...prev, { id: presignRes.fileId, filename: file.name, size: file.size, status: 'uploaded' }]);
            } catch (err: any) {
                setError(`アップロードに失敗しました: ${file.name}`);
                console.error(err);
            }
        }

        setUploading(false);
        setProgress(100);

        // Update form value
        if (uploadedIds.length > 0) {
            if (multiple) {
                const existing = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : [];
                onChange([...existing, ...uploadedIds]);
            } else {
                onChange(uploadedIds[0]);
            }
        }
    }, [acceptedTypes, maxSize, multiple]);

    const handleDownload = useCallback(async (fileId: string) => {
        try {
            const res = await api.get<{ url: string; filename: string }>(`/files/${fileId}/download`);
            window.open(res.url, '_blank');
        } catch (err) {
            console.error('Download failed:', err);
        }
    }, []);

    const handleRemove = useCallback((fileId: string, onChange: (value: string | string[]) => void, currentValue: string | string[]) => {
        setFileInfos(prev => prev.filter(f => f.id !== fileId));
        if (multiple) {
            const arr = Array.isArray(currentValue) ? currentValue : [];
            onChange(arr.filter(id => id !== fileId));
        } else {
            onChange('');
        }
    }, [multiple]);

    // Read-only mode: show download links
    if (readOnly) {
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        if (ids.length === 0) {
            return <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">ファイルなし</div>;
        }
        return (
            <div className="space-y-2">
                {ids.map(id => (
                    <div key={id} className="flex items-center gap-2 p-2 rounded bg-muted">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm flex-1 truncate">{fileInfos.find(f => f.id === id)?.filename || id}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(id)}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <Controller
            name={fieldId}
            control={control}
            rules={{ required }}
            render={({ field }) => {
                const currentIds = Array.isArray(field.value) ? field.value : field.value ? [field.value] : [];

                return (
                    <div className="space-y-2">
                        {/* Upload Zone */}
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                                uploading ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                            }`}
                            onClick={() => inputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/10'); }}
                            onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/10'); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                                const files = Array.from(e.dataTransfer.files);
                                if (files.length > 0) {
                                    // Pass all files to handleUpload to let it validate the count
                                    handleUpload(files, field.onChange, field.value);
                                }
                            }}
                        >
                            {uploading ? (
                                <div className="space-y-2">
                                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                                    <p className="text-sm">アップロード中...</p>
                                    <Progress value={progress} className="w-full max-w-xs mx-auto" />
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm">ファイルをドラッグ&ドロップ</p>
                                    <p className="text-xs text-muted-foreground mt-1">または クリックして選択</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {acceptedTypes ? `許可: ${acceptedTypes}` : 'すべてのファイル'}
                                        {` / 最大 ${maxSize}MB`}
                                    </p>
                                </>
                            )}
                        </div>

                        <input
                            ref={inputRef}
                            type="file"
                            accept={acceptedTypes}
                            multiple={multiple}
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                    handleUpload(files, field.onChange, field.value);
                                }
                                e.target.value = '';
                            }}
                        />

                        {/* Error */}
                        {error && <p className="text-xs text-destructive">{error}</p>}

                        {/* Uploaded Files */}
                        {currentIds.length > 0 && (
                            <div className="space-y-1">
                                {currentIds.map(id => {
                                    const info = fileInfos.find(f => f.id === id);
                                    return (
                                        <div key={id} className="flex items-center gap-2 p-2 rounded bg-muted/50 border">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm flex-1 truncate">{info?.filename || id}</span>
                                            {info && <span className="text-xs text-muted-foreground">{(info.size / 1024).toFixed(1)} KB</span>}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleDownload(id)}
                                                title="ダウンロード"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 hover:text-destructive"
                                                onClick={() => handleRemove(id, field.onChange, field.value)}
                                                title="削除"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }}
        />
    );
}
