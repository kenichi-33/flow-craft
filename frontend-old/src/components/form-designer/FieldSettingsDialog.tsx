
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    FormControlLabel,
    Switch,
    Typography,
    Divider,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface FormField {
    id: string;
    type: string;
    label: string;
    options?: string[];
    required?: boolean;
}

interface FieldSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (fieldId: string, updates: Partial<FormField>) => void;
    field: FormField;
    existingIds: string[];
}

export default function FieldSettingsDialog({
    open,
    onClose,
    onSave,
    field,
    existingIds
}: FieldSettingsDialogProps) {
    const [label, setLabel] = useState(field.label);
    const [id, setId] = useState(field.id);
    const [required, setRequired] = useState(field.required || false);
    const [optionsText, setOptionsText] = useState((field.options || []).join(', '));
    const [idError, setIdError] = useState<string | null>(null);

    // Reset state when field changes or dialog opens
    useEffect(() => {
        if (open) {
            setLabel(field.label);
            setId(field.id);
            setRequired(field.required || false);
            setOptionsText((field.options || []).join(', '));
            setIdError(null);
        }
    }, [open, field]);

    const validateId = (newId: string): string | null => {
        if (!newId.trim()) return 'IDは必須です';
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newId)) return 'IDは英数字とアンダースコアのみ（先頭は英字または_）';
        if (newId !== field.id && existingIds.includes(newId)) return 'このIDは既に使用されています';
        return null;
    };

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newId = e.target.value;
        setId(newId);
        setIdError(validateId(newId));
    };

    const handleSave = () => {
        const idValidationError = validateId(id);
        if (idValidationError) {
            setIdError(idValidationError);
            return;
        }

        const updates: Partial<FormField> = {
            label,
            id,
            required,
        };

        if (['select', 'radio', 'checkbox'].includes(field.type)) {
            updates.options = optionsText.split(',').map(s => s.trim()).filter(s => s);
        }

        onSave(field.id, updates);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">フィールド設定</Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
                    {/* Basic Settings */}
                    <Box>
                        <TextField
                            fullWidth
                            label="ラベル"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            size="small"
                            helperText="フォームに表示される項目名です"
                        />
                    </Box>

                    <Box>
                        <TextField
                            fullWidth
                            label="フィールドID"
                            value={id}
                            onChange={handleIdChange}
                            error={!!idError}
                            helperText={idError || "システム内部で使用される一意のIDです（英数字）"}
                            size="small"
                        />
                    </Box>

                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={required}
                                    onChange={(e) => setRequired(e.target.checked)}
                                    color="primary"
                                />
                            }
                            label="必須項目にする"
                        />
                    </Box>

                    {/* Options Settings for Select/Radio/Checkbox */}
                    {['select', 'radio', 'checkbox'].includes(field.type) && (
                        <>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    選択肢設定
                                </Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label="選択肢"
                                    placeholder="選択肢1, 選択肢2, 選択肢3"
                                    value={optionsText}
                                    onChange={(e) => setOptionsText(e.target.value)}
                                    helperText="カンマ区切りで入力してください"
                                    size="small"
                                />
                            </Box>
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    キャンセル
                </Button>
                <Button onClick={handleSave} variant="contained" color="primary">
                    保存
                </Button>
            </DialogActions>
        </Dialog>
    );
}
