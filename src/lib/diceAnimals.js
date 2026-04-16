export const diceAnimalNames = [
	'고양이',
	'강아지',
	'사자',
	'호랑이',
	'곰',
	'여우',
	'늑대',
	'토끼',
	'다람쥐',
	'고슴도치',
	'원숭이',
	'코끼리',
	'기린',
	'얼룩말',
	'하마',
	'악어',
	'뱀',
	'거북이',
	'개구리',
	'두꺼비',
	'고래',
	'돌고래',
	'상어',
	'오징어',
	'독수리',
	'매',
	'펭귄',
	'부엉이',
	'공작새',
	'낙타'
];

export function getRandomDiceAnimalName() {
	const index = Math.floor(Math.random() * diceAnimalNames.length);
	return diceAnimalNames[index] ?? '동물';
}

