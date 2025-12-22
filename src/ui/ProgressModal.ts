import { Modal, App } from 'obsidian'

export class ProgressModal extends Modal {
    private progressBar: HTMLElement
    private progressText: HTMLElement
    private statusText: HTMLElement
    private cancelButton: HTMLButtonElement
    private onCancel: () => void
    private isCancelled: boolean = false

    constructor(app: App, onCancel?: () => void) {
        super(app)
        this.onCancel = onCancel
    }

    onOpen() {
        const { contentEl } = this

        contentEl.empty()
        contentEl.addClass('anki-progress-modal')

        contentEl.createEl('h2', { text: 'Syncing with Anki' })

        this.statusText = contentEl.createEl('p', {
            text: 'Initializing...',
            cls: 'anki-progress-status'
        })

        const progressContainer = contentEl.createDiv({ cls: 'anki-progress-container' })
        const progressBarBg = progressContainer.createDiv({ cls: 'anki-progress-bg' })
        this.progressBar = progressBarBg.createDiv({ cls: 'anki-progress-bar' })

        this.progressText = contentEl.createEl('p', {
            text: '0%',
            cls: 'anki-progress-text'
        })

        if (this.onCancel) {
            this.cancelButton = contentEl.createEl('button', {
                text: 'Cancel',
                cls: 'mod-warning'
            })
            this.cancelButton.addEventListener('click', () => {
                this.isCancelled = true
                this.cancelButton.disabled = true
                this.cancelButton.setText('Cancelling...')
                if (this.onCancel) {
                    this.onCancel()
                }
            })
        }
    }

    setProgress(current: number, total: number, status?: string) {
        const percentage = Math.round((current / total) * 100)
        this.progressBar.style.width = `${percentage}%`
        this.progressText.setText(`${percentage}% (${current}/${total})`)

        if (status) {
            this.statusText.setText(status)
        }
    }

    setStatus(status: string) {
        this.statusText.setText(status)
    }

    setCancelled(): boolean {
        return this.isCancelled
    }

    onClose() {
        const { contentEl } = this
        contentEl.empty()
    }
}
