export interface TabConfig {
    id: string
    name: string
    icon?: string
}

export class TabContainer {
    private container: HTMLElement
    private tabsHeader: HTMLElement
    private tabsContent: HTMLElement
    private tabs: Map<string, HTMLElement> = new Map()
    private activeTab: string | null = null

    constructor(container: HTMLElement, tabs: TabConfig[], initialTabId?: string) {
        this.container = container

        // Create tabs header
        this.tabsHeader = container.createDiv({ cls: 'anki-tabs-header' })

        // Create tabs content container
        this.tabsContent = container.createDiv({ cls: 'anki-tabs-content' })

        // Initialize tabs
        tabs.forEach((tab, index) => {
            const isActive = initialTabId ? tab.id === initialTabId : index === 0
            this.createTab(tab, isActive)
        })
    }

    getActiveTab(): string | null {
        return this.activeTab
    }

    private createTab(config: TabConfig, isActive: boolean = false) {
        // Create tab button in header
        const tabButton = this.tabsHeader.createEl('button', {
            text: config.name,
            cls: 'anki-tab-button'
        })

        if (isActive) {
            tabButton.addClass('anki-tab-active')
        }

        tabButton.addEventListener('click', () => {
            this.switchTab(config.id)
        })

        // Create tab content
        const tabContent = this.tabsContent.createDiv({
            cls: 'anki-tab-content'
        })

        if (!isActive) {
            tabContent.style.display = 'none'
        } else {
            this.activeTab = config.id
        }

        this.tabs.set(config.id, tabContent)
    }

    switchTab(tabId: string) {
        if (this.activeTab === tabId) return

        // Hide all tabs
        this.tabs.forEach((content, id) => {
            content.style.display = 'none'
        })

        // Remove active class from all buttons
        const buttons = this.tabsHeader.querySelectorAll('.anki-tab-button')
        buttons.forEach(btn => btn.removeClass('anki-tab-active'))

        // Show selected tab
        const selectedTab = this.tabs.get(tabId)
        if (selectedTab) {
            selectedTab.style.display = 'block'
            this.activeTab = tabId

            // Add active class to selected button
            const index = Array.from(this.tabs.keys()).indexOf(tabId)
            buttons[index]?.addClass('anki-tab-active')
        }
    }

    getTabContent(tabId: string): HTMLElement | undefined {
        return this.tabs.get(tabId)
    }

    clear() {
        this.tabs.forEach(content => content.empty())
    }
}
