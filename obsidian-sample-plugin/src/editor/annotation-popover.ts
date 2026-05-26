import { EditorView } from "@codemirror/view";
import { App, MarkdownView, Notice } from "obsidian";
import { Annotation, AnnotationColor, ANNOTATION_COLORS, COLOR_CSS_MAP } from "../types";
import { generateId } from "../utils";
import { loadAnnotations, saveAnnotations } from "../storage";
import { dispatchAnnotations, refreshSidebar } from "./highlight-plugin";
import type AnnotationPlugin from "../main";

let activePopover: HTMLElement | null = null;

function removePopover() {
	if (activePopover) {
		activePopover.remove();
		activePopover = null;
	}
}

async function handleSave(
	app: App,
	plugin: AnnotationPlugin,
	view: EditorView,
	textarea: HTMLTextAreaElement,
	selectedColor: AnnotationColor,
	existingAnnotation?: Annotation,
) {
	const filePath = app.workspace.getActiveFile()?.path;
	if (!filePath) return;

	const note = textarea.value.trim();

	if (existingAnnotation) {
		// Edit mode: update existing
		existingAnnotation.note = note;
		existingAnnotation.color = selectedColor;
		const fileData = await loadAnnotations(app.vault, filePath);
		const idx = fileData.annotations.findIndex(
			(a) => a.id === existingAnnotation.id,
		);
		if (idx >= 0) {
			fileData.annotations[idx] = existingAnnotation;
		}
		await saveAnnotations(app.vault, filePath, fileData);
		dispatchAnnotations(app, fileData.annotations);
		refreshSidebar(app, filePath);
		removePopover();
		new Notice("Annotation updated");
		return;
	}

	// Create mode
	const sel = view.state.selection.main;
	if (sel.empty) return;

	const annotation: Annotation = {
		id: generateId(),
		from: sel.from,
		to: sel.to,
		selectedText: view.state.sliceDoc(sel.from, sel.to),
		note,
		color: selectedColor,
		createdAt: Date.now(),
	};

	const fileData = await loadAnnotations(app.vault, filePath);
	fileData.annotations.push(annotation);
	await saveAnnotations(app.vault, filePath, fileData);

	dispatchAnnotations(app, fileData.annotations);
	refreshSidebar(app, filePath);
	removePopover();
	new Notice("Annotation saved");
}

export function createAnnotationPopoverHandler(
	app: App,
	plugin: AnnotationPlugin,
) {
	return EditorView.domEventHandlers({
		mouseup(_event, view) {
			setTimeout(() => {
				const sel = view.state.selection.main;
				if (sel.empty || activePopover) return;

				const mdView = app.workspace.getActiveViewOfType(MarkdownView);
				if (!mdView || mdView.getMode() !== "source") return;

				showPopover(app, plugin, view);
			}, 10);
		},
	});
}

function showPopover(
	app: App,
	plugin: AnnotationPlugin,
	view: EditorView,
	existingAnnotation?: Annotation,
) {
	removePopover();

	const sel = view.state.selection.main;
	if (sel.empty && !existingAnnotation) return;

	const pos = existingAnnotation ? existingAnnotation.to : sel.to;
	const coords = view.coordsAtPos(pos);
	if (!coords) return;

	const popover = document.createElement("div");
	popover.className = "annotation-popover";
	activePopover = popover;

	// Textarea
	const textarea = popover.createEl("textarea", {
		cls: "annotation-note-input",
		attr: { placeholder: "Add a note..." },
	});
	if (existingAnnotation) {
		textarea.value = existingAnnotation.note;
	}

	// Color palette
	const palette = popover.createEl("div", { cls: "annotation-color-palette" });
	let selectedColor: AnnotationColor = existingAnnotation
		? existingAnnotation.color
		: plugin.settings.defaultColor;

	for (const color of ANNOTATION_COLORS) {
		const btn = palette.createEl("button", {
			cls: `annotation-color-btn${color === selectedColor ? " selected" : ""}`,
			attr: { "data-color": color },
		});
		btn.style.backgroundColor = COLOR_CSS_MAP[color];
		btn.addEventListener("click", () => {
			palette
				.querySelectorAll(".annotation-color-btn")
				.forEach((b) => b.removeClass("selected"));
			btn.addClass("selected");
			selectedColor = color;
		});
	}

	// Actions
	const actions = popover.createEl("div", { cls: "annotation-actions" });
	const saveBtn = actions.createEl("button", {
		cls: "annotation-save-btn",
		text: existingAnnotation ? "Update" : "Save",
	});
	const cancelBtn = actions.createEl("button", {
		cls: "annotation-cancel-btn",
		text: "Cancel",
	});

	saveBtn.addEventListener("click", () =>
		handleSave(app, plugin, view, textarea, selectedColor, existingAnnotation),
	);
	cancelBtn.addEventListener("click", removePopover);

	// Position
	popover.style.top = `${coords.bottom + 8}px`;
	popover.style.left = `${Math.max(8, coords.left)}px`;

	document.body.appendChild(popover);

	// Dismiss on escape
	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			removePopover();
			document.removeEventListener("keydown", onKeyDown);
		}
	};
	document.addEventListener("keydown", onKeyDown);

	// Dismiss on click outside
	const onClickOutside = (e: MouseEvent) => {
		if (activePopover && !activePopover.contains(e.target as Node)) {
			removePopover();
			document.removeEventListener("mousedown", onClickOutside);
		}
	};
	setTimeout(() => document.addEventListener("mousedown", onClickOutside), 0);

	textarea.focus();
}

function findActiveMarkdownView(app: App): MarkdownView | null {
	let result: MarkdownView | null = null;
	app.workspace.iterateAllLeaves((leaf) => {
		if (result) return;
		if (leaf.view instanceof MarkdownView) {
			result = leaf.view;
		}
	});
	return result;
}

export function openEditPopover(
	app: App,
	plugin: AnnotationPlugin,
	annotation: Annotation,
) {
	const mdView = findActiveMarkdownView(app);
	if (!mdView) return;

	// Focus the editor first so coordsAtPos works
	app.workspace.setActiveLeaf(mdView.leaf);

	const cm = (mdView.editor as unknown as Record<string, unknown>)["cm"];
	if (!(cm instanceof EditorView)) return;

	// Scroll to the annotation position so it's in viewport
	cm.dispatch({
		effects: EditorView.scrollIntoView(annotation.from, { y: "center" }),
	});

	showPopover(app, plugin, cm, annotation);
}
