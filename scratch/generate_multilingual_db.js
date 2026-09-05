const fs = require('fs');
const path = require('path');

// 1. KAPSAMLI VE %100 DOĞAL ÇEVRİMDIŞI CÜMLE & DEYİM VERİTABANI
// 8 Desteklenen Dil: Türkçe (tr), İngilizce (en), Almanca (de), Fransızca (fr), İspanyolca (es), Rusça (ru), İtalyanca (it), Arapça (ar)
const PHRASES = [
  // --- Aşk & Duygular (Love & Emotions) ---
  {
    id: "love_you",
    tr: "Seni seviyorum",
    en: "I love you",
    de: "Ich liebe dich",
    fr: "Je t'aime",
    es: "Te quiero",
    ru: "Я тебя люблю",
    it: "Ti amo",
    ar: "أحبك"
  },
  {
    id: "love_you_so_much",
    tr: "Seni çok seviyorum",
    en: "I love you so much",
    de: "Ich liebe dich sehr",
    fr: "Je t'aime tellement",
    es: "Te quiero mucho",
    ru: "Я очень тебя люблю",
    it: "Ti amo tanto",
    ar: "أحبك كثيراً"
  },
  {
    id: "miss_you",
    tr: "Seni özledim",
    en: "I miss you",
    de: "Ich vermisse dich",
    fr: "Tu me manques",
    es: "Te extraño",
    ru: "Я скучаю по тебе",
    it: "Mi manchi",
    ar: "اشتقت إليك"
  },
  {
    id: "happy",
    tr: "Çok mutluyum",
    en: "I am very happy",
    de: "Ich bin sehr glücklich",
    fr: "Je suis très heureux",
    es: "Estoy muy feliz",
    ru: "Я очень счастлив",
    it: "Sono molto felice",
    ar: "أنا سعيد جداً"
  },
  {
    id: "sad",
    tr: "Çok üzgünüm",
    en: "I am very sad",
    de: "Ich bin sehr traurig",
    fr: "Je suis très triste",
    es: "Estoy muy triste",
    ru: "Мне очень грустно",
    it: "Sono molto triste",
    ar: "أنا حزين جداً"
  },
  {
    id: "tired",
    tr: "Çok yorgunum",
    en: "I am very tired",
    de: "Ich bin sehr müde",
    fr: "Je suis très fatigué",
    es: "Estoy muy cansado",
    ru: "Я очень устал",
    it: "Sono molto stanco",
    ar: "أنا متعب جداً"
  },

  // --- Selamlaşma & Vedalaşma (Greetings & Farewells) ---
  {
    id: "hello",
    tr: "Merhaba",
    en: "Hello",
    de: "Hallo",
    fr: "Bonjour",
    es: "Hola",
    ru: "Привет",
    it: "Ciao",
    ar: "مرحباً"
  },
  {
    id: "good_morning",
    tr: "Günaydın",
    en: "Good morning",
    de: "Guten Morgen",
    fr: "Bonjour",
    es: "Buenos días",
    ru: "Доброе утро",
    it: "Buongiorno",
    ar: "صباح الخير"
  },
  {
    id: "good_day",
    tr: "İyi günler",
    en: "Have a nice day",
    de: "Guten Tag",
    fr: "Bonne journée",
    es: "Buen día",
    ru: "Хорошего дня",
    it: "Buona giornata",
    ar: "يوم سعيد"
  },
  {
    id: "good_evening",
    tr: "İyi akşamlar",
    en: "Good evening",
    de: "Guten Abend",
    fr: "Bonsoir",
    es: "Buenas tardes",
    ru: "Добрый вечер",
    it: "Buonasera",
    ar: "مساء الخير"
  },
  {
    id: "good_night",
    tr: "İyi geceler",
    en: "Good night",
    de: "Gute Nacht",
    fr: "Bonne nuit",
    es: "Buenas noches",
    ru: "Спокойной ночи",
    it: "Buonanotte",
    ar: "تصبح على خير"
  },
  {
    id: "goodbye",
    tr: "Hoşça kal",
    en: "Goodbye",
    de: "Auf Wiedersehen",
    fr: "Au revoir",
    es: "Adiós",
    ru: "До свидания",
    it: "Arrivederci",
    ar: "مع السلامة"
  },
  {
    id: "bye",
    tr: "Güle güle",
    en: "Bye",
    de: "Tschüss",
    fr: "Salut",
    es: "Chao",
    ru: "Пока",
    it: "Ciao",
    ar: "إلى اللقاء"
  },
  {
    id: "see_you_later",
    tr: "Sonra görüşürüz",
    en: "See you later",
    de: "Bis später",
    fr: "À plus tard",
    es: "Hasta luego",
    ru: "Увидимся позже",
    it: "A più tardi",
    ar: "أراك لاحقاً"
  },
  {
    id: "see_you_soon",
    tr: "Görüşmek üzere",
    en: "See you soon",
    de: "Bis bald",
    fr: "À bientôt",
    es: "Hasta pronto",
    ru: "До скорого",
    it: "A presto",
    ar: "أراك قريباً"
  },
  {
    id: "welcome",
    tr: "Hoş geldiniz",
    en: "Welcome",
    de: "Willkommen",
    fr: "Bienvenue",
    es: "Bienvenido",
    ru: "Добро пожаловать",
    it: "Benvenuto",
    ar: "أهلاً وسهلاً"
  },
  {
    id: "take_care",
    tr: "Kendine iyi bak",
    en: "Take care of yourself",
    de: "Pass auf dich auf",
    fr: "Prends soin de toi",
    es: "Cuídate",
    ru: "Береги себя",
    it: "Abbi cura di te",
    ar: "اعتنِ بنفسك"
  },

  // --- Nezaket & Teşekkür (Politeness & Courtesy) ---
  {
    id: "thank_you",
    tr: "Teşekkür ederim",
    en: "Thank you",
    de: "Danke",
    fr: "Merci",
    es: "Gracias",
    ru: "Спасибо",
    it: "Grazie",
    ar: "شكراً"
  },
  {
    id: "thanks",
    tr: "Teşekkürler",
    en: "Thanks",
    de: "Danke schön",
    fr: "Merci beaucoup",
    es: "Muchas gracias",
    ru: "Спасибо",
    it: "Grazie",
    ar: "شكراً لك"
  },
  {
    id: "thank_you_very_much",
    tr: "Çok teşekkür ederim",
    en: "Thank you very much",
    de: "Vielen Dank",
    fr: "Merci beaucoup",
    es: "Muchas gracias",
    ru: "Большое спасибо",
    it: "Grazie mille",
    ar: "شكراً جزيلاً"
  },
  {
    id: "you_are_welcome",
    tr: "Rica ederim",
    en: "You are welcome",
    de: "Bitte schön",
    fr: "De rien",
    es: "De nada",
    ru: "Пожалуйста",
    it: "Prego",
    ar: "عفواً"
  },
  {
    id: "not_at_all",
    tr: "Bir şey değil",
    en: "Not at all",
    de: "Keine Ursache",
    fr: "Il n'y a pas de quoi",
    es: "No hay de qué",
    ru: "Не за что",
    it: "Di niente",
    ar: "لا شكر على واجب"
  },
  {
    id: "please",
    tr: "Lütfen",
    en: "Please",
    de: "Bitte",
    fr: "S'il vous plaît",
    es: "Por favor",
    ru: "Пожалуйста",
    it: "Per favore",
    ar: "من فضلك"
  },
  {
    id: "sorry",
    tr: "Özür dilerim",
    en: "I am sorry",
    de: "Es tut mir leid",
    fr: "Je suis désolé",
    es: "Lo siento",
    ru: "Извините",
    it: "Mi dispiace",
    ar: "أنا آسف"
  },
  {
    id: "excuse_me",
    tr: "Afedersiniz",
    en: "Excuse me",
    de: "Entschuldigen Sie",
    fr: "Excusez-moi",
    es: "Disculpe",
    ru: "Простите",
    it: "Scusi",
    ar: "معذرة"
  },
  {
    id: "no_problem",
    tr: "Sorun değil",
    en: "No problem",
    de: "Kein Problem",
    fr: "Pas de problème",
    es: "No hay problema",
    ru: "Без проблем",
    it: "Nessun problema",
    ar: "لا توجد مشكلة"
  },
  {
    id: "no_worries",
    tr: "Sorun yok",
    en: "No worries",
    de: "Macht nichts",
    fr: "Ce n'est rien",
    es: "No te preocupes",
    ru: "Ничего страшного",
    it: "Non fa niente",
    ar: "لا بأس"
  },
  {
    id: "of_course",
    tr: "Tabii ki",
    en: "Of course",
    de: "Natürlich",
    fr: "Bien sûr",
    es: "Por supuesto",
    ru: "Конечно",
    it: "Certamente",
    ar: "بالطبع"
  },
  {
    id: "bon_appetit",
    tr: "Afiyet olsun",
    en: "Enjoy your meal",
    de: "Guten Appetit",
    fr: "Bon appétit",
    es: "Buen provecho",
    ru: "Приятного аппетита",
    it: "Buon appetito",
    ar: "بالهناء والشفاء"
  },
  {
    id: "kolay_gelsin",
    tr: "Kolay gelsin",
    en: "Have a good working day",
    de: "Frohes Schaffen",
    fr: "Bon travail",
    es: "Buen trabajo",
    ru: "Удачной работы",
    it: "Buon lavoro",
    ar: "عمل موفق"
  },
  {
    id: "get_well_soon",
    tr: "Geçmiş olsun",
    en: "Get well soon",
    de: "Gute Besserung",
    fr: "Bon rétablissement",
    es: "Que te mejores",
    ru: "Выздоравливай",
    it: "Buona guarigione",
    ar: "بالشفاء العاجل"
  },
  {
    id: "congratulations",
    tr: "Tebrikler",
    en: "Congratulations",
    de: "Herzlichen Glückwunsch",
    fr: "Félicitations",
    es: "Felicitaciones",
    ru: "Поздравляю",
    it: "Congratulazioni",
    ar: "مبروك"
  },
  {
    id: "happy_birthday",
    tr: "Doğum günün kutlu olsun",
    en: "Happy birthday",
    de: "Alles Gute zum Geburtstag",
    fr: "Joyeux anniversaire",
    es: "Feliz cumpleaños",
    ru: "С днём рождения",
    it: "Buon compleanno",
    ar: "عيد ميلاد سعيد"
  },

  // --- Soru & Tanışma & İletişim (Questions & Communication) ---
  {
    id: "how_are_you",
    tr: "Nasılsın",
    en: "How are you",
    de: "Wie geht es dir",
    fr: "Comment vas-tu",
    es: "¿Cómo estás?",
    ru: "Как дела?",
    it: "Come stai?",
    ar: "كيف حالك؟"
  },
  {
    id: "how_are_you_formal",
    tr: "Nasılsınız",
    en: "How are you",
    de: "Wie geht es Ihnen",
    fr: "Comment allez-vous",
    es: "¿Cómo está usted?",
    ru: "Как ваши дела?",
    it: "Come sta?",
    ar: "كيف حالكم؟"
  },
  {
    id: "i_am_fine",
    tr: "İyiyim",
    en: "I am fine",
    de: "Mir geht es gut",
    fr: "Je vais bien",
    es: "Estoy bien",
    ru: "Я в порядке",
    it: "Sto bene",
    ar: "أنا بخير"
  },
  {
    id: "fine_and_you",
    tr: "İyiyim sen nasılsın",
    en: "I am fine, how are you",
    de: "Mir geht es gut, und dir",
    fr: "Je vais bien, et toi",
    es: "Estoy bien, ¿y tú?",
    ru: "Хорошо, а ты?",
    it: "Bene, e tu?",
    ar: "أنا بخير، وأنت؟"
  },
  {
    id: "what_is_your_name",
    tr: "Adın ne",
    en: "What is your name",
    de: "Wie heißt du",
    fr: "Comment t'appelles-tu",
    es: "¿Cómo te llamas?",
    ru: "Как тебя зовут?",
    it: "Come ti chiami?",
    ar: "ما اسمك؟"
  },
  {
    id: "what_is_your_name_formal",
    tr: "Adınız nedir",
    en: "What is your name",
    de: "Wie heißen Sie",
    fr: "Comment vous appelez-vous",
    es: "¿Cómo se llama usted?",
    ru: "Как вас зовут?",
    it: "Come si chiama?",
    ar: "ما هو اسمك؟"
  },
  {
    id: "my_name_is",
    tr: "Benim adım",
    en: "My name is",
    de: "Mein Name ist",
    fr: "Je m'appelle",
    es: "Mi nombre es",
    ru: "Меня зовут",
    it: "Il mio nome è",
    ar: "اسمي"
  },
  {
    id: "nice_to_meet_you",
    tr: "Tanıştığıma memnun oldum",
    en: "Nice to meet you",
    de: "Freut mich, Sie kennenzulernen",
    fr: "Enchanté de faire votre connaissance",
    es: "Mucho gusto",
    ru: "Очень приятно познакомиться",
    it: "Piacere di conoscerti",
    ar: "تشرفت بمعرفتك"
  },
  {
    id: "where_are_you_from",
    tr: "Nerelisin",
    en: "Where are you from",
    de: "Woher kommst du",
    fr: "D'où viens-tu",
    es: "¿De dónde eres?",
    ru: "Откуда ты?",
    it: "Di dove sei?",
    ar: "من أين أنت؟"
  },
  {
    id: "how_old_are_you",
    tr: "Kaç yaşındasın",
    en: "How old are you",
    de: "Wie alt bist du",
    fr: "Quel âge as-tu",
    es: "¿Cuántos años tienes?",
    ru: "Сколько тебе лет?",
    it: "Quanti anni hai?",
    ar: "كم عمرك؟"
  },
  {
    id: "what_time_is_it",
    tr: "Saat kaç",
    en: "What time is it",
    de: "Wie spät ist es",
    fr: "Quelle heure est-il",
    es: "¿Qué hora es?",
    ru: "Который час?",
    it: "Che ore sono?",
    ar: "كم الساعة؟"
  },
  {
    id: "how_much_is_this",
    tr: "Bu ne kadar",
    en: "How much is this",
    de: "Wie viel kostet das",
    fr: "Combien ça coûte",
    es: "¿Cuánto cuesta esto?",
    ru: "Сколько это стоит?",
    it: "Quanto costa questo?",
    ar: "بكم هذا؟"
  },
  {
    id: "where_is_bathroom",
    tr: "Tuvalet nerede",
    en: "Where is the bathroom",
    de: "Wo ist die Toilette",
    fr: "Où sont les toilettes",
    es: "¿Dónde está el baño?",
    ru: "Где находится туалет?",
    it: "Dov'è il bagno?",
    ar: "أين الحمام؟"
  },
  {
    id: "where_is_hospital",
    tr: "Hastane nerede",
    en: "Where is the hospital",
    de: "Wo ist das Krankenhaus",
    fr: "Où est l'hôpital",
    es: "¿Dónde está el hospital?",
    ru: "Где больница?",
    it: "Dov'è l'ospedale?",
    ar: "أين المستشفى؟"
  },
  {
    id: "can_you_help_me",
    tr: "Bana yardım edebilir misiniz",
    en: "Can you help me",
    de: "Können Sie mir helfen",
    fr: "Pouvez-vous m'aider",
    es: "¿Puede ayudarme?",
    ru: "Можете ли вы мне помочь?",
    it: "Può aiutarmi?",
    ar: "هل يمكنك مساعدتي؟"
  },
  {
    id: "help_me",
    tr: "Yardım edin",
    en: "Help me",
    de: "Hilf mir",
    fr: "Aidez-moi",
    es: "¡Ayúdame!",
    ru: "Помогите мне",
    it: "Aiutami",
    ar: "ساعدني"
  },
  {
    id: "i_do_not_understand",
    tr: "Anlamıyorum",
    en: "I do not understand",
    de: "Ich verstehe nicht",
    fr: "Je ne comprends pas",
    es: "No entiendo",
    ru: "Я не понимаю",
    it: "Non capisco",
    ar: "أنا لا أفهم"
  },
  {
    id: "i_understand",
    tr: "Anladım",
    en: "I understand",
    de: "Ich habe verstanden",
    fr: "J'ai compris",
    es: "Entiendo",
    ru: "Я понял",
    it: "Ho capito",
    ar: "فهمت"
  },
  {
    id: "i_know",
    tr: "Biliyorum",
    en: "I know",
    de: "Ich weiß",
    fr: "Je sais",
    es: "Lo sé",
    ru: "Я знаю",
    it: "Lo so",
    ar: "أعلم"
  },
  {
    id: "i_dont_know",
    tr: "Bilmiyorum",
    en: "I don't know",
    de: "Ich weiß nicht",
    fr: "Je ne sais pas",
    es: "No lo sé",
    ru: "Я не знаю",
    it: "Non lo so",
    ar: "لا أعلم"
  },
  {
    id: "speak_english",
    tr: "İngilizce biliyor musunuz",
    en: "Do you speak English",
    de: "Sprechen Sie Englisch",
    fr: "Parlez-vous anglais",
    es: "¿Habla inglés?",
    ru: "Вы говорите по-английски?",
    it: "Parla inglese?",
    ar: "هل تتحدث الإنجليزية؟"
  },
  {
    id: "speak_turkish",
    tr: "Türkçe biliyor musunuz",
    en: "Do you speak Turkish",
    de: "Sprechen Sie Türkisch",
    fr: "Parlez-vous turc",
    es: "¿Habla turco?",
    ru: "Вы говорите по-турецки?",
    it: "Parla turco?",
    ar: "هل تتحدث التركية؟"
  },
  {
    id: "repeat_please",
    tr: "Tekrar edebilir misiniz",
    en: "Could you repeat that",
    de: "Könnten Sie das wiederholen",
    fr: "Pourriez-vous répéter",
    es: "¿Podría repetirlo?",
    ru: "Повторите, пожалуйста",
    it: "Potrebbe ripetere?",
    ar: "هل يمكنك التكرار؟"
  },
  {
    id: "speak_slowly",
    tr: "Lütfen yavaş konuşun",
    en: "Please speak slowly",
    de: "Bitte sprechen Sie langsam",
    fr: "Parlez lentement, s'il vous plaît",
    es: "Hable más despacio, por favor",
    ru: "Говорите медленнее, пожалуйста",
    it: "Parli più lentamente, per favore",
    ar: "تكلم ببطء من فضلك"
  },

  // --- Temel İfadeler & İhtiyaçlar (Basics & Needs) ---
  {
    id: "yes",
    tr: "Evet",
    en: "Yes",
    de: "Ja",
    fr: "Oui",
    es: "Sí",
    ru: "Да",
    it: "Sì",
    ar: "نعم"
  },
  {
    id: "no",
    tr: "Hayır",
    en: "No",
    de: "Nein",
    fr: "Non",
    es: "No",
    ru: "Нет",
    it: "No",
    ar: "لا"
  },
  {
    id: "maybe",
    tr: "Belki",
    en: "Maybe",
    de: "Vielleicht",
    fr: "Peut-être",
    es: "Tal vez",
    ru: "Может быть",
    it: "Forse",
    ar: "ربما"
  },
  {
    id: "okay",
    tr: "Tamam",
    en: "Okay",
    de: "In Ordnung",
    fr: "D'accord",
    es: "Está bien",
    ru: "Хорошо",
    it: "Va bene",
    ar: "حسناً"
  },
  {
    id: "hungry",
    tr: "Acıktım",
    en: "I am hungry",
    de: "Ich habe Hunger",
    fr: "J'ai faim",
    es: "Tengo hambre",
    ru: "Я хочу есть",
    it: "Ho fame",
    ar: "أنا جائع"
  },
  {
    id: "thirsty",
    tr: "Susadım",
    en: "I am thirsty",
    de: "Ich habe Durst",
    fr: "J'ai soif",
    es: "Tengo sed",
    ru: "Я хочу пить",
    it: "Ho sete",
    ar: "أنا عطشان"
  },
  {
    id: "water_please",
    tr: "Su istiyorum",
    en: "I want water",
    de: "Ich möchte Wasser",
    fr: "Je veux de l'eau",
    es: "Quiero agua",
    ru: "Я хочу воды",
    it: "Vorrei dell'acqua",
    ar: "أريد ماء"
  },
  {
    id: "bill_please",
    tr: "Hesap lütfen",
    en: "The bill please",
    de: "Die Rechnung bitte",
    fr: "L'addition, s'il vous plaît",
    es: "La cuenta, por favor",
    ru: "Счёт, пожалуйста",
    it: "Il conto, per favore",
    ar: "الحساب من فضلك"
  },
  {
    id: "menu_please",
    tr: "Menü lütfen",
    en: "Menu please",
    de: "Die Speisekarte bitte",
    fr: "Le menu, s'il vous plaît",
    es: "El menú, por favor",
    ru: "Меню, пожалуйста",
    it: "Il menu, per favore",
    ar: "قائمة الطعام من فضلك"
  },
  {
    id: "delicious",
    tr: "Çok lezzetli",
    en: "Very delicious",
    de: "Sehr lecker",
    fr: "Très délicieux",
    es: "Muy delicioso",
    ru: "Очень вкусно",
    it: "Molto buono",
    ar: "لذيذ جداً"
  },
  {
    id: "lost",
    tr: "Kayboldum",
    en: "I am lost",
    de: "Ich habe mich verirrt",
    fr: "Je suis perdu",
    es: "Estoy perdido",
    ru: "Я заблудился",
    it: "Mi sono perso",
    ar: "أنا ضائع"
  },
  {
    id: "need_doctor",
    tr: "Doktora ihtiyacım var",
    en: "I need a doctor",
    de: "Ich brauche einen Arzt",
    fr: "J'ai besoin d'un médecin",
    es: "Necesito un médico",
    ru: "Мне нужен врач",
    it: "Ho bisogno di un medico",
    ar: "أحتاج إلى طبيب"
  },
  {
    id: "need_help",
    tr: "Yardıma ihtiyacım var",
    en: "I need help",
    de: "Ich brauche Hilfe",
    fr: "J'ai besoin d'aide",
    es: "Necesito ayuda",
    ru: "Мне нужна помощь",
    it: "Ho bisogno di aiuto",
    ar: "أحتاج مساعدة"
  },
  {
    id: "going_home",
    tr: "Eve gidiyorum",
    en: "I am going home",
    de: "Ich gehe nach Hause",
    fr: "Je rentre à la maison",
    es: "Voy a casa",
    ru: "Я иду домой",
    it: "Vado a casa",
    ar: "أنا ذاهب إلى المنزل"
  },
  {
    id: "going_work",
    tr: "İşe gidiyorum",
    en: "I am going to work",
    de: "Ich gehe zur Arbeit",
    fr: "Je vais au travail",
    es: "Voy al trabajo",
    ru: "Я иду на работу",
    it: "Vado al lavoro",
    ar: "أنا ذاهب إلى العمل"
  }
];

