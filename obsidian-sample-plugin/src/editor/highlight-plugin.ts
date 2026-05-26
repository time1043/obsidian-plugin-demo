import { StateField, StateEffect } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { App, MarkdownView } from "obsidian";
import { Annotation } from "../types";
import { VIEW_TYPE_ANNOTATIONS, AnnotationsView } from "../ui/annotations-view";

export const setAnnotationsEffect = StateEffect.define<Annotation[]>();

function buildDecorations(annotations: Annotation[]): DecorationSet {
	const decos = annotations
		.filter((a) => a.from >= 0 && a.to >= a.from)
		.map((a) =>
			Decoration.mark({
				class: `annotation-highlight annotation-${a.color}`,
				attributes: { "data-annotation-id": a.id },
			}).range(a.from, a.to),
		);
	return Decoration.set(decos, true);
}

export const annotationDecoField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(decos, tr) {
		for (const e of tr.effects) {
			if (e.is(setAnnotationsEffect)) {
				return buildDecorations(e.value);
			}
		}
		return decos.map(tr.changes);
	},
	provide: (f) => EditorView.decorations.from(f),
});

export function dispatchAnnotations(
	app: App,
	annotations: Annotation[],
) {
	try {
		app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const cm = (
					leaf.view.editor as unknown as Record<string, unknown>
				)["cm"];
				if (cm instanceof EditorView) {
					cm.dispatch({
						effects: setAnnotationsEffect.of(annotations),
					});
				}
			}
		});
	} catch {
		/* workspace not ready */
	}
}

export function refreshSidebar(app: App, filePath: string) {
	const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATIONS);
	const sidebar = leaves[0]?.view;
	if (sidebar instanceof AnnotationsView) {
		sidebar.refresh(filePath);
	}
}
