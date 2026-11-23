/* Shared pure rules keep the popup, content script and executable tests consistent. */
(() => {
  "use strict";
  const defaults = Object.freeze({
    enabled: true, strict: true, hideShorts: true, guardWatch: true,
    allowChannels: [], blockChannels: [], allowWords: [], blockWords: []
  });
  const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  // Emoji and punctuation can split a name (“Geometry 🟦 Dash”); keep a second form for topic rules.
  const semantic = value => normalize(value).replace(/[^\p{L}\p{N}+#]+/gu, " ").replace(/\s+/g, " ").trim();
  const word = expression => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${expression})(?=$|[^\\p{L}\\p{N}])`, "iu");
  const rule = (label, expression) => ({ label, pattern: word(expression) });
  const music = [
    rule("Музыка", "music|музык\\p{L}*|песн\\p{L}*|song|songs|трек|треки|альбом|album|playlist|плейлист|саундтрек\\p{L}*|soundtrack|ost|bgm"),
    rule("Музыкальное исполнение", "official (?:audio|video|music video|lyric video)|lyric(?:s| video)?|клип|концерт\\p{L}*|concert|symphony|симфони\\p{L}*|оркестр\\p{L}*|orchestra|piano|пианино|фортепиано|violin|скрипк\\p{L}*|guitar|гитар\\p{L}*|аккорд\\p{L}*|караоке|karaoke|cover|кавер|ремикс|remix|dj set|lo[ -]?fi|jazz|джаз|chillout|ambient|instrumental|инструментал\\p{L}*|beats|techno|phonk|фонк|synthwave|электронная музыка"),
    rule("Музыка для фона", "звуки (?:дождя|природы|леса|моря)|white noise|белый шум|rain sounds|nature sounds|sleep sounds|meditation music")
  ];
  const entertainment = [
    rule("Реакции и развлекательные подборки", "реакци\\p{L}*|reaction|reacts|prank\\p{L}*|пранк\\p{L}*|челлендж\\p{L}*|challenge|мем\\p{L}*|memes?|прикол\\p{L}*|смешн\\p{L}*|funny|fails?|try not to laugh|юмор|comedy|stand[ -]?up|стендап|roast|вайны"),
    rule("Влоги, шоу и развлечения", "влог\\p{L}*|vlog\\p{L}*|моя жизнь|день из жизни|мои будни|румтур|room tour|шоу|подкаст\\p{L}*|podcast|интервью|interview|драма|drama|сплетн\\p{L}*|gossip|unboxing|распаковк\\p{L}*|трейлер\\p{L}*|trailer"),
    rule("Развлекательные истории", "(?:страшн\\p{L}*|жутк\\p{L}*|смешн\\p{L}*|интересн\\p{L}*|невероятн\\p{L}*) истори\\p{L}*|истори\\p{L}* (?:из жизни|подписчик\\p{L}*|с реддит|с reddit|о том как|как я)|storytime|story time|creepypasta|крипипаст\\p{L}*|reddit stories|true crime|тру крайм|интересные факты|ты не поверишь|я прожил|я выжил"),
    rule("Фильмы, сериалы и аниме", "movie|фильм\\p{L}*|сериал\\p{L}*|мульт\\p{L}*|аниме|anime")
  ];
  const gaming = rule("Игры и прохождения", "игр(?:а|ы|е|у|ой|ами|ах)|игров\\p{L}*|гейм\\p{L}*|game|games|gaming|gameplay|walkthrough|playthrough|lets? play|летспле\\p{L}*|прохождени\\p{L}*|спидран\\p{L}*|speedrun|minecraft|майнкрафт\\p{L}*|roblox|роблокс|fortnite|фортнайт|dota|дота|counter[ -]strike|cs ?2|cs ?go|кс ?2|gta|гта|genshin|геншин|valorant|валорант|pubg|brawl stars|бравл старс|standoff|сталкер|s\\.?t\\.?a\\.?l\\.?k\\.?e\\.?r|elden ring|dark souls|warcraft|war thunder|world of tanks|танки|cyberpunk|киберпанк|terraria|террария|overwatch|apex legends|league of legends|видеоигр\\p{L}*|video games");
  const technology = rule("Обучение разработке", "программирован\\p{L}*|programming|coding|python|пайтон|питон|javascript|джаваскрипт|typescript|java|c\\+\\+|c#|html|css|sql|unity|unreal|godot|blender|gamedev|game dev|разработк\\p{L}* игр\\p{L}*|созда(?:ть|ние|ем) игр\\p{L}*|как (?:сделать|создать) игр\\p{L}*");
  const lesson = rule("Урок или учебный курс", "урок\\p{L}*|лекци\\p{L}*|lecture\\p{L}*|tutorial\\p{L}*|туториал\\p{L}*|обучени\\p{L}*|учебн\\p{L}*|научиться|изуч(?:аем|ать|ите|ение)|для начинающих|учим|course|курс|курсы|инструкци\\p{L}*|пошагов\\p{L}*|практикум|мастер[ -]класс|how to|learn|learning|explained|объясня\\p{L}*|разбор задач\\p{L}*|решени\\p{L}* задач\\p{L}*|егэ|огэ|ielts|toefl");
  const gameNames = rule("Игры и прохождения", "geometry\\s*dash|геометр(?:и|ия)\\s*д[эа]ш|геометри\\s*дэщ|gd|геометри|insane demon|extreme demon|инсейн демон\\p{L}*|экстрим демон\\p{L}*|hard demon|demonlist|демонлист|демонов|osu|osu!|hollow knight|silksong|hytale|hades|balatro|deadlock|satisfactory|factorio|rimworld|rim world|rimworld|baldur.?s gate|baldurs gate|wuthering waves|honkai|zenless zone zero|clash royale|clash of clans|wot|tanks blitz|мир танков|мир кораблей|league of legends|lol|lol wild rift|rocket league|rainbow six|battlefield|call of duty|world of warships|fnaf|five nights at freddy.?s|among us|undertale|deltarune|geometrydash");
  const gameActivity = rule("Игровой ролик", "(?:прошел|пройти|проходим|проходит|прохожу|прошла|прошли|проходил) (?:все |всех |новые |новый |топ \\d+ )?(?:уровн\\p{L}*|демон\\p{L}*|босс\\p{L}*)|поиграл\\p{L}*|играю|поиграем|я игра\\p{L}*|катка|катки|рейтинговый матч|стрим|стримы|stream highlights|fragmovie|let s play|gameplay|walkthrough|playthrough|прохождени\\p{L}*|летспле\\p{L}*|speedrun|спидран\\p{L}*");
  const gamingChannel = rule("Игровая тематика канала", "gd|gaming|gameplay|furia cs|furia counter strike|dolasgd");
  const tasting = rule("Дегустации и развлекательные пробы", "пробует|пробую|пробуем|дегустаци\\p{L}*|мукбанг|mukbang|food challenge|taste test|tasting|tries .{0,40}food");
  const commentary = rule("Новости, мнения и обсуждения", "новост\\p{L}*|news|политическ\\p{L}*|что то не сходится|что происходит с|что случилось с|что не так с|мое мнение|моё мнение|обсуждаем|скандал\\p{L}*|breaking news");
  const firstPerson = rule("Личный эксперимент или развлекательная история", "(?:я|мы) (?:перенес\\p{L}*|поиграл\\p{L}*|сделал\\p{L}*|создал\\p{L}*|превратил\\p{L}*|попробовал\\p{L}*|выжил\\p{L}*|прожил\\p{L}*|построил\\p{L}*|купил\\p{L}*|потратил\\p{L}*|заработал\\p{L}*|удивил\\p{L}*|изменил\\p{L}*|взломал\\p{L}*)|как я |как мы ");
  const instructional = rule("Практическое обучение", "как (?:установить|обслуживать|рисовать|избежать|проверить|отрегулировать|заменить|подключить|отключить|разобрать|снять|постирать|чистить|покрасить|паять|сварить|заварить|размножить|пересадить|подобрать|подготовить|создать|сделать|настроить|починить|приготовить|научиться|выучить|решить|нарисовать|сшить|связать|собрать|отремонтировать|играть на|написать|построить|пользоваться|вырастить|посадить|рассчитать|спроектировать|тренировать|выполнить|улучшить|фотографировать|снимать|монтировать)|how to|how (?:does|do|is|are)|как устроен\\p{L}*|как работает|почему (?:небо|земля|солнце)|ремонт своими руками|своими руками|diy|рецепт\\p{L}*|recipes?|workout|тренировк\\p{L}*|техник\\p{L}* упражнени\\p{L}*|разминка|растяжка|йога|yoga|stretching");
  const knowledge = rule("Учебная тема", "закон (?:ома|ньютона|кулона|сохранения)|теорем\\p{L}*|интеграл\\p{L}*|производн\\p{L}*|дроб\\p{L}*|уравнени\\p{L}*|алгебр\\p{L}*|геометрия|calculus|algebra|geometry|english grammar|english vocabulary|грамматик\\p{L}*|времен\\p{L}* английск\\p{L}*|история (?:древн\\p{L}*|средневеков\\p{L}*|рим\\p{L}*|егип\\p{L}*|росси\\p{L}*|казахстан\\p{L}*|цивилизаци\\p{L}*|второй мировой)|world history|научпоп|научно популярн\\p{L}*|документальн\\p{L}*|documentary|разработк\\p{L}* игр\\p{L}*|разработк\\p{L}* игры");
  const concepts = rule("Объяснение или практика", "строение (?:клетк\\p{L}*|растени\\p{L}*|сердц\\p{L}*|организм\\p{L}*)|фотосинтез|химическ\\p{L}* реакци\\p{L}*|реакци\\p{L}* горени\\p{L}*|круговорот воды|строение атома|гравитаци\\p{L}*|теория относительности|таблица умножения|экономик\\p{L}* с нуля|основы \\p{L}+|\\d+ класс|с нуля|перспектива в рисовании|цветовой круг|постановка голоса|дыхательн\\p{L}* упражнени\\p{L}*|обработка фото|цветокоррекци\\p{L}*|свет в фотографии|выкройк\\p{L}*|вязание|шитье|черенкование|обрезка (?:яблони|груши|деревьев)|уход за (?:растениями|рассадой)|замена (?:масла|фильтра|подшипника)|заточка ножей|основные (?:понятия|принципы)|разбор (?:техники|ошибок|произведения)|солнечная система|падежи|склонение|спряжение|supply and demand|спрос и предложение|педагогик\\p{L}*");
  const mixTitle = /^(?:(?:мой|мои|my|your|ваш)\s+)?(?:джем(?:ы)?|микс|mix)(?:\s|$|[:—–-])/iu;
  const serialGameplay = rule("Летсплей или игровой эпизод", "lets? play|let s play|летспле\\p{L}*|прохождени\\p{L}*|gameplay|walkthrough|playthrough|speedrun|спидран\\p{L}*");
  const musicStory = rule("Рассказ о музыке вместо музыкального исполнения", "история (?:песни|группы|музыканта|создания песни)|почему .{0,40}(?:песня|песню|музыкант)|что случилось с .{0,40}(?:песн\\p{L}*|групп\\p{L}*|музыкант\\p{L}*)");
  const musicCredits = rule("Музыкальная запись с исполнителями", "feat|гимн|anthem");
  const maintenance = rule("Практический навык", "(?:ремонт|обслуживание|диагностика|настройка|установка|замена) (?:велосипед\\p{L}*|автомобил\\p{L}*|двигател\\p{L}*|розет\\p{L}*|смесител\\p{L}*|сантехник\\p{L}*|компьютер\\p{L}*|ноутбук\\p{L}*|стиральн\\p{L}*|мебел\\p{L}*|двер\\p{L}*|окон|посудомоечн\\p{L}*|холодильник\\p{L}*|кондиционер\\p{L}*)|технический осмотр|для новичков");
  function channelKey(value) {
    const text = String(value ?? "").trim();
    // Only YouTube identity paths become URL rules; display names stay display names.
    try {
      const url = new URL(text.startsWith("/") ? `https://www.youtube.com${text}` : text);
      if (!/^(?:www\.)?youtube\.com$/i.test(url.hostname)) return "";
      const path = decodeURIComponent(url.pathname).replace(/\/$/, "");
      const match = path.match(/^\/(?:(@[^/]+)|channel\/([^/]+)|c\/([^/]+)|user\/([^/]+))(?:\/|$)/i);
      if (match) return normalize(match[0].replace(/\/$/, ""));
      return "";
    } catch { /* A handle or a plain channel name is also a useful explicit rule. */ }
    if (/^@[^\s/]+$/.test(text)) return normalize(`/${text}`);
    return normalize(text);
  }
  function cleanList(value) {
    return Array.isArray(value) ? [...new Set(value.filter(v => typeof v === "string").map(v => v.trim().slice(0, 200)).filter(Boolean))].slice(0, 500) : [];
  }
  function config(input = {}) {
    const result = { ...defaults };
    for (const key of ["enabled", "strict", "hideShorts", "guardWatch"]) {
      if (typeof input[key] === "boolean") result[key] = input[key];
    }
    for (const key of ["allowChannels", "blockChannels", "allowWords", "blockWords"]) result[key] = cleanList(input[key]);
    return result;
  }
  function channelMatches(entries, video) {
    const identities = [channelKey(video.channelUrl), channelKey(video.channel), normalize(video.channel)].filter(Boolean);
    return entries.some(entry => {
      const key = channelKey(entry);
      return key && identities.includes(key);
    });
  }
  function containsPhrase(text, phrase) {
    const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped && word(escaped).test(text);
  }
  function classify(video, input = {}) {
    const cfg = config(input);
    const result = (allow, category, reason) => ({ allow, category, reason });
    if (!cfg.enabled) return result(true, "disabled", "Фильтр выключен");
    // The operator explicitly wants every YouTube music Mix preserved, regardless of game imagery.
    if (video.isMix || mixTitle.test(normalize(video.title))) return result(true, "music", "Музыкальный Джем YouTube — всегда оставляем");
    if (video.isShort && cfg.hideShorts) return result(false, "shorts", "Shorts скрыты в настройках");
    if (channelMatches(cfg.blockChannels, video)) return result(false, "channel", "Канал в списке скрытых");
    if (channelMatches(cfg.allowChannels, video)) return result(true, "channel", "Канал в списке разрешённых");
    // Titles carry the topic. A channel called “Python Music” must not bless every upload.
    const rawTitle = normalize(video.title);
    const title = semantic(video.title);
    const blocked = cfg.blockWords.find(term => containsPhrase(rawTitle, term));
    if (blocked) return result(false, "custom", `Скрывающее слово: ${blocked}`);
    const allowed = cfg.allowWords.find(term => containsPhrase(rawTitle, term));
    if (allowed) return result(true, "custom", `Разрешающее слово: ${allowed}`);
    const scienceReaction = word("химическ\\p{L}* реакци\\p{L}*|реакци\\p{L}* горени\\p{L}*").test(title);
    const distraction = entertainment.find(item => item.pattern.test(title) && !(item === entertainment[0] && scienceReaction));
    const musicSignal = [...music, musicCredits].find(item => item.pattern.test(title));
    // Explicit educational formats rescue documentary films and interviews used as lessons.
    const hardLesson = lesson.pattern.test(title);
    const practical = instructional.pattern.test(title);
    const development = technology.pattern.test(title) && (hardLesson || practical || knowledge.pattern.test(title));
    const isGame = gaming.pattern.test(title) || gameNames.pattern.test(title) || gameActivity.pattern.test(title);
    // A serialized Let's Play remains gameplay even when its episode is called “New Song”.
    const lpSeries = /^(?:lp|лп)(?: |$)/.test(title) && (isGame || /#\s*\d+/.test(rawTitle));
    if ((serialGameplay.pattern.test(title) || lpSeries) && !development) return result(false, "gaming", serialGameplay.label);
    if (musicStory.pattern.test(title) && !hardLesson) return result(false, "entertainment", musicStory.label);
    // A language/tool name is a topic, not evidence of a lesson (“I moved myself into Minecraft + Python”).
    if (firstPerson.pattern.test(title) && !hardLesson && (!musicSignal || isGame)) return result(false, "entertainment", firstPerson.label);
    if (tasting.pattern.test(title) && !hardLesson) return result(false, "entertainment", tasting.label);
    if (commentary.pattern.test(title) && !hardLesson) return result(false, "entertainment", commentary.label);
    const documentary = word("документальн\\p{L}*|documentary").test(title);
    const lessonException = hardLesson && (distraction === entertainment[1] || distraction === entertainment[3]);
    const mediaException = distraction === entertainment[3] && (musicSignal || documentary);
    if (distraction && !lessonException && !mediaException) {
      return result(false, "entertainment", distraction.label);
    }
    const gameplay = word("gameplay|walkthrough|playthrough|прохождени\\p{L}*|летспле\\p{L}*|speedrun|спидран\\p{L}*").test(title);
    if (gameplay && !development) return result(false, "gaming", gaming.label);
    if (musicSignal) return result(true, "music", musicSignal.label);
    if (isGame && !development) return result(false, "gaming", gaming.label);
    const learning = [lesson, instructional, knowledge, concepts, maintenance].find(item => item.pattern.test(title));
    if (learning) return result(true, "education", learning.label);
    if (distraction) return result(false, "entertainment", distraction.label);
    if (gamingChannel.pattern.test(semantic(video.channel)) || /\[(?:gd|cs2?|gaming)\]/i.test(String(video.channel || ""))) return result(false, "gaming", gamingChannel.label);
    // Topic is YouTube's auto-generated music channel suffix, not an inferred artist name.
    if (/(?: - | — )(?:topic|тема)$/i.test(String(video.channel ?? ""))) return result(true, "music", "Музыкальный канал Topic");
    return cfg.strict ? result(false, "unknown", "Тема не определена — строгий режим") : result(true, "unknown", "Тема не определена — мягкий режим");
  }
  globalThis.YTFocus = Object.freeze({ defaults, normalize, channelKey, config, classify, isMixTitle: value => mixTitle.test(normalize(value)) });
  if (typeof module !== "undefined" && module.exports) module.exports = globalThis.YTFocus;
})();
