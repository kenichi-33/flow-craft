import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { 
    Type, AlignLeft, Hash, Calendar, List, CheckSquare, 
    FolderTree, Minus, Heading, GripVertical, Clock, Upload, User, Table, JapaneseYen, Calculator,
    Building2, ToggleLeft, Mail, Phone, Link, Pencil, ArrowUpDown
} from 'lucide-react';

export const TOOLBOX_GROUPS = [
    {
        title: '入力項目',
        items: [
            { type: 'text', label: 'テキスト', Icon: Type },
            { type: 'textarea', label: 'テキストエリア', Icon: AlignLeft },
            { type: 'number', label: '数値', Icon: Hash },
            { type: 'currency', label: '金額 (¥)', Icon: JapaneseYen },
            { type: 'calculation', label: '自動計算', Icon: Calculator },
			{ type: 'email', label: 'メール', Icon: Mail },
			{ type: 'tel', label: '電話番号', Icon: Phone },
			{ type: 'url', label: 'URL', Icon: Link },
            { type: 'date', label: '日付', Icon: Calendar },
            { type: 'time', label: '時間', Icon: Clock },
            { type: 'dateRange', label: '日付範囲', Icon: Calendar },
            { type: 'file', label: 'ファイル', Icon: Upload },
        ]
    },
    {
        title: '高度な項目',
        items: [
             { type: 'array', label: '明細テーブル', Icon: Table },
        ]
    },
    {
        title: '選択項目',
        items: [
            { type: 'select', label: 'セレクト', Icon: List },
            { type: 'radio', label: 'ラジオ', Icon: CheckSquare },
            { type: 'checkbox', label: 'チェックボックス', Icon: CheckSquare },
			{ type: 'switch', label: 'スイッチ', Icon: ToggleLeft },
            { type: 'user-select', label: 'ユーザー選択', Icon: User },
			{ type: 'department', label: '部署選択', Icon: Building2 },
        ]
    },
    {
        title: 'レイアウト・表示',
        items: [
            { type: 'group', label: 'グループ', Icon: FolderTree },
            { type: 'divider', label: '区切り線', Icon: Minus },
            { type: 'label', label: '見出し', Icon: Heading },
            { type: 'section', label: 'セクション見出し', Icon: Heading },
            { type: 'richText', label: '説明テキスト', Icon: Pencil },
            { type: 'spacer', label: 'スペーサー', Icon: ArrowUpDown },
        ]
    }
];

function ToolboxItem({ type, label, Icon }: { type: string; label: string; Icon: React.ElementType }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `toolbox-${type}`,
        data: { type, label, isToolboxItem: true }
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`p-2 mb-1.5 flex items-center gap-2 cursor-grab rounded-lg border bg-background transition-all group ${isDragging ? 'opacity-50 border-primary' : 'border-border hover:bg-muted hover:border-primary'}`}
        >
            <div className="p-1.5 bg-primary/10 rounded text-primary"><Icon className="h-4 w-4" /></div>
            <span className="text-xs font-medium flex-1">{label}</span>
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

export default function FormEditorToolbox() {
    return (
        <div className="space-y-4">
            {TOOLBOX_GROUPS.map((group) => (
                <div key={group.title}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wide">{group.title}</p>
                    <div className="space-y-1">
                        {group.items.map((item) => <ToolboxItem key={item.type} {...item} />)}
                    </div>
                </div>
            ))}
        </div>
    );
}
