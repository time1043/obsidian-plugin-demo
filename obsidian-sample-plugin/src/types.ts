export type AnnotationColor =
	| "yellow"
	| "green"
	| "blue"
	| "pink"
	| "orange"
	| "purple";

export interface Annotation {
	id: string;
	from: number;
	to: number;
	selectedText: string;
	note: string;
	color: AnnotationColor;
	createdAt: number;
}

export interface AnnotationFile {
	version: 1;
	annotations: Annotation[];
}

export const ANNOTATION_COLORS: AnnotationColor[] = [
	"yellow",
	"green",
	"blue",
	"pink",
	"orange",
	"purple",
];

export const COLOR_CSS_MAP: Record<AnnotationColor, string> = {
	yellow: "#fef3c7",
	green: "#bbf7d0",
	blue: "#bfdbfe",
	pink: "#fbcfe8",
	orange: "#fed7aa",
	purple: "#ddd6fe",
};
