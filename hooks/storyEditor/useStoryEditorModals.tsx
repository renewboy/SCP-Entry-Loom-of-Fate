import { useState } from 'react';
import { MapBlueprint, SCPData } from '../../types';
import { repairAnalyzeScpData } from '../../services/ai/schemas';
import { applyLayoutToBlueprint } from '../../utils/mapLayout';

export const useStoryEditorModals = ({
    t,
    blueprint,
    scpData,
    setScpData,
    setBlueprint,
    setPromptsFromData,
    defaultBlueprint,
    templateData
}: {
    t: (key: string, params?: Record<string, string | number>) => any;
    blueprint: MapBlueprint;
    scpData: SCPData;
    setScpData: (newState: SCPData | ((prev: SCPData) => SCPData), commitMode?: 'immediate' | 'deferred') => void;
    setBlueprint: (next: MapBlueprint | ((prev: MapBlueprint) => MapBlueprint), commitMode?: 'immediate' | 'deferred') => void;
    setPromptsFromData: (data: SCPData) => void;
    defaultBlueprint: MapBlueprint;
    templateData: SCPData;
}) => {
    const [modalType, setModalType] = useState<'import' | 'export' | null>(null);
    const [showNewMapConfirm, setShowNewMapConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [importText, setImportText] = useState('');
    const [importFileName, setImportFileName] = useState('');
    const [importError, setImportError] = useState('');

    const closeModal = () => setModalType(null);

    const formatImportError = (errors: string[]) => {
        if (!errors.length) return t('map_editor.import_data_error');
        const detail = errors.slice(0, 3).join('\n');
        return `${t('map_editor.import_data_error')}\n${detail}`;
    };

    const applyImportText = (text: string) => {
        try {
            const json = JSON.parse(text);
            const repairedResult = repairAnalyzeScpData(json);

            if (!repairedResult.valid) {
                console.error('[StoryEditor] Imported JSON failed SCPData schema validation', {
                    initialErrors: repairedResult.initialErrors,
                    finalErrors: repairedResult.finalErrors,
                    rawJson: json,
                    repairedData: repairedResult.data,
                });
                setImportError(formatImportError(repairedResult.finalErrors.length ? repairedResult.finalErrors : repairedResult.initialErrors));
                return;
            }

            const sourceData = repairedResult.data;
            const importedData: SCPData = {
                designation: sourceData.designation,
                name: sourceData.name,
                containmentClass: sourceData.containmentClass,
                role: sourceData.role,
                storyDraft: {
                    roleDetails: sourceData.storyDraft?.roleDetails,
                    storyBackground: sourceData.storyDraft?.storyBackground,
                    narrativeConstraints: sourceData.storyDraft?.narrativeConstraints,
                    openingPrompt: sourceData.storyDraft?.openingPrompt
                },
                visualDescription: sourceData.visualDescription,
                entityDescription: sourceData.entityDescription,
                npcVisuals: sourceData.npcVisuals,
                npcImages: scpData.npcImages,
                mapBlueprint: applyLayoutToBlueprint(sourceData.mapBlueprint, { width: 720, height: 420, paddingX: 60, paddingY: 50 })
            };

            setBlueprint(importedData.mapBlueprint, 'immediate');
            setScpData(importedData, 'immediate');
            setPromptsFromData(importedData);
            setImportError('');
            closeModal();
        } catch (e) {
            setImportError(t('map_editor.json_error'));
        }
    };

    const handleImportFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            setImportText(text);
            setImportFileName(file.name);
        };
        reader.readAsText(file);
    };

    const showImportModal = () => {
        setImportText('');
        setImportFileName('');
        setImportError('');
        setModalType('import');
    };

    const handleReset = () => {
        setShowResetConfirm(true);
    };

    const showExportModal = () => {
        setModalType('export');
    };

    const confirmNewMap = () => {
        setBlueprint(defaultBlueprint, 'immediate');
        setShowNewMapConfirm(false);
    };

    const confirmReset = () => {
        setScpData(templateData, 'immediate');
        setBlueprint(defaultBlueprint, 'immediate');
        setPromptsFromData(templateData);
        setShowResetConfirm(false);
    };

    const exportData = {
        designation: scpData.designation,
        name: scpData.name,
        containmentClass: scpData.containmentClass,
        role: scpData.role,
        storyDraft: {
            roleDetails: scpData.storyDraft?.roleDetails,
            storyBackground: scpData.storyDraft?.storyBackground,
            narrativeConstraints: scpData.storyDraft?.narrativeConstraints,
            openingPrompt: scpData.storyDraft?.openingPrompt
        },
        visualDescription: scpData.visualDescription,
        entityDescription: scpData.entityDescription,
        npcVisuals: scpData.npcVisuals,
        mapBlueprint: blueprint
    };
    const exportJson = JSON.stringify(exportData, null, 2);
    const handleSaveToFile = () => {
        const blob = new Blob([exportJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${scpData.designation || 'story'}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const modal = (() => {
        if (modalType === 'import') {
            return {
                isOpen: true,
                title: t('map_editor.import'),
                content: (
                    <div className="space-y-4">
                        <p className="text-xs text-scp-text/70">{t('map_editor.msg_import')}</p>
                        <div
                            className="w-full border border-dashed border-[var(--scp-border)] bg-black/30 p-3 text-xs text-scp-text/70 text-center"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleImportFile(file);
                            }}
                        >
                            <div className="mb-2">{t('map_editor.msg_import_file')}</div>
                            <label className="inline-flex items-center gap-2 text-[12px] px-2 py-1 bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer">
                                {t('map_editor.btn_choose_file')}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="application/json,.json"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImportFile(file);
                                    }}
                                />
                            </label>
                            {importFileName && (
                                <div className="mt-2 text-[11px] text-scp-text/60">{importFileName}</div>
                            )}
                        </div>
                        <textarea 
                            className="w-full h-40 bg-black/50 border border-[var(--scp-border)] text-xs font-mono p-2 text-scp-text focus:outline-none focus:border-scp-alert"
                            value={importText}
                        onChange={e => {
                            setImportText(e.target.value);
                            if (importError) setImportError('');
                        }}
                            placeholder="{ ... }"
                        />
                    {importError && (
                        <div className="text-[12px] text-scp-alert/90 border border-scp-alert/40 bg-black/40 px-2 py-1 whitespace-pre-wrap">
                            {importError}
                        </div>
                    )}
                    </div>
                ),
                onConfirm: () => {
                    applyImportText(importText);
                }
            };
        }
        if (modalType === 'export') {
            return {
                isOpen: true,
                title: t('map_editor.export'),
                content: (
                    <div className="space-y-4">
                        <textarea 
                            readOnly
                            value={exportJson}
                            className="w-full h-40 bg-black/50 border border-[var(--scp-border)] text-xs font-mono p-2 text-scp-text focus:outline-none focus:border-scp-alert select-all"
                        />
                    </div>
                ),
                extraAction: {
                    labelKey: 'map_editor.btn_save_file',
                    onClick: handleSaveToFile
                },
                onConfirm: () => {
                    navigator.clipboard.writeText(exportJson);
                    closeModal();
                }
            };
        }
        return null;
    })();

    return {
        modal,
        showNewMapConfirm,
        showResetConfirm,
        setShowNewMapConfirm,
        setShowResetConfirm,
        closeModal,
        showImportModal,
        showExportModal,
        handleReset,
        confirmNewMap,
        confirmReset
    };
};
