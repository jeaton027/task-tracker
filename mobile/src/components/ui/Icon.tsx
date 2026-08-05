import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Stroke-style icons (Lucide-shape style, simplified inline).
 *
 * Adding a new icon: add a case to renderIcon() and the name to IconName.
 * The Svg parent passes stroke/fill down so children just need geometry.
 */
export type IconName =
	| 'menu' | 'chevron' | 'left' | 'right' | 'plus' | 'check'
	| 'refresh' | 'flame' | 'timer'
	| 'home' | 'stats' | 'calendar' | 'settings'
	| 'edit' | 'reorder' | 'trash'
	| 'close' | 'list' | 'archive' | 'pause'
	| 'play' | 'skip' | 'restart' | 'grid' | 'link'
	| 'eye' | 'eye-off';

interface IconProps {
	name: IconName;
	size?: number;
	color?: string;
	strokeWidth?: number;
	fill?: string;
}

export function Icon({
	name,
	size = 22,
	color = 'black',
	strokeWidth = 2,
	fill = 'none',
}: IconProps) {
	return (
		<Svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill={fill}
			stroke={color}
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{renderIcon(name)}
		</Svg>
	);
}

function renderIcon(name: IconName) {
	switch (name) {
		case 'menu':    return <Path d="M4 6h16M4 12h16M4 18h16" />;
		case 'chevron': return <Path d="m6 9 6 6 6-6" />;
		case 'left':    return <Path d="m15 18-6-6 6-6" />;
		case 'right':   return <Path d="m9 18 6-6-6-6" />;
		case 'plus':    return <Path d="M5 12h14M12 5v14" />;
		case 'check':   return <Path d="M20 6 9 17l-5-5" />;
		case 'flame':
			return <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />;
		case 'refresh':
			return (<>
				<Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
				<Path d="M21 3v5h-5" />
			</>);
		case 'timer':
			return (<>
				<Path d="M10 2h4" />
				<Path d="M12 14l2.5-2.5" />
				<Circle cx="12" cy="14" r="8" />
			</>);
		case 'home':
			return (<>
				<Path d="M3 10.5 12 3l9 7.5" />
				<Path d="M5 9.5V21h14V9.5" />
			</>);
		case 'stats':
			return (<>
				<Path d="M3 3v18h18" />
				<Rect x="7" y="11" width="3" height="6" rx="1" />
				<Rect x="13" y="7" width="3" height="10" rx="1" />
			</>);
		case 'calendar':
			return (<>
				<Rect x="3" y="4" width="18" height="18" rx="2" />
				<Path d="M16 2v4M8 2v4M3 10h18" />
			</>);
		case 'settings':
			return (<>
				<Circle cx="12" cy="12" r="3" />
				<Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</>);
		case 'edit':
			return <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />;
		case 'reorder':
			return <Path d="M3 8h18M3 12h18M3 16h18M8 4l-4 4 4 4M16 4l4 4-4 4" />;
		case 'trash':
			return (<>
				<Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				<Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
			</>);
		case 'close':
			return <Path d="M18 6 6 18M6 6l12 12" />;
		case 'list':
			return (<>
				<Path d="M8 6h13M8 12h13M8 18h13" />
				<Circle cx="4" cy="6" r="1" fill="currentColor" />
				<Circle cx="4" cy="12" r="1" fill="currentColor" />
				<Circle cx="4" cy="18" r="1" fill="currentColor" />
			</>);
		case 'archive':
			return (<>
				<Path d="M21 8v13H3V8" />
				<Path d="M1 3h22v5H1z" />
				<Path d="M10 12h4" />
			</>);
		case 'pause':
			return (<>
				<Circle cx="12" cy="12" r="10" />
				<Path d="M10 15V9M14 15V9" />
			</>);
		case 'play':
			return <Path d="M5 3l14 9-14 9V3z" />;
		case 'skip':
			return (<>
				<Path d="M5 4l10 8-10 8V4z" />
				<Path d="M19 5v14" />
			</>);
		case 'restart':
			return (<>
				<Path d="M1 4v6h6" />
				<Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
			</>);
		case 'grid':
			return (<>
				<Rect x="3" y="3" width="7" height="7" rx="1" />
				<Rect x="14" y="3" width="7" height="7" rx="1" />
				<Rect x="3" y="14" width="7" height="7" rx="1" />
				<Rect x="14" y="14" width="7" height="7" rx="1" />
			</>);
		case 'link':
			return (<>
				<Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
				<Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			</>);
		case 'eye':
			return (<>
				<Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<Circle cx="12" cy="12" r="3" />
			</>);
		case 'eye-off':
			return (<>
				<Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
				<Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
				<Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
				<Path d="M1 1l22 22" />
			</>);
	}
}
