# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.1 create --template minimal --types jsdoc --install npm studying_stats
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Netlify 배포 (Firebase Realtime Database)

`/dice` 페이지에서 학생들이 보낸 결과가 교사 화면에 실시간으로 표시되려면 Firebase Realtime Database 설정이 필요합니다.

Netlify의 **환경변수(Build & Deploy)** 에 아래 값을 `VITE_` prefix로 등록하세요.

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

로컬에서 테스트하려면 프로젝트 루트에서 `.env.example`을 복사해 `.env`를 만든 뒤 동일한 이름으로 값을 넣으면 됩니다.

```sh
cp .env.example .env
```

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
