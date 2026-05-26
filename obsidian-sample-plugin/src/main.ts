import { Notice, Plugin, TFile } from "obsidian";
import { parseSubtitle } from "./parsers";
import { SubtitleView, SUBTITLE_VIEW_TYPE } from "./SubtitleView";
import type { Subtitle } from "./types";
import { VideoPlayerView, VIDEO_PLAYER_VIEW_TYPE } from "./VideoPlayerView";
import { DEFAULT_SETTINGS, VideoLoopSettingTab } from "./settings";
import type { VideoLoopSettings } from "./settings";

export default class VideoLoopPlugin extends Plugin {
	settings: VideoLoopSettings = DEFAULT_SETTINGS;
	private videoView: VideoPlayerView | null = null;
	private subtitleView: SubtitleView | null = null;
	private subtitles: Subtitle[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIDEO_PLAYER_VIEW_TYPE,
			(leaf) => new VideoPlayerView(leaf),
		);
		this.registerView(
			SUBTITLE_VIEW_TYPE,
			(leaf) => new SubtitleView(leaf),
		);

		this.addRibbonIcon("play", "Open Video Loop", () => {
			this.openVideoLoopFromActiveFile();
		});

		this.addCommand({
			id: "open-video-loop",
			name: "Open Video Loop from current file",
			callback: () => this.openVideoLoopFromActiveFile(),
		});

		this.addCommand({
			id: "toggle-play",
			name: "Toggle video play/pause",
			callback: () => this.videoView?.togglePlay(),
		});

		this.addCommand({
			id: "set-ab-loop-a",
			name: "Set AB loop point A",
			callback: () => {
				const time = this.videoView?.getCurrentTime() ?? 0;
				this.setABPointA(time);
			},
		});

		this.addCommand({
			id: "set-ab-loop-b",
			name: "Set AB loop point B",
			callback: () => {
				const time = this.videoView?.getCurrentTime() ?? 0;
				this.setABPointB(time);
			},
		});

		this.addCommand({
			id: "clear-ab-loop",
			name: "Clear AB loop",
			callback: () => this.clearABLoop(),
		});

		this.addSettingTab(new VideoLoopSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		this.videoView = null;
		this.subtitleView = null;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<VideoLoopSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async openVideoLoopFromActiveFile(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file");
			return;
		}

		const cache = this.app.metadataCache.getFileCache(activeFile);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter?.video || !frontmatter?.subtitle) {
			new Notice(
				"Active file must have 'video' and 'subtitle' in frontmatter",
			);
			return;
		}

		const videoPath: string = frontmatter.video;
		const subtitlePath: string = frontmatter.subtitle;

		// Read subtitle file
		const subtitleFile = this.app.vault.getAbstractFileByPath(subtitlePath);
		if (!subtitleFile || !(subtitleFile instanceof TFile)) {
			new Notice(`Subtitle file not found: ${subtitlePath}`);
			return;
		}

		const subtitleBuffer = await this.app.vault.readBinary(subtitleFile);
		this.subtitles = parseSubtitle(subtitleBuffer, subtitlePath);

		if (this.subtitles.length === 0) {
			new Notice("No subtitles found in file");
			return;
		}

		// Open both views
		await this.openVideoView();
		await this.openSubtitleView();

		// Wire everything up
		this.videoView?.loadVideo(videoPath);
		this.videoView?.setSubtitles(this.subtitles);
		this.subtitleView?.setSubtitles(this.subtitles);

		this.setupSync();

		new Notice(`Loaded ${this.subtitles.length} subtitles`);
	}

	private async openVideoView(): Promise<void> {
		// Check if view already exists
		const existing = this.app.workspace.getLeavesOfType(
			VIDEO_PLAYER_VIEW_TYPE,
		);
		if (existing.length > 0) {
			this.videoView = existing[0]?.view as VideoPlayerView;
			this.app.workspace.revealLeaf(existing[0]!);
			return;
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIDEO_PLAYER_VIEW_TYPE,
			active: true,
		});
		this.videoView = leaf.view as VideoPlayerView;
		this.app.workspace.revealLeaf(leaf);
	}

	private async openSubtitleView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(
			SUBTITLE_VIEW_TYPE,
		);
		if (existing.length > 0) {
			this.subtitleView = existing[0]?.view as SubtitleView;
			this.app.workspace.revealLeaf(existing[0]!);
			return;
		}

		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: SUBTITLE_VIEW_TYPE,
			active: true,
		});
		this.subtitleView = leaf.view as SubtitleView;
		this.app.workspace.revealLeaf(leaf);
	}

	private setupSync(): void {
		if (!this.videoView || !this.subtitleView) return;

		// Video → Subtitle sync: video time updates highlight current subtitle
		this.videoView.setTimeUpdateCallback((_time: number) => {
			// timeupdate callback is mainly for AB loop in the view
		});

		this.videoView.setSubtitleChangeCallback((id: number) => {
			this.subtitleView?.setCurrentSubtitle(id);
		});

		// Subtitle → Video sync: click subtitle jumps video
		this.subtitleView.setCallbacks({
			onSubtitleClick: (sub: Subtitle) => {
				this.videoView?.jumpToTime(sub.start);
				this.videoView?.play();
			},
			onSetA: (time: number) => {
				this.setABPointA(time);
			},
			onSetB: (time: number) => {
				this.setABPointB(time);
			},
			onClearAB: () => {
				this.clearABLoop();
			},
			onGetCurrentTime: () => {
				return this.videoView?.getCurrentTime() ?? 0;
			},
		});
	}

	private abA: number | null = null;
	private abB: number | null = null;

	private setABPointA(time: number): void {
		this.abA = time;
		// If B is already set and is before A, clear B
		if (this.abB !== null && this.abB <= time) {
			this.abB = null;
		}
		this.videoView?.setABLoop(this.abA, this.abB, false);
		new Notice(`A: ${formatTime(time)}`);
	}

	private setABPointB(time: number): void {
		if (this.abA === null) {
			new Notice("Set A first");
			return;
		}
		if (time <= this.abA) {
			new Notice("B must be after A");
			return;
		}
		this.abB = time;
		this.videoView?.setABLoop(this.abA, this.abB, true);
		new Notice(`Loop: ${formatTime(this.abA)} → ${formatTime(time)}`);
	}

	private clearABLoop(): void {
		this.abA = null;
		this.abB = null;
		this.videoView?.setABLoop(null, null, false);
		new Notice("AB loop cleared");
	}
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
