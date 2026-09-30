import { TaskState } from '../../../shared/utils/listContext';

export interface RenderedTaskItem {
    taskState: TaskState;
    taskCharacter?: ' ' | 'x' | 'X';
    dataLine?: number;
}

export function appendExtendedListItemContent(
    item: HTMLLIElement,
    data: RenderedTaskItem,
    content: DocumentFragment
): void {
    if (data.taskState === null) {
        item.appendChild(content);
        return;
    }

    const taskCharacter = data.taskCharacter ?? (
        data.taskState === 'checked' ? 'x' : ' '
    );
    const label = document.createElement('label');
    const checkbox = document.createElement('input');

    item.classList.add('task-list-item');
    if (data.taskState === 'checked') {
        item.classList.add('is-checked');
    }
    item.dataset.task = taskCharacter;

    checkbox.className = 'task-list-item-checkbox';
    checkbox.type = 'checkbox';
    checkbox.checked = data.taskState === 'checked';
    checkbox.dataset.task = taskCharacter;

    if (data.dataLine !== undefined) {
        const dataLine = String(data.dataLine);
        item.dataset.line = dataLine;
        checkbox.dataset.line = dataLine;
    }

    label.appendChild(checkbox);
    label.appendChild(content);
    item.appendChild(label);
}
