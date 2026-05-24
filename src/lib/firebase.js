import { getApps, initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref } from 'firebase/database';

/** @param {string} key */
function getEnv(key) {
	return import.meta.env[key];
}

const requiredEnvKeys = [
	'VITE_FIREBASE_API_KEY',
	'VITE_FIREBASE_DATABASE_URL',
	'VITE_FIREBASE_PROJECT_ID',
	'VITE_FIREBASE_APP_ID',
	'VITE_FIREBASE_RECAPTCHA_V3_SITE_KEY'
];

const firebaseConfig = {
	apiKey: getEnv('VITE_FIREBASE_API_KEY'),
	authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
	databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL'),
	projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
	storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
	messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
	appId: getEnv('VITE_FIREBASE_APP_ID')
};

const missingEnvKeys = requiredEnvKeys.filter((k) => !getEnv(k));

const hasRequiredConfig =
	firebaseConfig.apiKey &&
	firebaseConfig.databaseURL &&
	firebaseConfig.projectId &&
	firebaseConfig.appId &&
	getEnv('VITE_FIREBASE_RECAPTCHA_V3_SITE_KEY');

/** 모든 활동이 공유하는 Realtime Database 경로 (Firebase Rules와 동일해야 함) */
export const SESSION_EVENTS_ROOT = 'diceSessions';

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;
/** @type {import('firebase/database').Database | null} */
let db = null;
/** @type {import('firebase/auth').Auth | null} */
let auth = null;
/** @type {import('firebase/app-check').AppCheck | null} */
let appCheck = null;
/** @type {Promise<void>} */
let authReady = Promise.resolve();
/** @type {string} */
let authInitErrorMessage = '';

if (hasRequiredConfig) {
	app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

	if (typeof window !== 'undefined') {
		if (getEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN')) {
			/** @type {any} */ (globalThis).FIREBASE_APPCHECK_DEBUG_TOKEN = getEnv(
				'VITE_FIREBASE_APPCHECK_DEBUG_TOKEN'
			);
		}

		try {
			if (app) {
				appCheck = initializeAppCheck(app, {
					provider: new ReCaptchaV3Provider(getEnv('VITE_FIREBASE_RECAPTCHA_V3_SITE_KEY')),
					isTokenAutoRefreshEnabled: true
				});
			}
		} catch (error) {
			console.warn('[firebase] App Check initialization failed:', error);
		}

		try {
			if (app) {
				auth = getAuth(app);
				authReady = auth.currentUser
					? Promise.resolve()
					: signInAnonymously(auth)
							.then(() => undefined)
							.catch((error) => {
								authInitErrorMessage =
									error instanceof Error ? error.message : String(error);
								console.warn('[firebase] Anonymous auth initialization failed:', error);
								throw error;
							});
			}
		} catch (error) {
			authInitErrorMessage = error instanceof Error ? error.message : String(error);
			console.warn('[firebase] Auth initialization failed:', error);
		}
	}

	db = getDatabase(app);
} else {
	console.warn('[firebase] Missing environment variables:', missingEnvKeys);
}

/**
 * @param {import('firebase/database').Database} database
 * @param {string} sessionId
 */
export function sessionEventsRef(database, sessionId) {
	return ref(database, `${SESSION_EVENTS_ROOT}/${sessionId}/events`);
}

/** Firebase RTDB 접근 전 익명 인증이 끝날 때까지 대기합니다. */
export async function ensureFirebaseAuth() {
	await authReady;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function formatFirebaseAuthError(error) {
	if (authInitErrorMessage) return authInitErrorMessage;
	return error instanceof Error ? error.message : String(error);
}

export { db, auth, authReady, authInitErrorMessage, appCheck, hasRequiredConfig, missingEnvKeys };
