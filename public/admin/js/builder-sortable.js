// Shared drag-and-drop sortable logic for the menu builder and set menus builder.
// Call initBuilderSortables() inside each builder's initSortables() and return the array
// so the caller can destroy instances before re-initialising on a new selection.

// initBuilderSortables returns an array of Sortable instances.
// options:
//   sectionContainer  — Element containing .smb-course section rows (may be null)
//   sectionDataAttr   — camelCase dataset key that holds the section's ID  e.g. 'subId' or 'smcId'
//   itemGroupName     — Sortable group name for item lists (scope to prevent cross-builder dragging)
//   scrollEl          — The scrollable panel element to auto-scroll during drag
//   onSectionReorder  — fn([{ id, display_order }]) called after a section is dragged
//   onItemEnd         — fn(SortableEvent) called after an item drag ends
function initBuilderSortables({ sectionContainer, sectionDataAttr, itemGroupName, scrollEl, onSectionReorder, onItemEnd }) {
  const scrollCfg = { scroll: scrollEl || true, scrollSensitivity: 80, scrollSpeed: 12 };
  const sortables = [];

  if (sectionContainer && sectionContainer.querySelectorAll(':scope > .smb-course').length > 0) {
    sortables.push(Sortable.create(sectionContainer, {
      ...scrollCfg,
      draggable:  '.smb-course',
      handle:     '.bl-handle--sm',
      animation:  180,
      ghostClass: 'bl-ghost',
      dragClass:  'bl-dragging',
      onMove: evt => evt.to === sectionContainer,
      onEnd() {
        const items = [...sectionContainer.querySelectorAll(':scope > .smb-course')].map((el, i) => ({
          id:            parseInt(el.dataset[sectionDataAttr]),
          display_order: i,
        }));
        if (items.length) onSectionReorder(items);
      },
    }));
  }

  document.querySelectorAll('.smb-dish-list').forEach(listEl => {
    sortables.push(Sortable.create(listEl, {
      ...scrollCfg,
      group:      { name: itemGroupName, pull: true, put: true },
      handle:     '.bl-handle--dish',
      animation:  180,
      ghostClass: 'bl-ghost',
      dragClass:  'bl-dragging',
      onEnd:      onItemEnd,
    }));
  });

  return sortables;
}
