export class SearchableTable {
    private container: HTMLElement
    private searchInput: HTMLInputElement
    private table: HTMLTableElement
    private tableBody: HTMLTableSectionElement
    private allRows: HTMLTableRowElement[] = []

    constructor(
        container: HTMLElement,
        headers: string[],
        searchPlaceholder: string = "Search..."
    ) {
        this.container = container

        // Create search input
        const searchContainer = container.createDiv({ cls: 'anki-table-search' })
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: searchPlaceholder,
            cls: 'anki-search-input'
        })

        this.searchInput.addEventListener('input', () => this.filterRows())

        // Create table
        this.table = container.createEl('table', { cls: 'anki-settings-table' })
        this.table.style.display = 'table'

        // Create header
        const thead = this.table.createTHead()
        const headerRow = thead.insertRow()
        for (const header of headers) {
            const th = document.createElement('th')
            th.appendChild(document.createTextNode(header))
            headerRow.appendChild(th)
        }

        // Create body
        this.tableBody = this.table.createTBody()
    }

    addRow(): HTMLTableRowElement {
        const row = this.tableBody.insertRow()
        this.allRows.push(row)
        return row
    }

    insertCell(row: HTMLTableRowElement, content?: string): HTMLTableCellElement {
        const cell = row.insertCell()
        if (content) {
            cell.innerHTML = content
        }
        return cell
    }

    private filterRows() {
        const searchTerm = this.searchInput.value.toLowerCase()

        this.allRows.forEach(row => {
            const text = row.textContent?.toLowerCase() || ''
            if (text.includes(searchTerm)) {
                row.style.display = ''
            } else {
                row.style.display = 'none'
            }
        })
    }

    clear() {
        this.tableBody.empty()
        this.allRows = []
        this.searchInput.value = ''
    }

    getTable(): HTMLTableElement {
        return this.table
    }

    getBody(): HTMLTableSectionElement {
        return this.tableBody
    }

    setSearchValue(value: string) {
        this.searchInput.value = value
        this.filterRows()
    }
}
