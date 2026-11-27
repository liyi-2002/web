const radians = Math.PI / 180;
const wrap = (degrees: number) => ((degrees % 360) + 360) % 360;
const sin = (degrees: number) => Math.sin(degrees * radians);
const cos = (degrees: number) => Math.cos(degrees * radians);

function orbit(mean: number, eccentricity: number) {
	const anomaly = wrap(mean) * radians;
	let eccentric = anomaly;
	for (let n = 0; n < 8; n++) {
		eccentric -= (eccentric - eccentricity * Math.sin(eccentric) - anomaly) / (1 - eccentricity * Math.cos(eccentric));
	}
	const x = Math.cos(eccentric) - eccentricity;
	const y = Math.sqrt(1 - eccentricity ** 2) * Math.sin(eccentric);
	return { angle: Math.atan2(y, x) / radians, distance: Math.hypot(x, y) };
}

/**
 * Geocentric, low-precision phase, independently implemented from orbital formulae:
 * https://www.stjarnhimlen.se/comp/ppcomp.html (sections 3–9).
 * Includes lunar longitude/latitude/distance perturbations; not an observatory ephemeris.
 * Phase is north-up (waxing light on the right); the observer's horizon tilt is omitted.
 */
export function moonPhase(date: Date) {
	const days = (date.getTime() - Date.UTC(1999, 11, 31)) / 86400000;
	if (!Number.isFinite(days)) throw new RangeError('A valid date is required.');
	const sunPerihelion = 282.9404 + 0.0000470935 * days;
	const sunMean = wrap(356.047 + 0.9856002585 * days);
	const sun = orbit(sunMean, 0.016709 - 0.000000001151 * days);
	const sunLongitude = sun.angle + sunPerihelion;
	const node = wrap(125.1228 - 0.0529538083 * days);
	const perihelion = wrap(318.0634 + 0.1643573223 * days);
	const mean = wrap(115.3654 + 13.0649929509 * days);
	const lunar = orbit(mean, 0.0549);
	const argument = lunar.angle + perihelion;
	const x = cos(node) * cos(argument) - sin(node) * sin(argument) * cos(5.1454);
	const y = sin(node) * cos(argument) + cos(node) * sin(argument) * cos(5.1454);
	const z = sin(argument) * sin(5.1454);
	const elongation = mean + perihelion + node - (sunMean + sunPerihelion);
	const latitudeArgument = mean + perihelion;
	const longitudeCorrection =
		-1.274 * sin(mean - 2 * elongation) + .658 * sin(2 * elongation) - .186 * sin(sunMean)
		- .059 * sin(2 * mean - 2 * elongation) - .057 * sin(mean - 2 * elongation + sunMean)
		+ .053 * sin(mean + 2 * elongation) + .046 * sin(2 * elongation - sunMean)
		+ .041 * sin(mean - sunMean) - .035 * sin(elongation) - .031 * sin(mean + sunMean)
		- .015 * sin(2 * latitudeArgument - 2 * elongation) + .011 * sin(mean - 4 * elongation);
	const latitudeCorrection =
		-.173 * sin(latitudeArgument - 2 * elongation) - .055 * sin(mean - latitudeArgument - 2 * elongation)
		- .046 * sin(mean + latitudeArgument - 2 * elongation) + .033 * sin(latitudeArgument + 2 * elongation)
		+ .017 * sin(2 * mean + latitudeArgument);
	const longitude = Math.atan2(y, x) / radians + longitudeCorrection;
	const latitude = Math.atan2(z, Math.hypot(x, y)) / radians + latitudeCorrection;
	const separation = Math.acos(Math.max(-1, Math.min(1, cos(latitude) * cos(longitude - sunLongitude))));
	const moonDistance = (60.2666 * lunar.distance - .58 * cos(mean - 2 * elongation) - .46 * cos(2 * elongation)) * 6378.14;
	const sunDistance = sun.distance * 149597870.7;
	const incidence = Math.atan2(sunDistance * Math.sin(separation), moonDistance - sunDistance * Math.cos(separation));
	const illumination = Math.max(0, Math.min(1, (1 + Math.cos(incidence)) / 2));
	const phase = wrap(longitude - sunLongitude) / 360;
	const names = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
	return { phase, illumination, name: names[Math.floor((phase + 1 / 16) * 8) % 8], waxing: phase < .5 };
}

const lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

/** Chinese civil calendar uses China Standard Time, including leap-month naming. */
export function lunarDate(date: Date) {
	try {
		const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' });
		if (formatter.resolvedOptions().calendar !== 'chinese') return null;
		const parts = formatter.formatToParts(date);
		const month = parts.find(part => part.type === 'month')?.value;
		const day = Number(parts.find(part => part.type === 'day')?.value);
		return month && day >= 1 && day <= 30 ? { month, day: lunarDays[day - 1] } : null;
	} catch { return null; }
}
