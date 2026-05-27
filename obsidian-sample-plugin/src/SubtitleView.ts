import { ItemView, WorkspaceLeaf } from "obsidian";
import type { Subtitle, ABLoopState } from "./types";

export const SUBTITLE_VIEW_TYPE = "video-loop-subtitle";

export class SubtitleView extends ItemView {
	private subtitles: Subtitle[] = [];
	private currentSubtitleId: number = -1;
	private abLoop: ABLoopState = { a: null, b: null, active: false };
	private subtitleContainerEl: HTMLElement | null = null;
	private abStatusEl: HTMLElement | null = null;
	private subtitleEls: Map<number, HTMLElement> = new Map();
	private loopedSubtitleIds: Set<number> = new Set();

	// Callbacks
	private onSubtitleClick: ((sub: Subtitle) => void) | null = null;
	private onSetA: ((time: number) => void) | null = null;
	private onSetB: ((time: number) => void) | null = null;
	private onClearAB: (() => void) | null = null;
	private onGetCurrentTime: (() => number) | null = null;
	private onTogglePlay: (() => void) | null = null;
	private onJumpPrev: (() => void) | null = null;
	private onJumpNext: (() => void) | null = null;
	private onSetSpeed: ((speed: number) => void) | null = null;
	private speedDisplayEl: HTMLElement | null = null;
	private currentSpeed = 1;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return SUBTITLE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Subtitles";
	}

	getIcon(): string {
		return "subtitles";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!container) return;
		container.empty();
		container.addClass("video-loop-subtitle-container");
		(container as HTMLElement).setAttribute("tabindex", "-1");

		// AB controls
		const controlsEl = container.createDiv({
			cls: "video-loop-ab-controls",
		});

		const btnA = controlsEl.createEl("button", {
			text: "A",
			cls: "video-loop-ab-btn video-loop-ab-btn-a",
		});
		btnA.addEventListener("click", () => {
			const sub = this.getCurrentSubtitle();
			const time = sub?.start ?? (this.onGetCurrentTime?.() ?? 0);
			this.abLoop.a = time;
			this.onSetA?.(time);
			this.updateABDisplay();
		});

		const btnB = controlsEl.createEl("button", {
			text: "B",
			cls: "video-loop-ab-btn video-loop-ab-btn-b",
		});
		btnB.addEventListener("click", () => {
			const sub = this.getCurrentSubtitle();
			const time = sub?.end ?? (this.onGetCurrentTime?.() ?? 0);
			this.abLoop.b = time;
			this.abLoop.active = true;
			this.onSetB?.(time);
			this.updateABDisplay();
			this.updateLoopHighlight();
		});

		const btnClear = controlsEl.createEl("button", {
			text: "AB",
			cls: "video-loop-ab-btn video-loop-ab-btn-clear",
		});
		btnClear.addEventListener("click", () => {
			if (this.abLoop.active) {
				// Active → clear loop
				this.abLoop = { a: null, b: null, active: false };
				this.onClearAB?.();
			} else {
				// Not active → loop current sentence
				const sub = this.subtitles.find(
					(s) => s.id === this.currentSubtitleId,
				);
				if (sub) {
					this.abLoop = { a: sub.start, b: sub.end, active: true };
					this.onSetA?.(sub.start);
					this.onSetB?.(sub.end);
					this.updateABDisplay();
					this.updateLoopHighlight();
					return;
				}
			}
			this.updateABDisplay();
			this.updateLoopHighlight();
		});

		this.abStatusEl = controlsEl.createDiv({
			cls: "video-loop-ab-status",
			text: "No loop set",
		});

		// Speed controls
		const speedEl = container.createDiv({
			cls: "video-loop-speed-controls",
		});

		const speedPresets = [0.25, 0.5, 1, 1.5, 2];
		for (const speed of speedPresets) {
			const btn = speedEl.createEl("button", {
				text: `${speed}x`,
				cls: "video-loop-speed-btn",
			});
			btn.addEventListener("click", () => {
				this.currentSpeed = speed;
				this.onSetSpeed?.(speed);
				this.updateSpeedDisplay();
			});
		}

		const btnSlower = speedEl.createEl("button", {
			text: "-0.1",
			cls: "video-loop-speed-btn video-loop-speed-adjust",
		});
		btnSlower.addEventListener("click", () => {
			this.currentSpeed = Math.max(0.1, +(this.currentSpeed - 0.1).toFixed(2));
			this.onSetSpeed?.(this.currentSpeed);
			this.updateSpeedDisplay();
		});

		const btnFaster = speedEl.createEl("button", {
			text: "+0.1",
			cls: "video-loop-speed-btn video-loop-speed-adjust",
		});
		btnFaster.addEventListener("click", () => {
			this.currentSpeed = +(this.currentSpeed + 0.1).toFixed(2);
			this.onSetSpeed?.(this.currentSpeed);
			this.updateSpeedDisplay();
		});

		this.speedDisplayEl = speedEl.createSpan({
			cls: "video-loop-speed-display",
			text: "1x",
		});

		// Subtitle list
		this.subtitleContainerEl = container.createDiv({
			cls: "video-loop-subtitle-list",
		});

		// Keyboard: space → toggle play/pause, left/right → prev/next subtitle
		this.keyHandler = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				e.preventDefault();
				this.onTogglePlay?.();
			} else if (e.code === "ArrowLeft") {
				e.preventDefault();
				this.onJumpPrev?.();
			} else if (e.code === "ArrowRight") {
				e.preventDefault();
				this.onJumpNext?.();
			}
		};
		container.addEventListener("keydown", this.keyHandler);
		container.addEventListener("click", () => {
			(container as HTMLElement).focus();
		});
		(container as HTMLElement).focus();
	}

	async onClose(): Promise<void> {
		if (this.keyHandler) {
			const container = this.containerEl.children[1];
			container?.removeEventListener("keydown", this.keyHandler);
			this.keyHandler = null;
		}
		this.subtitleContainerEl = null;
		this.abStatusEl = null;
		this.subtitleEls.clear();
	}

	setSubtitles(subtitles: Subtitle[]): void {
		this.subtitles = subtitles;
		this.renderSubtitles();
	}

	setCurrentSubtitle(id: number): void {
		if (id === this.currentSubtitleId) return;

		// Remove old highlight
		const oldEl = this.subtitleEls.get(this.currentSubtitleId);
		oldEl?.removeClass("video-loop-subtitle-active");

		// Add new highlight
		this.currentSubtitleId = id;
		const newEl = this.subtitleEls.get(id);
		if (newEl) {
			newEl.addClass("video-loop-subtitle-active");
			newEl.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}

	setCallbacks(opts: {
		onSubtitleClick: (sub: Subtitle) => void;
		onSetA: (time: number) => void;
		onSetB: (time: number) => void;
		onClearAB: () => void;
		onGetCurrentTime: () => number;
		onTogglePlay: () => void;
		onJumpPrev: () => void;
		onJumpNext: () => void;
		onSetSpeed: (speed: number) => void;
	}): void {
		this.onSubtitleClick = opts.onSubtitleClick;
		this.onSetA = opts.onSetA;
		this.onSetB = opts.onSetB;
		this.onClearAB = opts.onClearAB;
		this.onGetCurrentTime = opts.onGetCurrentTime;
		this.onTogglePlay = opts.onTogglePlay;
		this.onJumpPrev = opts.onJumpPrev;
		this.onJumpNext = opts.onJumpNext;
		this.onSetSpeed = opts.onSetSpeed;
	}

	private renderSubtitles(): void {
		if (!this.subtitleContainerEl) return;
		this.subtitleContainerEl.empty();
		this.subtitleEls.clear();

		for (const sub of this.subtitles) {
			const el = this.subtitleContainerEl.createDiv({
				cls: "video-loop-subtitle-item",
			});

			const timeEl = el.createSpan({
				cls: "video-loop-subtitle-time",
				text: formatTime(sub.start),
			});

			const textEl = el.createSpan({
				cls: "video-loop-subtitle-text",
				text: sub.text,
			});

			el.addEventListener("click", () => {
				this.onSubtitleClick?.(sub);
			});

			this.subtitleEls.set(sub.id, el);
		}
	}

	private updateSpeedDisplay(): void {
		if (this.speedDisplayEl) {
			this.speedDisplayEl.textContent = `${this.currentSpeed}x`;
		}
	}

	private updateLoopHighlight(): void {
		// Remove old highlights
		for (const id of this.loopedSubtitleIds) {
			this.subtitleEls.get(id)?.removeClass("video-loop-subtitle-looped");
		}
		this.loopedSubtitleIds.clear();

		if (!this.abLoop.active || this.abLoop.a === null || this.abLoop.b === null) return;

		// Highlight all subtitles within A-B range
		for (const sub of this.subtitles) {
			if (sub.end >= this.abLoop.a && sub.start <= this.abLoop.b) {
				this.loopedSubtitleIds.add(sub.id);
				this.subtitleEls.get(sub.id)?.addClass("video-loop-subtitle-looped");
			}
		}
	}

	private getCurrentSubtitle(): Subtitle | null {
		return this.subtitles.find((s) => s.id === this.currentSubtitleId) ?? null;
	}

	private updateABDisplay(): void {
		if (!this.abStatusEl) return;

		if (this.abLoop.active && this.abLoop.a !== null && this.abLoop.b !== null) {
			this.abStatusEl.textContent = `Loop: ${formatTime(this.abLoop.a)} → ${formatTime(this.abLoop.b)}`;
			this.abStatusEl.addClass("video-loop-ab-status-active");
		} else if (this.abLoop.a !== null) {
			this.abStatusEl.textContent = `A: ${formatTime(this.abLoop.a)} — set B`;
			this.abStatusEl.removeClass("video-loop-ab-status-active");
		} else {
			this.abStatusEl.textContent = "No loop set";
			this.abStatusEl.removeClass("video-loop-ab-status-active");
		}
	}
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
