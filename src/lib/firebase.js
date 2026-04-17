import { getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

/** @param {string} key */
function getEnv(key) {
	return import.meta.env[key];
}

const firebaseConfig = {
	apiKey: getEnv('VITE_FIREBASE_API_KEY'),
	authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
	databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL'),
	projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
	storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
	messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
	appId: getEnv('VITE_FIREBASE_APP_ID')
};

const hasRequiredConfig =
	firebaseConfig.apiKey &&
	firebaseConfig.databaseURL &&
	firebaseConfig.projectId &&
	firebaseConfig.appId;

let app = null;
/** @type {import('firebase/database').Database | null} */
let db = null;

if (hasRequiredConfig) {
	app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
	db = getDatabase(app);
} else {
	// 빌드/로컬 개발 환경에서 환경변수가 비어있는 경우를 대비해 조용히 실패합니다.
	// 실제 실행 시에는 학생/교사 화면에서 안내 문구를 보여주게 됩니다.
	console.warn('[firebase] Missing VITE_FIREBASE_* environment variables.');
}

export { db };

