import { TFile, Vault } from "obsidian";
import { AnnotationFile } from "./types";

const ANNOTATIONS_EXT = ".annotations.json";

export function getAnnotationsPath(filePath: string): string {
	return filePath + ANNOTATIONS_EXT;
}

export async function loadAnnotations(
	vault: Vault,
	filePath: string,
): Promise<AnnotationFile> {
	const annoPath = getAnnotationsPath(filePath);
	const file = vault.getAbstractFileByPath(annoPath);
	if (file instanceof TFile) {
		const raw = await vault.read(file);
		try {
			const parsed = JSON.parse(raw) as AnnotationFile;
			if (parsed.version === 1 && Array.isArray(parsed.annotations)) {
				return parsed;
			}
		} catch {
			/* fall through to default */
		}
	}
	return { version: 1, annotations: [] };
}

export async function saveAnnotations(
	vault: Vault,
	filePath: string,
	data: AnnotationFile,
): Promise<void> {
	const annoPath = getAnnotationsPath(filePath);
	const json = JSON.stringify(data, null, 2);
	const existing = vault.getAbstractFileByPath(annoPath);
	if (existing instanceof TFile) {
		await vault.modify(existing, json);
	} else {
		await vault.create(annoPath, json);
	}
}
