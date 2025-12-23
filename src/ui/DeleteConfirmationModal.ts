import { App, Modal, Setting } from "obsidian";

export class DeleteConfirmationModal extends Modal {
    onConfirm: () => void;
    count: number;
    fileName: string;

    constructor(app: App, fileName: string, count: number, onConfirm: () => void) {
        super(app);
        this.fileName = fileName;
        this.count = count;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Delete All IDs" });
        contentEl.createEl("p", { text: `Are you sure you want to delete ${this.count} IDs from "${this.fileName}"?` });
        contentEl.createEl("p", {
            text: "This will delete the cards from Anki and remove the ID lines from the file. The note content will remain.",
            cls: "mod-warning"
        });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Delete")
                    .setClass("mod-warning")
                    .onClick(() => {
                        this.close();
                        this.onConfirm();
                    }))
            .addButton((btn) =>
                btn
                    .setButtonText("Cancel")
                    .onClick(() => {
                        this.close();
                    }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
