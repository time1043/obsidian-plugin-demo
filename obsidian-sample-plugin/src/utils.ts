export function generateId(): string {
	return Math.random().toString(36).substring(2, 10);
}

export function debounce<T extends (...args: never[]) => unknown>(
	fn: T,
	ms: number,
): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout>;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
}
