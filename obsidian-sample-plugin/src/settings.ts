import { App, PluginSettingTab, Setting } from "obsidian";
import type VideoLoopPlugin from "./main";

export interface VideoLoopSettings {
	autoPlay: boolean;
}

export const DEFAULT_SETTINGS: VideoLoopSettings = {
	autoPlay: false,
};

export class VideoLoopSettingTab extends PluginSettingTab {
	plugin: VideoLoopPlugin;

	constructor(app: App, plugin: VideoLoopPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Auto play")
			.setDesc("Automatically start playing video when loaded")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoPlay)
					.onChange(async (value) => {
						this.plugin.settings.autoPlay = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
