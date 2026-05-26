export interface Subtitle {
	id: number;
	start: number; // seconds
	end: number; // seconds
	text: string;
}

export interface VideoLoopItem {
	videoPath: string; // absolute path to video file
	subtitlePath: string; // vault-relative path to .ass file
}

export interface ABLoopState {
	a: number | null; // seconds
	b: number | null; // seconds
	active: boolean;
}