// 2. KAPSAMLI ÇOK DİLLİ ÇEVRİMDIŞI TEMEL SÖZLÜK (LEXICON)
// İsimler, Fiiller, Sıfatlar, Zamirler
const VOCABULARY = [
  // Zamirler (Pronouns)
  { tr: "ben", en: "I", de: "ich", fr: "je", es: "yo", ru: "я", it: "io", ar: "أنا", pos: "zamir" },
  { tr: "sen", en: "you", de: "du", fr: "tu", es: "tú", ru: "ты", it: "tu", ar: "أنت", pos: "zamir" },
  { tr: "o", en: "he / she / it", de: "er / sie / es", fr: "il / elle", es: "él / ella", ru: "он / она", it: "lui / lei", ar: "هو / هي", pos: "zamir" },
  { tr: "biz", en: "we", de: "wir", fr: "nous", es: "nosotros", ru: "мы", it: "noi", ar: "نحن", pos: "zamir" },
  { tr: "siz", en: "you", de: "ihr / Sie", fr: "vous", es: "ustedes / vosotros", ru: "вы", it: "voi", ar: "أنتم", pos: "zamir" },
  { tr: "onlar", en: "they", de: "sie", fr: "ils / elles", es: "ellos / ellas", ru: "они", it: "loro", ar: "هم", pos: "zamir" },

  // Aile (Family)
  { tr: "anne", en: "mother", de: "Mutter", fr: "mère", es: "madre", ru: "мать", it: "madre", ar: "أم", pos: "isim" },
  { tr: "baba", en: "father", de: "Vater", fr: "père", es: "padre", ru: "отец", it: "padre", ar: "أب", pos: "isim" },
  { tr: "kardeş", en: "sibling / brother / sister", de: "Geschwister", fr: "frère / sœur", es: "hermano / hermana", ru: "брат / сестра", it: "fratello / sorella", ar: "أخ / أخت", pos: "isim" },
  { tr: "çocuk", en: "child", de: "Kind", fr: "enfant", es: "niño", ru: "ребёнок", it: "bambino", ar: "طفل", pos: "isim" },
  { tr: "bebek", en: "baby", de: "Baby", fr: "bébé", es: "bebé", ru: "малыш", it: "neonato", ar: "رضيع", pos: "isim" },
  { tr: "aile", en: "family", de: "Familie", fr: "famille", es: "familia", ru: "семья", it: "famiglia", ar: "عائلة", pos: "isim" },
  { tr: "arkadaş", en: "friend", de: "Freund", fr: "ami", es: "amigo", ru: "друг", it: "amico", ar: "صديق", pos: "isim" },

  // Günlük Nesneler & Teknoloji (Objects & Tech)
  { tr: "su", en: "water", de: "Wasser", fr: "eau", es: "agua", ru: "вода", it: "acqua", ar: "ماء", pos: "isim" },
  { tr: "ekmek", en: "bread", de: "Brot", fr: "pain", es: "pan", ru: "хлеб", it: "pane", ar: "خبز", pos: "isim" },
  { tr: "çay", en: "tea", de: "Tee", fr: "thé", es: "té", ru: "чай", it: "tè", ar: "شاي", pos: "isim" },
  { tr: "kahve", en: "coffee", de: "Kaffee", fr: "café", es: "café", ru: "кофе", it: "caffè", ar: "قهوة", pos: "isim" },
  { tr: "süt", en: "milk", de: "Milch", fr: "lait", es: "leche", ru: "молоко", it: "latte", ar: "حليب", pos: "isim" },
  { tr: "yemek", en: "food / meal", de: "Essen", fr: "nourriture", es: "comida", ru: "еда", it: "cibo", ar: "طعام", pos: "isim" },
  { tr: "elma", en: "apple", de: "Apfel", fr: "pomme", es: "manzana", ru: "яблоко", it: "mela", ar: "تفاحة", pos: "isim" },
  
  { tr: "kitap", en: "book", de: "Buch", fr: "livre", es: "libro", ru: "книга", it: "libro", ar: "كتاب", pos: "isim" },
  { tr: "kalem", en: "pen / pencil", de: "Stift", fr: "stylo", es: "bolígrafo", ru: "ручка", it: "penna", ar: "قلم", pos: "isim" },
  { tr: "bilgisayar", en: "computer", de: "Computer", fr: "ordinateur", es: "computadora", ru: "компьютер", it: "computer", ar: "حاسوب", pos: "isim" },
  { tr: "telefon", en: "phone", de: "Telefon", fr: "téléphone", es: "teléfono", ru: "телефон", it: "telefono", ar: "هاتف", pos: "isim" },
  { tr: "dosya", en: "file", de: "Datei", fr: "fichier", es: "archivo", ru: "файл", it: "file", ar: "ملف", pos: "isim" },
  { tr: "araba", en: "car", de: "Auto", fr: "voiture", es: "coche", ru: "машина", it: "auto", ar: "سيارة", pos: "isim" },
  { tr: "ev", en: "house / home", de: "Haus", fr: "maison", es: "casa", ru: "дом", it: "casa", ar: "منزل", pos: "isim" },
  { tr: "oda", en: "room", de: "Zimmer", fr: "chambre", es: "habitación", ru: "комната", it: "stanza", ar: "غرفة", pos: "isim" },
  { tr: "kapı", en: "door", de: "Tür", fr: "porte", es: "puerta", ru: "дверь", it: "porta", ar: "باب", pos: "isim" },
  { tr: "pencere", en: "window", de: "Fenster", fr: "fenêtre", es: "ventana", ru: "окно", it: "finestra", ar: "نافذة", pos: "isim" },
  { tr: "masa", en: "table", de: "Tisch", fr: "table", es: "mesa", ru: "стол", it: "tavolo", ar: "طاولة", pos: "isim" },
  { tr: "sandalye", en: "chair", de: "Stuhl", fr: "chaise", es: "silla", ru: "стул", it: "sedia", ar: "كرسي", pos: "isim" },
  { tr: "okul", en: "school", de: "Schule", fr: "école", es: "escuela", ru: "школа", it: "scuola", ar: "مدرسة", pos: "isim" },
  { tr: "iş", en: "work / job", de: "Arbeit", fr: "travail", es: "trabajo", ru: "работа", it: "lavoro", ar: "عمل", pos: "isim" },
  { tr: "hastane", en: "hospital", de: "Krankenhaus", fr: "hôpital", es: "hospital", ru: "больница", it: "ospedale", ar: "مستشفى", pos: "isim" },
  { tr: "şehir", en: "city", de: "Stadt", fr: "ville", es: "ciudad", ru: "город", it: "città", ar: "مدينة", pos: "isim" },
  { tr: "ülke", en: "country", de: "Land", fr: "pays", es: "país", ru: "страна", it: "paese", ar: "بلد", pos: "isim" },
  { tr: "dünya", en: "world", de: "Welt", fr: "monde", es: "mundo", ru: "мир", it: "mondo", ar: "عالم", pos: "isim" },
  { tr: "para", en: "money", de: "Geld", fr: "argent", es: "dinero", ru: "деньги", it: "denaro", ar: "مال", pos: "isim" },

  // Zaman & Doğa (Time & Nature)
  { tr: "gün", en: "day", de: "Tag", fr: "jour", es: "día", ru: "день", it: "giorno", ar: "يوم", pos: "isim" },
  { tr: "gece", en: "night", de: "Nacht", fr: "nuit", es: "noche", ru: "ночь", it: "notte", ar: "ليل", pos: "isim" },
  { tr: "sabah", en: "morning", de: "Morgen", fr: "matin", es: "mañana", ru: "утро", it: "mattina", ar: "صباح", pos: "isim" },
  { tr: "akşam", en: "evening", de: "Abend", fr: "soir", es: "tarde", ru: "вечер", it: "sera", ar: "مساء", pos: "isim" },
  { tr: "bugün", en: "today", de: "heute", fr: "aujourd'hui", es: "hoy", ru: "сегодня", it: "oggi", ar: "اليوم", pos: "zarf" },
  { tr: "dün", en: "yesterday", de: "gestern", fr: "hier", es: "ayer", ru: "вчера", it: "ieri", ar: "أمس", pos: "zarf" },
  { tr: "yarın", en: "tomorrow", de: "morgen", fr: "demain", es: "mañana", ru: "завтра", it: "domani", ar: "غداً", pos: "zarf" },
  { tr: "saat", en: "hour / clock", de: "Stunde / Uhr", fr: "heure", es: "hora / reloj", ru: "час", it: "ora", ar: "ساعة", pos: "isim" },
  { tr: "zaman", en: "time", de: "Zeit", fr: "temps", es: "tiempo", ru: "время", it: "tempo", ar: "وقت", pos: "isim" },
  { tr: "yıl", en: "year", de: "Jahr", fr: "année", es: "año", ru: "год", it: "anno", ar: "سنة", pos: "isim" },
  { tr: "güneş", en: "sun", de: "Sonne", fr: "soleil", es: "sol", ru: "солнце", it: "sole", ar: "شمس", pos: "isim" },
  { tr: "ay", en: "moon / month", de: "Mond / Monat", fr: "lune / mois", es: "luna / mes", ru: "луна / месяц", it: "luna / mese", ar: "قمر / شهر", pos: "isim" },
  { tr: "deniz", en: "sea", de: "Meer", fr: "mer", es: "mar", ru: "море", it: "mare", ar: "بحر", pos: "isim" },
  { tr: "yağmur", en: "rain", de: "Regen", fr: "pluie", es: "lluvia", ru: "дождь", it: "pioggia", ar: "مطر", pos: "isim" },

  // Temel Sıfatlar (Adjectives)
  { tr: "iyi", en: "good", de: "gut", fr: "bon", es: "bueno", ru: "хороший", it: "buono", ar: "جيد", pos: "sıfat" },
  { tr: "kötü", en: "bad", de: "schlecht", fr: "mauvais", es: "malo", ru: "плохой", it: "cattivo", ar: "سيء", pos: "sıfat" },
  { tr: "büyük", en: "big / large", de: "groß", fr: "grand", es: "grande", ru: "большой", it: "grande", ar: "كبير", pos: "sıfat" },
  { tr: "küçük", en: "small", de: "klein", fr: "petit", es: "pequeño", ru: "маленький", it: "piccolo", ar: "صغير", pos: "sıfat" },
  { tr: "güzel", en: "beautiful / nice", de: "schön", fr: "beau / belle", es: "hermoso / bonito", ru: "красивый", it: "bello", ar: "جميل", pos: "sıfat" },
  { tr: "yeni", en: "new", de: "neu", fr: "nouveau", es: "nuevo", ru: "новый", it: "nuovo", ar: "جديد", pos: "sıfat" },
  { tr: "eski", en: "old", de: "alt", fr: "vieux / ancien", es: "viejo", ru: "старый", it: "vecchio", ar: "قديم", pos: "sıfat" },
  { tr: "sıcak", en: "hot / warm", de: "heiß / warm", fr: "chaud", es: "caliente", ru: "горячий", it: "caldo", ar: "حار", pos: "sıfat" },
  { tr: "soğuk", en: "cold", de: "kalt", fr: "froid", es: "frío", ru: "холодный", it: "freddo", ar: "بارد", pos: "sıfat" },
  { tr: "kolay", en: "easy", de: "einfach / leicht", fr: "facile", es: "fácil", ru: "лёгкий", it: "facile", ar: "سهل", pos: "sıfat" },
  { tr: "zor", en: "difficult / hard", de: "schwierig", fr: "difficile", es: "difícil", ru: "трудный", it: "difficile", ar: "صعب", pos: "sıfat" },
  { tr: "hızlı", en: "fast / quick", de: "schnell", fr: "rapide", es: "rápido", ru: "быстрый", it: "veloce", ar: "سريع", pos: "sıfat" },
  { tr: "yavaş", en: "slow", de: "langsam", fr: "lent", es: "lento", ru: "медленный", it: "lento", ar: "بطيء", pos: "sıfat" },
  { tr: "mutlu", en: "happy", de: "glücklich", fr: "heureux", es: "feliz", ru: "счастливый", it: "felice", ar: "سعيد", pos: "sıfat" },
  { tr: "üzgün", en: "sad", de: "traurig", fr: "triste", es: "triste", ru: "грустный", it: "triste", ar: "حزين", pos: "sıfat" },

  // Temel Fiiller (Verbs)
  { tr: "sevmek", en: "to love", de: "lieben", fr: "aimer", es: "amar", ru: "любить", it: "amare", ar: "يحب", pos: "fiil" },
  { tr: "gitmek", en: "to go", de: "gehen", fr: "aller", es: "ir", ru: "идти", it: "andare", ar: "يذهب", pos: "fiil" },
  { tr: "gelmek", en: "to come", de: "kommen", fr: "venir", es: "venir", ru: "приходить", it: "venire", ar: "يأتي", pos: "fiil" },
  { tr: "görmek", en: "to see", de: "sehen", fr: "voir", es: "ver", ru: "видеть", it: "vedere", ar: "يرى", pos: "fiil" },
  { tr: "bilmek", en: "to know", de: "wissen", fr: "savoir", es: "saber", ru: "знать", it: "sapere", ar: "يعلم", pos: "fiil" },
  { tr: "istemek", en: "to want", de: "wollen / möchten", fr: "vouloir", es: "querer", ru: "хотеть", it: "volere", ar: "يريد", pos: "fiil" },
  { tr: "anlamak", en: "to understand", de: "verstehen", fr: "comprendre", es: "entender", ru: "понимать", it: "capire", ar: "يفهم", pos: "fiil" },
  { tr: "konuşmak", en: "to speak / talk", de: "sprechen", fr: "parler", es: "hablar", ru: "говорить", it: "parlare", ar: "يتكلم", pos: "fiil" },
  { tr: "yemek yemek", en: "to eat", de: "essen", fr: "manger", es: "comer", ru: "есть", it: "mangiare", ar: "يأكل", pos: "fiil" },
  { tr: "içmek", en: "to drink", de: "trinken", fr: "boire", es: "beber", ru: "пить", it: "bere", ar: "يشرب", pos: "fiil" },
  { tr: "uyumak", en: "to sleep", de: "schlafen", fr: "dormir", es: "dormir", ru: "спать", it: "dormire", ar: "ينام", pos: "fiil" },
  { tr: "çalışmak", en: "to work", de: "arbeiten", fr: "travailler", es: "trabajar", ru: "работать", it: "lavorare", ar: "يعمل", pos: "fiil" },
  { tr: "okumak", en: "to read", de: "lesen", fr: "lire", es: "leer", ru: "читать", it: "leggere", ar: "يقرأ", pos: "fiil" },
  { tr: "yazmak", en: "to write", de: "schreiben", fr: "écrire", es: "escribir", ru: "писать", it: "scrivere", ar: "يكتب", pos: "fiil" },
  { tr: "yapmak", en: "to do / make", de: "machen", fr: "faire", es: "hacer", ru: "делать", it: "fare", ar: "يفعل", pos: "fiil" },
  { tr: "yardım etmek", en: "to help", de: "helfen", fr: "aider", es: "ayudar", ru: "помогать", it: "aiutare", ar: "يساعد", pos: "fiil" }
];

const db = {
  version: "2.0.0",
  languages: ["tr", "en", "de", "fr", "es", "ru", "it", "ar"],
  phrases: PHRASES,
  vocabulary: VOCABULARY
};

const targetPath = path.join(__dirname, '..', 'assets', 'dictionary', 'multilingual_offline_db.json');
fs.writeFileSync(targetPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`[Success] Written ${PHRASES.length} phrases and ${VOCABULARY.length} vocabulary words to ${targetPath}`);
