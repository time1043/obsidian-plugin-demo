import { EditorView } from "@codemirror/view";
import { App, ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";
import { Annotation } from "../types";
import { loadAnnotations, saveAnnotations } from "../storage";
import { dispatchAnnotations } from "../editor/highlight-plugin";
import { openEditPopover } from "../editor/annotation-popover";
import type AnnotationPlugin from "../main";

export const VIEW_TYPE_ANNOTATIONS = "annotation-sidebar-view";

export class AnnotationsView extends ItemView {
	private plugin: AnnotationPlugin;
	private currentFilePath: string | null = null;
	private annotations: Annotation[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: AnnotationPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ANNOTATIONS;
	}

	getDisplayText(): string {
		return "Annotations";
	}

	getIcon(): string {
		return "highlighter";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	async refresh(filePath?: string): Promise<void> {
		if (filePath !== undefined) {
			this.currentFilePath = filePath;
		}
		if (this.currentFilePath) {
			this.annotations = (
				await loadAnnotations(this.plugin.app.vault, this.currentFilePath)
			).annotations;
		} else {
			this.annotations = [];
		}
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("annotations-view");

		if (this.annotations.length === 0) {
			contentEl.createEl("p", {
				text: "No annotations yet. Select text in the editor to create one.",
				cls: "annotations-empty",
			});
			return;
		}

		const list = contentEl.createEl("div", { cls: "annotations-list" });
		for (const anno of this.annotations) {
			this.renderAnnotationCard(list, anno);
		}
	}

	private renderAnnotationCard(container: HTMLElement, anno: Annotation): void {
		const card = container.createEl("div", {
			cls: `annotation-card annotation-card-${anno.color}`,
			attr: { "data-annotation-id": anno.id },
		});

		card.createEl("div", {
			cls: "annotation-card-text",
			text:
				anno.selectedText.length > 100
					? anno.selectedText.slice(0, 100) + "..."
					: anno.selectedText,
		});

		if (anno.note) {
			card.createEl("div", {
				cls: "annotation-card-note",
				text: anno.note,
			});
		}

		card.createEl("div", {
			cls: "annotation-card-time",
			text: new Date(anno.createdAt).toLocaleString(),
		});

		const editBtn = card.createEl("button", {
			cls: "annotation-card-edit",
			text: "✎",
		});
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			openEditPopover(this.plugin.app, this.plugin, anno);
		});

		const deleteBtn = card.createEl("button", {
			cls: "annotation-card-delete",
			text: "×",
		});
		deleteBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.deleteAnnotation(anno.id);
		});

		card.addEventListener("click", () => {
			this.scrollToAnnotation(anno);
		});
	}

	private async deleteAnnotation(id: string): Promise<void> {
		this.annotations = this.annotations.filter((a) => a.id !== id);
		if (this.currentFilePath) {
			await saveAnnotations(this.plugin.app.vault, this.currentFilePath, {
				version: 1,
				annotations: this.annotations,
			});
		}
		dispatchAnnotations(this.plugin.app, this.annotations);
		this.render();
	}

	private scrollToAnnotation(anno: Annotation): void {
		const found = this.findMarkdownView();
		if (!found) return;

		const editor = found.editor;
		const from = editor.offsetToPos(anno.from);
		const to = editor.offsetToPos(anno.to);
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to }, true);
		this.plugin.app.workspace.setActiveLeaf(found.leaf);
	}

	private findMarkdownView(): MarkdownView | null {
		let result: MarkdownView | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (result) return;
			if (
				leaf.view instanceof MarkdownView &&
				leaf.view.file?.path === this.currentFilePath
			) {
				result = leaf.view;
			}
		});
		return result;
	}

	highlightCard(id: string): void {
		const cards = this.contentEl.querySelectorAll(".annotation-card");
		cards.forEach((card) => {
			card.removeClass("annotation-card-active");
			if (card.getAttribute("data-annotation-id") === id) {
				card.addClass("annotation-card-active");
				card.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		});
	}
}

export function createEditorClickHandler(app: App) {
	return EditorView.domEventHandlers({
		click(event, _view) {
			const target = event.target as HTMLElement;
			const markEl = target.closest("[data-annotation-id]");
			if (!markEl) return false;
			const annoId = markEl.getAttribute("data-annotation-id");
			if (!annoId) return false;

			const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATIONS);
			const sidebarLeaf = leaves[0];
			const sidebarView = sidebarLeaf?.view;
			if (sidebarLeaf && sidebarView instanceof AnnotationsView) {
				app.workspace.revealLeaf(sidebarLeaf);
				sidebarView.highlightCard(annoId);
			}
			return true;
		},
	});
}
