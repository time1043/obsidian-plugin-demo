import type { Subtitle } from "../types";

function parseAssTime(timeStr: string): number {
	const match = timeStr.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
	if (!match) return 0;
	const [, h, m, s, cs] = match;
	return (
		parseInt(h!) * 3600 +
		parseInt(m!) * 60 +
		parseInt(s!) +
		parseInt(cs!) / 100
	);
}

function stripAssFormatting(text: string): string {
	return text
		.replace(/\{[^}]*\}/g, "")
		.replace(/\\N/g, "\n")
		.replace(/\\n/g, "\n")
		.trim();
}

export function parseAss(content: string): Subtitle[] {
	const lines = content.split(/\r?\n/);
	const subtitles: Subtitle[] = [];
	let inEvents = false;
	let formatFields: string[] = [];
	let id = 0;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed === "[Events]") {
			inEvents = true;
			continue;
		}

		if (trimmed.startsWith("[") && trimmed !== "[Events]") {
			inEvents = false;
			continue;
		}

		if (!inEvents) continue;

		if (trimmed.startsWith("Format:")) {
			formatFields = trimmed
				.substring(7)
				.split(",")
				.map((f) => f.trim().toLowerCase());
			continue;
		}

		if (trimmed.startsWith("Dialogue:")) {
			const dataStr = trimmed.substring(9);
			const parts: string[] = [];
			let current = "";
			let commaCount = 0;

			for (let i = 0; i < dataStr.length; i++) {
				if (dataStr[i] === "," && commaCount < formatFields.length - 1) {
					parts.push(current);
					current = "";
					commaCount++;
				} else {
					current += dataStr[i];
				}
			}
			parts.push(current);

			const getFieldIndex = (name: string) =>
				formatFields.indexOf(name);
			const startIdx = getFieldIndex("start");
			const endIdx = getFieldIndex("end");
			const textIdx = getFieldIndex("text");

			if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;

			const start = parseAssTime(parts[startIdx] ?? "");
			const end = parseAssTime(parts[endIdx] ?? "");
			const text = stripAssFormatting(parts[textIdx] ?? "");

			if (text.length > 0) {
				subtitles.push({ id: id++, start, end, text });
			}
		}
	}

	return subtitles;
}
