import type React from 'react';
import { CreateItemModal } from '@/components/editor/modals/CreateItemModal';
import { ClosePromptModal } from '@/components/editor/modals/ClosePromptModal';
import { EditItemModal } from '@/components/editor/modals/EditItemModal';
import { RenameFolderModal } from '@/components/editor/modals/RenameFolderModal';
import { DeleteConfirmModal } from '@/components/editor/modals/DeleteConfirmModal';
import { ImportReactAppModal } from '@/components/editor/modals/ImportReactAppModal';
import type {
  ActiveFile,
  DeleteTarget,
  FolderFormState,
  ModelFormState,
  ModuleFormState,
  NodeMeta,
  PanelScope,
  SharedFileFormState,
  UiFormState,
} from '@/components/editor/types';
import type { ImportedReactAppPayload } from '@/components/editor/utils/importReactApp';

type EditorModalsProps = {
  createModalOpen: boolean;
  createType: 'file' | 'folder' | null;
  createScope: PanelScope | null;
  folderForm: FolderFormState;
  setFolderForm: React.Dispatch<React.SetStateAction<FolderFormState>>;
  moduleForm: ModuleFormState;
  setModuleForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
  modelForm: ModelFormState;
  setModelForm: React.Dispatch<React.SetStateAction<ModelFormState>>;
  sharedFileForm: SharedFileFormState;
  setSharedFileForm: React.Dispatch<React.SetStateAction<SharedFileFormState>>;
  uiForm: UiFormState;
  setUiForm: React.Dispatch<React.SetStateAction<UiFormState>>;
  onCloseCreate: () => void;
  onCreateSubmit: () => void;
  closePromptOpen: boolean;
  pendingDirtyFiles: ActiveFile[];
  pendingCloseBusy: boolean;
  pendingCloseAction: 'close' | 'reload' | null;
  onCancelClosePrompt: () => void;
  onDiscardClosePrompt: () => void;
  onSaveClosePrompt: () => void;
  editModalOpen: boolean;
  editMeta: NodeMeta | null;
  editModuleForm: ModuleFormState;
  setEditModuleForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
  editModelForm: ModelFormState;
  setEditModelForm: React.Dispatch<React.SetStateAction<ModelFormState>>;
  editUiForm: UiFormState;
  setEditUiForm: React.Dispatch<React.SetStateAction<UiFormState>>;
  editSharedPath: string;
  setEditSharedPath: React.Dispatch<React.SetStateAction<string>>;
  onCloseEdit: () => void;
  onEditSubmit: () => void;
  renameFolderOpen: boolean;
  renameFolderName: string;
  setRenameFolderName: React.Dispatch<React.SetStateAction<string>>;
  onCloseRename: () => void;
  onRenameSubmit: () => void;
  deleteModalOpen: boolean;
  deleteTarget: DeleteTarget | null;
  onCloseDelete: () => void;
  onDeleteSubmit: () => void;
  importModalOpen: boolean;
  importBusy: boolean;
  importPayload: ImportedReactAppPayload | null;
  importPackageName: string;
  importPackageVersion: string;
  importDependenciesInput: string;
  importErrorMessage: string;
  onPickImportFiles: (files: FileList | null) => void;
  onImportPackageNameChange: (value: string) => void;
  onImportPackageVersionChange: (value: string) => void;
  onImportDependenciesChange: (value: string) => void;
  onCloseImport: () => void;
  onSubmitImport: () => void;
};

export function EditorModals(props: EditorModalsProps) {
  return (
    <>
      <CreateItemModal
        open={props.createModalOpen}
        createType={props.createType}
        createScope={props.createScope}
        folderForm={props.folderForm}
        setFolderForm={props.setFolderForm}
        moduleForm={props.moduleForm}
        setModuleForm={props.setModuleForm}
        modelForm={props.modelForm}
        setModelForm={props.setModelForm}
        sharedFileForm={props.sharedFileForm}
        setSharedFileForm={props.setSharedFileForm}
        uiForm={props.uiForm}
        setUiForm={props.setUiForm}
        onClose={props.onCloseCreate}
        onSubmit={props.onCreateSubmit}
      />

      <ClosePromptModal
        open={props.closePromptOpen}
        pendingDirtyFiles={props.pendingDirtyFiles}
        pendingCloseBusy={props.pendingCloseBusy}
        pendingCloseAction={props.pendingCloseAction}
        onCancel={props.onCancelClosePrompt}
        onDiscard={props.onDiscardClosePrompt}
        onSave={props.onSaveClosePrompt}
      />

      <EditItemModal
        open={props.editModalOpen}
        editMeta={props.editMeta}
        editModuleForm={props.editModuleForm}
        setEditModuleForm={props.setEditModuleForm}
        editModelForm={props.editModelForm}
        setEditModelForm={props.setEditModelForm}
        editUiForm={props.editUiForm}
        setEditUiForm={props.setEditUiForm}
        editSharedPath={props.editSharedPath}
        setEditSharedPath={props.setEditSharedPath}
        onClose={props.onCloseEdit}
        onSubmit={props.onEditSubmit}
      />

      <RenameFolderModal
        open={props.renameFolderOpen}
        renameFolderName={props.renameFolderName}
        setRenameFolderName={props.setRenameFolderName}
        onClose={props.onCloseRename}
        onSubmit={props.onRenameSubmit}
      />

      <DeleteConfirmModal
        open={props.deleteModalOpen}
        deleteTarget={props.deleteTarget}
        onClose={props.onCloseDelete}
        onSubmit={props.onDeleteSubmit}
      />

      <ImportReactAppModal
        open={props.importModalOpen}
        busy={props.importBusy}
        payload={props.importPayload}
        packageName={props.importPackageName}
        packageVersion={props.importPackageVersion}
        dependenciesInput={props.importDependenciesInput}
        errorMessage={props.importErrorMessage}
        onPickFiles={props.onPickImportFiles}
        onNameChange={props.onImportPackageNameChange}
        onVersionChange={props.onImportPackageVersionChange}
        onDependenciesChange={props.onImportDependenciesChange}
        onClose={props.onCloseImport}
        onImport={props.onSubmitImport}
      />
    </>
  );
}
