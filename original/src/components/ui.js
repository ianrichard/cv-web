export class UI {
    constructor() {
        this.statusElement = document.getElementById('statusText');
    }

    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        console.log('Status:', message);
    }

    setupTagFilters(modelManager) {
        const tagGrid = document.getElementById('tagGrid');
        const activeFiltersSpan = document.getElementById('activeFilters');

        if (!tagGrid) return;

        // Clear existing tags
        tagGrid.innerHTML = '';

        // Create checkboxes for each tag
        modelManager.getAllTags().forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `tag-${tag}`;
            checkbox.checked = modelManager.isTagEnabled(tag);

            const label = document.createElement('label');
            label.htmlFor = `tag-${tag}`;
            label.textContent = tag;

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    modelManager.enableTag(tag);
                } else {
                    modelManager.disableTag(tag);
                }
                this.updateActiveFiltersCount(modelManager);
            });

            tagItem.appendChild(checkbox);
            tagItem.appendChild(label);
            tagGrid.appendChild(tagItem);
        });

        this.updateActiveFiltersCount(modelManager);
    }

    updateTagFilters(modelManager) {
        modelManager.getAllTags().forEach(tag => {
            const checkbox = document.getElementById(`tag-${tag}`);
            if (checkbox) {
                checkbox.checked = modelManager.isTagEnabled(tag);
            }
        });
        this.updateActiveFiltersCount(modelManager);
    }

    updateActiveFiltersCount(modelManager) {
        const activeFiltersSpan = document.getElementById('activeFilters');
        if (activeFiltersSpan) {
            const activeCount = modelManager.getActiveFilterCount();
            const totalCount = modelManager.getAllTags().length;

            if (activeCount === totalCount) {
                activeFiltersSpan.textContent = `All (${totalCount})`;
            } else if (activeCount === 0) {
                activeFiltersSpan.textContent = 'None';
            } else {
                activeFiltersSpan.textContent = `${activeCount}/${totalCount}`;
            }
        }
    }
}