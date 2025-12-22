import { App, FuzzySuggestModal, TFolder, TAbstractFile } from 'obsidian'

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
    folders: TFolder[]
    onChoose: (folder: TFolder) => void

    constructor(app: App, folders: TFolder[], onChoose: (folder: TFolder) => void) {
        super(app)
        this.folders = folders
        this.onChoose = onChoose
        this.setPlaceholder("Type to search for a folder...")
    }

    getItems(): TFolder[] {
        return this.folders
    }

    getItemText(folder: TFolder): string {
        return folder.path
    }

    onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(folder)
    }
}

export function getAllFolders(app: App): TFolder[] {
    const folders: TFolder[] = []
    const rootFolder = app.vault.getRoot()

    function collectFolders(folder: TAbstractFile) {
        if (folder instanceof TFolder) {
            folders.push(folder)
            folder.children.forEach(child => collectFolders(child))
        }
    }

    collectFolders(rootFolder)
    return folders.slice(1) // Remove root folder
}
