import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { Subtitle, ABLoopState } from "./types";

// Node.js fs module (available in Obsidian's Electron)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = window.require("fs") as typeof import("fs");

export const VIDEO_PLAYER_VIEW_TYPE = "video-loop-player";

export class VideoPlayerView extends ItemView {
	private videoEl: HTMLVideoElement | null = null;
	private subtitles: Subtitle[] = [];
	private currentSubtitleId: number = -1;
	private abLoop: ABLoopState = { a: null, b: null, active: false };
	private onTimeUpdate: ((time: number) => void) | null = null;
	private onSubtitleChange: ((id: number) => void) | null = null;
	private blobUrl: string | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIDEO_PLAYER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Video Player";
	}

	getIcon(): string {
		return "play";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!container) return;
		container.empty();
		container.addClass("video-loop-player-container");

		this.videoEl = container.createEl("video", {
			cls: "video-loop-video",
		});
		this.videoEl.controls = true;
		this.videoEl.preload = "auto";

		this.videoEl.addEventListener("timeupdate", () => {
			if (!this.videoEl) return;
			const time = this.videoEl.currentTime;

			this.onTimeUpdate?.(time);

			const sub = this.findSubtitleAt(time);
			if (sub && sub.id !== this.currentSubtitleId) {
				this.currentSubtitleId = sub.id;
				this.onSubtitleChange?.(sub.id);
			}

			if (this.abLoop.active && this.abLoop.b !== null) {
				if (time >= this.abLoop.b) {
					this.videoEl.currentTime = this.abLoop.a ?? 0;
				}
			}
		});
	}

	async onClose(): Promise<void> {
		this.revokeBlobUrl();
		this.videoEl = null;
	}

	loadVideo(path: string): void {
		if (!this.videoEl) return;
		try {
			const buffer: Buffer = fs.readFileSync(path);
			const ext = path.split(".").pop()?.toLowerCase() ?? "mp4";
			const mimeMap: Record<string, string> = {
				mp4: "video/mp4",
				mkv: "video/x-matroska",
				webm: "video/webm",
				avi: "video/x-msvideo",
				mov: "video/quicktime",
			};
			const mime = mimeMap[ext] ?? "video/mp4";
			const blob = new Blob([new Uint8Array(buffer)], { type: mime });
			this.revokeBlobUrl();
			this.blobUrl = URL.createObjectURL(blob);
			this.videoEl.muted = false;
			this.videoEl.volume = 1.0;
			this.videoEl.src = this.blobUrl;
			this.videoEl.addEventListener("loadedmetadata", () => {
				const v = this.videoEl;
				if (!v) return;
				console.log("[VideoLoop] duration:", v.duration);
				console.log("[VideoLoop] muted:", v.muted, "volume:", v.volume);
				console.log("[VideoLoop] paused:", v.paused);
			});
			this.videoEl.onerror = () => {
				const err = this.videoEl?.error;
				new Notice(`Video load error: ${err?.message ?? "unknown"}`);
			};
			this.videoEl.load();
		} catch (e) {
			new Notice(`Cannot read video file: ${path}`);
		}
	}

	private revokeBlobUrl(): void {
		if (this.blobUrl) {
			URL.revokeObjectURL(this.blobUrl);
			this.blobUrl = null;
		}
	}

	setSubtitles(subtitles: Subtitle[]): void {
		this.subtitles = subtitles;
	}

	setTimeUpdateCallback(cb: (time: number) => void): void {
		this.onTimeUpdate = cb;
	}

	setSubtitleChangeCallback(cb: (id: number) => void): void {
		this.onSubtitleChange = cb;
	}

	jumpToTime(time: number): void {
		if (!this.videoEl) return;
		this.videoEl.currentTime = time;
	}

	play(): void {
		this.videoEl?.play();
	}

	pause(): void {
		this.videoEl?.pause();
	}

	togglePlay(): void {
		if (!this.videoEl) return;
		if (this.videoEl.paused) {
			this.videoEl.play();
		} else {
			this.videoEl.pause();
		}
	}

	setABLoop(a: number | null, b: number | null, active: boolean): void {
		this.abLoop = { a, b, active };
	}

	getCurrentTime(): number {
		return this.videoEl?.currentTime ?? 0;
	}

	getVideoElement(): HTMLVideoElement | null {
		return this.videoEl;
	}

	private findSubtitleAt(time: number): Subtitle | null {
		for (const sub of this.subtitles) {
			if (time >= sub.start && time <= sub.end) {
				return sub;
			}
		}
		return null;
	}
}
