const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../classifier.js');
const cases = [
  ['Lofi hip hop radio - beats to relax/study to', true, 'music'],
  ['Minecraft OST — Sweden', true, 'music'],
  ['Саундтрек из GTA San Andreas', true, 'music'],
  ['Doom Eternal Official Soundtrack', true, 'music'],
  ['Elden Ring — Main Theme (piano cover)', true, 'music'],
  ['Музыка из аниме', true, 'music'],
  ['Звуки дождя для сна', true, 'music'],
  ['Artist — Track (Official Music Video)', true, 'music'],
  ['Концерт симфонического оркестра', true, 'music'],
  ['Nirvana - Smells Like Teen Spirit (Official Video)', true, 'music'],
  ['Minecraft прохождение #25', false, 'gaming'],
  ['100 дней в Майнкрафте', false, 'gaming'],
  ['Roblox funny moments', false, 'entertainment'],
  ['Как пройти Minecraft: урок 1', false, 'gaming'],
  ['Dota 2 гайд на героя', false, 'gaming'],
  ['КС 2 — лучший матч', false, 'gaming'],
  ['Страшные истории подписчиков', false, 'entertainment'],
  ['Интересные истории из жизни', false, 'entertainment'],
  ['Reddit Stories part 4', false, 'entertainment'],
  ['РЕАКЦИЯ НА НОВЫЙ КЛИП', false, 'entertainment'],
  ['Music reaction — new album', false, 'entertainment'],
  ['День из жизни студента', false, 'entertainment'],
  ['Python с нуля: полный курс', true, 'education'],
  ['Пайтон для начинающих - Изучите Пайтон за 1 час', true, 'education'],
  ['Minecraft gameplay with music', false, 'gaming'],
  ['OST из фильма', true, 'music'],
  ['Unity tutorial: create a game', true, 'education'],
  ['Как создать игру в Godot', true, 'education'],
  ['Разработка игры на Python', true, 'education'],
  ['Физика — закон Ома', true, 'education'],
  ['История Древнего Рима', true, 'education'],
  ['Документальный фильм: история цивилизации', true, 'education'],
  ['How to repair a washing machine', true, 'education'],
  ['Как приготовить борщ: рецепт', true, 'education'],
  ['IELTS English grammar lesson', true, 'education'],
  ['Техника упражнений: тренировка спины', true, 'education'],
  ['Лекция по философии', true, 'education'],
  ['Алгебра, 8 класс', true, 'education'],
  ['Сольфеджио урок 1', true, 'education'],
  ['НЕВЕРОЯТНОЕ СОБЫТИЕ', false, 'unknown'],
  ['This changes everything', false, 'unknown'],
  ['A famous musician talks about breakfast', false, 'unknown'],
  ['Теория музыки — интервалы', true, 'music']
];
for (const [title, expected, category] of cases) test(title, () => {
  const decision = F.classify({ title });
  assert.equal(decision.allow, expected, JSON.stringify(decision));
  assert.equal(decision.category, category);
});
test('unknown passes only in relaxed mode', () => assert.equal(F.classify({title:'Новый выпуск'}, {strict:false}).allow, true));
test('Shorts override channel exceptions', () => assert.equal(F.classify({title:'Python урок',channel:'teacher',isShort:true}, {allowChannels:['teacher']}).category,'shorts'));
test('Shorts can be enabled', () => assert.equal(F.classify({title:'Python урок',isShort:true}, {hideShorts:false}).allow,true));
test('disabled restores all content', () => assert.equal(F.classify({title:'Gaming funny reactions',isShort:true},{enabled:false}).allow,true));
test('channel URLs and handles share one identity', () => assert.equal(F.channelKey('https://www.youtube.com/@Teacher/videos'),F.channelKey('@teacher')));
test('channel IDs and legacy paths work', () => {
  assert.equal(F.channelKey('/channel/UCabcdef/videos'),'/channel/ucabcdef');
  assert.equal(F.channelKey('https://youtube.com/c/Teacher/featured'),'/c/teacher');
});
test('external URLs cannot masquerade as channel links', () => assert.equal(F.channelKey('https://evil.example/@teacher'),''));
test('exact channel matching', () => {
  assert.equal(F.classify({title:'something',channel:'Professor X'},{allowChannels:['Professor']}).allow,false);
  assert.equal(F.classify({title:'something',channel:'Professor X'},{allowChannels:['Professor X']}).allow,true);
});
test('channel deny wins over title allow and music', () => assert.equal(F.classify({title:'piano music',channelUrl:'/@test'},{blockChannels:['@test'],allowWords:['music']}).allow,false));
test('channel allow wins over automatic negative rules', () => assert.equal(F.classify({title:'funny reactions',channel:'X'},{allowChannels:['X']}).allow,true));
test('custom deny wins over custom allow', () => assert.equal(F.classify({title:'Python test'},{allowWords:['Python'],blockWords:['test']}).allow,false));
test('custom phrases match whole words, Unicode and punctuation', () => {
  assert.equal(F.classify({title:'musicology'},{allowWords:['music']}).allow,false);
  assert.equal(F.classify({title:'РАЗБОР: сольфеджио!'},{allowWords:['сольфеджио']}).allow,true);
  assert.equal(F.classify({title:'a+b'},{allowWords:['a+b']}).allow,true);
  assert.equal(F.classify({title:'арбуз'},{blockWords:['арбуз']}).reason,'Скрывающее слово: арбуз');
});
test('Russian е/ё normalize', () => assert.equal(F.normalize('  Ёж\nТЕСТ  '),'еж тест'));
test('channel name does not automatically turn all uploads into lessons', () => assert.equal(F.classify({title:'Обычный выпуск',channel:'Python University'}).allow,false));
test('Topic suffix permits unlabeled songs but never gameplays', () => {
  assert.equal(F.classify({title:'Yesterday',channel:'The Beatles - Topic'}).allow,true);
  assert.equal(F.classify({title:'GTA прохождение',channel:'Artist - Topic'}).allow,false);
});
test('configuration validates types and bounds lists', () => {
  const cfg = F.config({enabled:'false', strict:null,allowWords:['a','a',null,'  b ',7],blockChannels:'bad'});
  assert.equal(cfg.enabled,true); assert.equal(cfg.strict,true);
  assert.deepEqual(cfg.allowWords,['a','b']); assert.deepEqual(cfg.blockChannels,[]);
});
for (const video of require('./regressions.cjs')) for (const strict of [true,false]) {
  test(`reported leak (${strict?'strict':'relaxed'}): ${video.title}`,()=>assert.equal(F.classify(video,{strict}).allow,false));
}
const lessons = [
  'Урок английского: Present Perfect',
  'Казахский язык: урок 1',
  'Испанский для начинающих: произношение',
  'Китайский язык с нуля',
  'Французская грамматика: артикли',
  'Как решить квадратное уравнение',
  'Химические реакции: виды и примеры',
  'Реакция горения: химия',
  'Биология: строение клетки',
  'Фотосинтез и строение растений',
  'География: круговорот воды',
  'Астрономия: Солнечная система',
  'Макроэкономика: лекция о банковском кризисе',
  'Спрос и предложение — основы экономики',
  'Психология: лекция о памяти',
  'Философия: учебный курс',
  'История Древнего Египта',
  'Урок рисования акварелью',
  'Перспектива в рисовании',
  'Как нарисовать портрет карандашом',
  'Урок вокала: постановка голоса',
  'Техника дыхания: мастер-класс',
  'Урок фотографии: настройка экспозиции',
  'Обработка фото в Lightroom',
  'Как сшить платье по выкройке',
  'Вязание крючком для начинающих',
  'Как приготовить плов: пошаговый рецепт',
  'Рецепт хлеба на закваске',
  'Как починить стиральную машину',
  'Замена масла в двигателе',
  'Как вырастить рассаду томатов',
  'Обрезка яблони для начинающих',
  'Йога для начинающих: растяжка',
  'Техника упражнений со штангой',
  'Урок плавания: кроль',
  'Плетение корзин: мастер-класс',
  'Педагогика: теория воспитания',
  'Курс электромонтажа: установка розеток',
  'Как создать игру в Godot: урок 1',
  'Разработка игры на Python',
  'Blender tutorial: model a chair',
  'How to repair a bike',
  'Drawing tutorial: watercolor landscapes',
  'University lecture on sociology',
  'Пианино: урок 1'
];
for (const title of lessons) test(`all subjects: ${title}`,()=>assert.equal(F.classify({title}).allow,true));
for (const title of ['Python — новый выпуск','Экономика Казахстана','Наука: ты не поверишь','Я сделал крутую штуку (Python)','Я прожил 100 дней в Minecraft с уроками Python']) {
  test(`topic alone is insufficient: ${title}`,()=>assert.equal(F.classify({title}).allow,false));
}
for (const title of ['Джем — Geometry Dash','Джем: JK78','Мой микс — Minecraft','Mix - Geometry Dash','Джемы']) {
  test(`preserve jams: ${title}`,()=>assert.equal(F.classify({title,channel:'Nexus [GD]'}, {blockWords:['Geometry Dash'],blockChannels:['Nexus [GD]']}).allow,true));
}
test('Mix identity overrides even explicit blocked channels and words',()=> {
  assert.equal(F.classify({title:'Aperture | Geometry Dash',channel:'Nexus [GD]',isMix:true},{blockChannels:['Nexus [GD]'],blockWords:['Geometry Dash']}).allow,true);
});
test('ordinary playlist is not automatically music',()=>assert.equal(F.classify({title:'Geometry Dash collection'}).allow,false));
test('invisible characters and emoji do not evade game names',()=>assert.equal(F.classify({title:'Geometry\u200b 🟦 DASH'},{strict:false}).allow,false));
test('game soundtrack stays available',()=>assert.equal(F.classify({title:'Geometry Dash OST Full Soundtrack'}).allow,true));
test('a musical performance can use first person',()=>assert.equal(F.classify({title:'Я создал песню на пианино'}).allow,true));
test('game channel hints affect unknown uploads without excluding real lessons',()=>{
  assert.equal(F.classify({title:'Смотрите новый выпуск',channel:'Nexus [GD]'},{strict:false}).allow,false);
  assert.equal(F.classify({title:'Урок математики: дроби',channel:'Nexus [GD]'}).allow,true);
});
test('serial gameplay beats every music keyword unless the card is a Mix',()=>{
  for(const title of ['Lp. Новая песня • Minecraft','Летсплей: музыка из Minecraft','Gameplay with official music','LP #112 ПЕРВАЯ ПЕСНЯ']){
    assert.equal(F.classify({title}).allow,false);
    assert.equal(F.classify({title,isMix:true}).allow,true);
  }
});
test('song narratives and actual songs are different formats',()=>{
  assert.equal(F.classify({title:'История песни Yesterday'}).allow,false);
  assert.equal(F.classify({title:'Песня Yesterday — кавер'}).allow,true);
});
test('LP the artist is not automatically a Lets Play',()=>assert.equal(F.classify({title:'LP - Lost On You (Official Music Video)'}).allow,true));
for(const title of ['Как обслуживать велосипед дома','Как установить заднее колесо на велосипед','Как рисовать акварелью','Как избежать грязи в акварели','Как заменить смеситель','Как паять провода']) {
  test(`practical subject: ${title}`,()=>assert.equal(F.classify({title}).allow,true));
}
test('music credits preserve a song even without the literal word song',()=>assert.equal(F.classify({title:'🎵 Quineros, AE feat. ВОСХОД - ГИМН СИЯНИЯ • Идеальный Мир'}).allow,true));
test('maintenance is a practical subject without explicit word lesson',()=>assert.equal(F.classify({title:'ПОЛНОЕ обслуживание велосипеда для НОВИЧКОВ. Технический осмотр и ремонт в домашних условиях.'}).allow,true));
