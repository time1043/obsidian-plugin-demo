import { Plugin, TFile } from "obsidian";
import { createAnnotationPopoverHandler } from "./editor/annotation-popover";
import {
	annotationDecoField,
	dispatchAnnotations,
} from "./editor/highlight-plugin";
import {
	AnnotationPluginSettings,
	AnnotationSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { getAnnotationsPath, loadAnnotations } from "./storage";
import {
	AnnotationsView,
	createEditorClickHandler,
	VIEW_TYPE_ANNOTATIONS,
} from "./ui/annotations-view";

export default class AnnotationPlugin extends Plugin {
	settings: AnnotationPluginSettings;

	async onload() {
		await this.loadSettings();

		// CM6 StateField for decorations (no ViewPlugin)
		this.registerEditorExtension([
			annotationDecoField,
			createEditorClickHandler(this.app),
			createAnnotationPopoverHandler(this.app, this),
		]);

		// Sidebar view
		this.registerView(
			VIEW_TYPE_ANNOTATIONS,
			(leaf) => new AnnotationsView(leaf, this),
		);

		// Refresh annotations + sidebar on file switch
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file) this.loadAndDispatch(file.path);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				const file = this.app.workspace.getActiveFile();
				if (file) this.loadAndDispatch(file.path);
			}),
		);

		// Handle file rename
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile && file.extension === "md") {
					this.handleRename(oldPath, file.path);
				}
			}),
		);

		// Load for the file already open when plugin starts
		this.app.workspace.onLayoutReady(async () => {
			// Open sidebar
			const existingLeaves =
				this.app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATIONS);
			if (existingLeaves.length === 0) {
				this.app.workspace.getRightLeaf(false)?.setViewState({
					type: VIEW_TYPE_ANNOTATIONS,
					active: false,
				});
			}
			// Load annotations for current file
			const file = this.app.workspace.getActiveFile();
			if (file) await this.loadAndDispatch(file.path);
		});

		// Command
		this.addCommand({
			id: "open-annotations-sidebar",
			name: "Open annotations sidebar",
			callback: () => this.activateSidebarView(),
		});

		this.addSettingTab(new AnnotationSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AnnotationPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async loadAndDispatch(filePath: string) {
		const fileData = await loadAnnotations(this.app.vault, filePath);
		dispatchAnnotations(this.app, fileData.annotations);

		const sidebarLeaves =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATIONS);
		const sidebarView = sidebarLeaves[0]?.view;
		if (sidebarView instanceof AnnotationsView) {
			sidebarView.refresh(filePath);
		}
	}

	private async handleRename(oldPath: string, newPath: string) {
		const oldAnnoPath = getAnnotationsPath(oldPath);
		const newAnnoPath = getAnnotationsPath(newPath);
		const oldFile = this.app.vault.getAbstractFileByPath(oldAnnoPath);
		if (oldFile instanceof TFile) {
			await this.app.vault.rename(oldFile, newAnnoPath);
		}
	}

	private activateSidebarView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATIONS);
		const firstLeaf = leaves[0];
		if (firstLeaf) {
			this.app.workspace.revealLeaf(firstLeaf);
		} else {
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				leaf.setViewState({
					type: VIEW_TYPE_ANNOTATIONS,
					active: true,
				});
				this.app.workspace.revealLeaf(leaf);
			}
		}
	}
}
