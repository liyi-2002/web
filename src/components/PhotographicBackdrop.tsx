import { useEffect, useRef } from 'react';

export default function PhotographicBackdrop() {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let cancelled = false;
		let dispose: (() => void) | undefined;
		import('../scene/photographic-landscape').then(({ mountPhotographicLandscape }) => {
			if (!cancelled && canvas.current) dispose = mountPhotographicLandscape(canvas.current);
		}).catch(() => { if (canvas.current) canvas.current.dataset.scene = 'fallback'; });
		return () => { cancelled = true; dispose?.(); };
	}, []);
	return <canvas ref={canvas} className="valley-canvas" data-scene="loading" aria-hidden="true" />;
}
