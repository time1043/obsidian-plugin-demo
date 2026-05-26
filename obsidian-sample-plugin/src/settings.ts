import { App, PluginSettingTab, Setting } from "obsidian";
import type AnnotationPlugin from "./main";
import { ANNOTATION_COLORS, AnnotationColor } from "./types";

export interface AnnotationPluginSettings {
	defaultColor: AnnotationColor;
}

export const DEFAULT_SETTINGS: AnnotationPluginSettings = {
	defaultColor: "yellow",
};

export class AnnotationSettingTab extends PluginSettingTab {
	plugin: AnnotationPlugin;

	constructor(app: App, plugin: AnnotationPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default highlight color")
			.setDesc("Color used when creating new annotations")
			.addDropdown((dropdown) => {
				for (const color of ANNOTATION_COLORS) {
					dropdown.addOption(color, color);
				}
				dropdown
					.setValue(this.plugin.settings.defaultColor)
					.onChange(async (value) => {
						this.plugin.settings.defaultColor =
							value as AnnotationColor;
						await this.plugin.saveSettings();
					});
			});
	}
}
