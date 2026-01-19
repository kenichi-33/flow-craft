import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Toggle } from '@/components/ui/toggle'
import { 
    Bold, 
    Italic, 
    Strikethrough, 
    Link as LinkIcon,
    Unlink,
    Table as TableIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Highlighter,
    Quote,
    Code,
    List,
    ListOrdered
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState, useCallback } from 'react'

// Define FontSize Extension
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        }
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {}
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            }
                        },
                    },
                },
            },
        ]
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run()
            },
            unsetFontSize: () => ({ chain }: any) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run()
            },
        }
    },
})

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    className?: string
    editorClassName?: string
}

export function RichTextEditor({ value, onChange, disabled, className, editorClassName }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            Color,
            FontSize,
            Highlight.configure({
                multicolor: true,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline hover:text-primary/80',
                },
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'border-collapse table-auto w-full',
                },
            }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value,
        editable: !disabled,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
    })
    
    // Link Dialog State
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const openLinkDialog = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href;
        setLinkUrl(previousUrl || '');
        setLinkDialogOpen(true);
    }, [editor]);

    const saveLink = useCallback(() => {
        if (!editor) return;
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }
        setLinkDialogOpen(false);
    }, [editor, linkUrl]);

    if (!editor) {
        return null
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className={`border rounded-md overflow-hidden bg-background ${className || ''}`}>
                <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/20 items-center">
                    {/* FONT SIZE */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Select 
                                    value={editor.getAttributes('textStyle').fontSize || 'default'} 
                                    onValueChange={(val) => {
                                        if (val === 'default') {
                                            (editor.chain().focus() as any).unsetFontSize().run()
                                        } else {
                                            (editor.chain().focus() as any).setFontSize(val).run()
                                        }
                                    }}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-[80px] h-8 text-xs">
                                        <SelectValue placeholder="サイズ" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">標準</SelectItem>
                                        <SelectItem value="12px">小 (12px)</SelectItem>
                                        <SelectItem value="14px">中 (14px)</SelectItem>
                                        <SelectItem value="18px">大 (18px)</SelectItem>
                                        <SelectItem value="24px">特大 (24px)</SelectItem>
                                        <SelectItem value="30px">極大 (30px)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>フォントサイズ</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />

                    {/* BASIC FORMATTING */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} disabled={disabled} aria-label="Bold">
                                <Bold className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>太字 (Bold)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} disabled={disabled} aria-label="Italic">
                                <Italic className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>斜体 (Italic)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive('strike')} onPressedChange={() => editor.chain().focus().toggleStrike().run()} disabled={disabled} aria-label="Strike">
                                <Strikethrough className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>取り消し線 (Strikethrough)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Select 
                                    value={editor.getAttributes('highlight').color || 'none'} 
                                    onValueChange={(val) => {
                                        if (val === 'none') {
                                            editor.chain().focus().unsetHighlight().run()
                                        } else {
                                            editor.chain().focus().toggleHighlight({ color: val }).run()
                                        }
                                    }}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-[30px] h-8 px-0 flex justify-center border-none hover:bg-muted focus:ring-0">
                                        <Highlighter className="h-4 w-4" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">なし</SelectItem>
                                        <SelectItem value="#ffff00"><span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#ffff00] border"/> 黄</span></SelectItem>
                                        <SelectItem value="#00ff00"><span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#00ff00] border"/> 緑</span></SelectItem>
                                        <SelectItem value="#00ffff"><span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#00ffff] border"/> 水色</span></SelectItem>
                                        <SelectItem value="#ff00ff"><span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#ff00ff] border"/> ピンク</span></SelectItem>
                                        <SelectItem value="#ffa500"><span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#ffa500] border"/> オレンジ</span></SelectItem>
                                        <SelectItem value="#ff0000"><span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#ff0000] border"/> 赤</span></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>ハイライト</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive('codeBlock')} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()} disabled={disabled} aria-label="Code Block">
                                <Code className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>コードブロック</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} disabled={disabled} aria-label="Blockquote">
                                <Quote className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>引用 (Blockquote)</TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-5 bg-border mx-1" />

                    {/* ALIGNMENT */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()} disabled={disabled} aria-label="Left Align">
                                <AlignLeft className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>左揃え</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()} disabled={disabled} aria-label="Center Align">
                                <AlignCenter className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>中央揃え</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()} disabled={disabled} aria-label="Right Align">
                                <AlignRight className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>右揃え</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />
                    
                    {/* LISTS */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Select 
                                    value={
                                        editor.isActive('bulletList') ? 'bullet' :
                                        editor.isActive('orderedList') ? 'ordered' :
                                        'none'
                                    } 
                                    onValueChange={(val) => {
                                        if (val === 'bullet') editor.chain().focus().toggleBulletList().run();
                                        else if (val === 'ordered') editor.chain().focus().toggleOrderedList().run();
                                    }}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-[30px] h-8 px-0 flex justify-center border-none hover:bg-muted focus:ring-0">
                                        {editor.isActive('orderedList') ? <ListOrdered className="h-4 w-4" /> : <List className="h-4 w-4" />}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">リストなし</SelectItem>
                                        <SelectItem value="bullet"><span className="flex items-center gap-2"><List className="h-3 w-3"/> 箇条書き</span></SelectItem>
                                        <SelectItem value="ordered"><span className="flex items-center gap-2"><ListOrdered className="h-3 w-3"/> 番号付き</span></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>リスト形式</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />
                    
                    {/* LINK & COLOR */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Toggle
                                size="sm"
                                pressed={editor.isActive('link')}
                                onPressedChange={openLinkDialog}
                                disabled={disabled}
                                aria-label="Set link"
                            >
                                <LinkIcon className="h-4 w-4" />
                            </Toggle>
                        </TooltipTrigger>
                        <TooltipContent>リンクを挿入</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().unsetLink().run()}
                                disabled={disabled || !editor.isActive('link')}
                                className="h-9 px-2.5"
                            >
                                <Unlink className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>リンクを解除</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Select 
                                    value={editor.getAttributes('textStyle').color || '#000000'}
                                    onValueChange={(val) => {
                                        editor.chain().focus().setColor(val).run()
                                    }}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-[30px] h-8 px-0 flex justify-center border-none hover:bg-muted focus:ring-0">
                                         <div 
                                            className="w-4 h-4 rounded-full border" 
                                            style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="#000000"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#000000] border"/> 黒</span></SelectItem>
                                        <SelectItem value="#666666"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#666666] border"/> グレー</span></SelectItem>
                                        <SelectItem value="#ef4444"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#ef4444] border"/> 赤</span></SelectItem>
                                        <SelectItem value="#3b82f6"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#3b82f6] border"/> 青</span></SelectItem>
                                        <SelectItem value="#22c55e"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#22c55e] border"/> 緑</span></SelectItem>
                                        <SelectItem value="#f97316"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#f97316] border"/> オレンジ</span></SelectItem>
                                        <SelectItem value="#a855f7"><span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#a855f7] border"/> 紫</span></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>テキスト色</TooltipContent>
                    </Tooltip>

                    <div className="w-px h-5 bg-border mx-1" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        disabled={disabled} 
                                        className="h-9 px-2.5 data-[state=open]:bg-accent"
                                    >
                                        <TableIcon className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                        3x3 テーブル挿入
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                                        列を左に追加
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                                        列を右に追加
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                                        列を削除
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                                        行を上に追加
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                                        行を下に追加
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                                        行を削除
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()}>
                                        テーブル削除
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()}>
                                        セルを結合
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()}>
                                        セルを分割
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent>テーブル操作</TooltipContent>
                    </Tooltip>
                </div>
                <div className={`p-2 min-h-[150px] prose prose-sm max-w-none dark:prose-invert focus:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:outline-none ${editorClassName || ''}`}>
                    <EditorContent editor={editor} />
                </div>
            </div>

            {/* Link Dialog */}
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>リンクの編集</DialogTitle>
                        <DialogDescription>
                            URLを入力してください。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="url">URL</Label>
                            <Input
                                id="url"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="https://example.com"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        saveLink();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={saveLink}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
