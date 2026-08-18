"use client";

import { useState } from "react";
import { Button, Icon, Modal, ModalBody, ModalFooter, ModalHeader } from "@csa/ui";

export type ManagedColumn<TKey extends string = string> = {
  key: TKey;
  label: string;
  pinned?: boolean;
};

interface ColumnManagerProps<TKey extends string> {
  columns: ManagedColumn<TKey>[];
  defaultVisibleKeys: TKey[];
  title: string;
  visibleKeys: TKey[];
  onChange: (keys: TKey[]) => void;
}

type DragState<TKey extends string> = {
  key: TKey;
  source: "hidden" | "visible";
};

export function ColumnManager<TKey extends string>({
  columns,
  defaultVisibleKeys,
  title,
  visibleKeys,
  onChange,
}: ColumnManagerProps<TKey>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState<TKey> | null>(null);

  const visibleSet = new Set(visibleKeys);
  const visibleColumns = visibleKeys
    .map((key) => columns.find((column) => column.key === key))
    .filter((column): column is ManagedColumn<TKey> => Boolean(column));
  const hiddenColumns = columns.filter((column) => !visibleSet.has(column.key));

  const showColumn = (key: TKey, targetKey?: TKey) => {
    const next = visibleKeys.filter((item) => item !== key);
    const targetIndex = targetKey ? next.indexOf(targetKey) : -1;
    if (targetIndex >= 0) {
      next.splice(targetIndex, 0, key);
    } else {
      next.push(key);
    }
    onChange(next);
  };

  const hideColumn = (key: TKey) => {
    const column = columns.find((item) => item.key === key);
    if (column?.pinned || visibleKeys.length <= 1) return;
    onChange(visibleKeys.filter((item) => item !== key));
  };

  const moveVisibleColumn = (key: TKey, targetKey?: TKey) => {
    const next = visibleKeys.filter((item) => item !== key);
    const targetIndex = targetKey ? next.indexOf(targetKey) : -1;
    if (targetIndex >= 0) {
      next.splice(targetIndex, 0, key);
    } else {
      next.push(key);
    }
    onChange(next);
  };

  const handleDrop = (target: "hidden" | "visible", targetKey?: TKey) => {
    if (!dragState) return;
    if (target === "hidden") {
      hideColumn(dragState.key);
    } else if (dragState.source === "hidden") {
      showColumn(dragState.key, targetKey);
    } else {
      moveVisibleColumn(dragState.key, targetKey);
    }
    setDragState(null);
  };

  const renderColumnPill = (column: ManagedColumn<TKey>, section: "hidden" | "visible") => (
    <li
      key={column.key}
      draggable={!column.pinned}
      onDragStart={() => setDragState({ key: column.key, source: section })}
      onDragEnd={() => setDragState(null)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleDrop(section, column.key);
      }}
      className="flex min-h-10 items-center justify-between gap-3 rounded-m-full border border-m-primary-200 bg-m-primary-50 px-3.5 py-2 text-xs font-semibold text-m-text"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name="grip-vertical" size="sm" className="text-m-text-muted" />
        <span className="truncate">{column.label}</span>
      </span>
      {section === "visible" ? (
        <button
          type="button"
          className="rounded-m-md p-1 text-m-text-muted hover:bg-m-surface hover:text-m-text disabled:opacity-40"
          disabled={column.pinned || visibleKeys.length <= 1}
          onClick={() => hideColumn(column.key)}
          aria-label={`Hide ${column.label}`}
        >
          <Icon name="x" size="sm" />
        </button>
      ) : (
        <button
          type="button"
          className="rounded-m-md p-1 text-m-text-muted hover:bg-m-surface hover:text-m-text"
          onClick={() => showColumn(column.key)}
          aria-label={`Show ${column.label}`}
        >
          <Icon name="plus" size="sm" />
        </button>
      )}
    </li>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        leftIcon={<Icon name="columns-3" size="sm" />}
        onClick={() => setIsOpen(true)}
        aria-label={title}
        title={title}
      />

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="xl">
        <ModalHeader title={title} onClose={() => setIsOpen(false)} />
        <ModalBody>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-m-text">
                <Icon name="eye-off" size="sm" />
                Hidden columns
              </h4>
              <ul
                className="min-h-80 space-y-2 rounded-m-lg border border-m-border bg-m-surface p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop("hidden");
                }}
              >
                {hiddenColumns.map((column) => renderColumnPill(column, "hidden"))}
              </ul>
            </section>

            <section className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-m-text">
                <Icon name="eye" size="sm" />
                Visible columns
              </h4>
              <ul
                className="min-h-80 space-y-2 rounded-m-lg border border-m-border bg-m-surface p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop("visible");
                }}
              >
                {visibleColumns.map((column) => renderColumnPill(column, "visible"))}
              </ul>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" size="sm" onClick={() => onChange(defaultVisibleKeys)}>
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
