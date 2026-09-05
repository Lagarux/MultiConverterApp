// dictionaryEngine.js - Evrensel Gömülü Sözlük ve Hibrit (Çevrimdışı + Çevrimiçi) Çeviri Motoru
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

function fetchBufferWithRedirects(url, maxRedirects = 3) {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) return reject(new Error('Çok fazla yönlendirme'));
        const client = url.startsWith('https:') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
            },
            timeout: 6000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchBufferWithRedirects(res.headers.location, maxRedirects - 1));
            }
            if (res.statusCode !== 200) {
                return reject(new Error('HTTP Status: ' + res.statusCode));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Zaman aşımı')); });
        req.on('error', reject);
    });
}

let ESpeakNgInstance = null;
async function getESpeakNg() {
    if (!ESpeakNgInstance) {
        const candidatePaths = ['espeak-ng'];
        if (typeof process !== 'undefined' && process.resourcesPath) {
            candidatePaths.unshift(
                path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'espeak-ng', 'dist', 'espeak-ng.js')
            );
        }
        candidatePaths.push(
            path.join(__dirname, 'node_modules', 'espeak-ng', 'dist', 'espeak-ng.js')
        );

        for (const cPath of candidatePaths) {
            try {
                let mod;
                if (cPath === 'espeak-ng') {
                    mod = await import('espeak-ng');
                } else if (fs.existsSync(cPath)) {
                    const { pathToFileURL } = require('url');
                    mod = await import(pathToFileURL(cPath).href);
                }
                if (mod) {
                    ESpeakNgInstance = mod.default || mod;
                    break;
                }
            } catch (e) {}
        }
    }
    return ESpeakNgInstance;
}

// Normalize string for Turkish and international searches
function normalize(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .trim();
}

// 5,746 Kelimelik Kapsamlı Oxford İngilizce-Türkçe Sözlüğü
let OXFORD_DICT = [];
const OXFORD_MAP = new Map(); // en -> entry
const REVERSE_OXFORD_MAP = new Map(); // tr -> array of entries

// Sürekli Büyüyen ve Kendi Kendini Güncelleyen Kelime Haznesi (Learned Vocabulary)
let LEARNED_VOCABULARY = [];
const LEARNED_MAP = new Map(); // key `${sLang}_${tLang}_${cleanWord}` -> entry
let currentStorageDir = path.join(__dirname, 'assets', 'dictionary');

function initLearnedVocabulary(userDataDir) {
    if (userDataDir) {
        currentStorageDir = userDataDir;
    }
    try {
        const learnedFilePath = path.join(currentStorageDir, 'learned_vocabulary.json');
        if (fs.existsSync(learnedFilePath)) {
            const content = fs.readFileSync(learnedFilePath, 'utf8');
            LEARNED_VOCABULARY = JSON.parse(content || '[]');
            LEARNED_VOCABULARY.forEach(item => {
                if (item && item.word) {
                    const normW = normalize(item.word);
                    const sL = (item.sourceLang || 'en').toLowerCase();
                    const tL = (item.targetLang || 'tr').toLowerCase();
                    LEARNED_MAP.set(`${sL}_${tL}_${normW}`, item);

                    // Eğer İngilizce->Türkçe ise Oxford map'e de bağla
                    if (sL === 'en' && tL === 'tr') {
                        OXFORD_MAP.set(normW, {
                            w: item.word,
                            m: item.meaningsList || (item.tr ? [item.tr] : []),
                            pos: item.type || 'Öğrenilen',
                            c: item.level || 'Kullanıcı',
                            ph: item.ipa || '',
                            ex: item.examples && item.examples[0] ? item.examples[0].en : '',
                            tr: item.examples && item.examples[0] ? item.examples[0].tr : ''
                        });
                    }
                }
            });
            console.log(`[dictionaryEngine] ${LEARNED_VOCABULARY.length} adet dinamik öğrenilmiş kelime hazneye eklendi.`);
        }
    } catch (e) {
        console.error('[dictionaryEngine] learned_vocabulary.json yüklenirken hata:', e.message);
    }
}

function saveLearnedWord(item) {
    if (!item || !item.word) return;
    const normW = normalize(item.word);
    const sL = (item.sourceLang || 'en').toLowerCase();
    const tL = (item.targetLang || 'tr').toLowerCase();
    const key = `${sL}_${tL}_${normW}`;

    if (LEARNED_MAP.has(key)) return; // Zaten kayıtlı

    const entry = {
        word: item.word,
        tr: item.tr || '',
        meaningsList: item.meaningsList || (item.tr ? item.tr.split(',').map(s => s.trim()) : [item.word]),
        type: item.type || 'Öğrenilen Kelime',
        level: item.level || 'Hazneye Kaydedildi',
        ipa: item.ipa || '',
        audioUrl: item.audioUrl || '',
        examples: item.examples || [],
        definitions: item.definitions || [],
        syn: item.syn || [],
        sourceLang: sL,
        targetLang: tL,
        learnedAt: new Date().toISOString()
    };

    LEARNED_MAP.set(key, entry);
    LEARNED_VOCABULARY.push(entry);

    // Kalıcı JSON dosyasına yaz (Asenkron)
    try {
        if (!fs.existsSync(currentStorageDir)) {
            fs.mkdirSync(currentStorageDir, { recursive: true });
        }
        const learnedFilePath = path.join(currentStorageDir, 'learned_vocabulary.json');
        fs.writeFile(learnedFilePath, JSON.stringify(LEARNED_VOCABULARY, null, 2), 'utf8', (err) => {
            if (err) console.error('[dictionaryEngine] learned_vocabulary kaydedilemedi:', err.message);
            else console.log(`[dictionaryEngine] "${item.word}" kelimesi kelime haznesine kalıcı olarak kaydedildi!`);
        });
    } catch(e) {}
}

function getLearnedStats() {
    return {
        count: LEARNED_VOCABULARY.length,
        items: LEARNED_VOCABULARY.slice(-15).reverse()
    };
}

try {
    const oxfordPath = path.join(__dirname, 'assets', 'dictionary', 'oxford_en_tr.json');
    if (fs.existsSync(oxfordPath)) {
        OXFORD_DICT = JSON.parse(fs.readFileSync(oxfordPath, 'utf8'));
        OXFORD_DICT.forEach(item => {
            if (item && item.w) {
                const normW = normalize(item.w);
                OXFORD_MAP.set(normW, item);

                // Türkçe karşılıkları ters haritaya ekle
                if (Array.isArray(item.m)) {
                    item.m.forEach(meaning => {
                        const normM = normalize(meaning);
                        if (!REVERSE_OXFORD_MAP.has(normM)) {
                            REVERSE_OXFORD_MAP.set(normM, []);
                        }
                        REVERSE_OXFORD_MAP.get(normM).push(item);
                    });
                }
            }
        });
        console.log(`[dictionaryEngine] ${OXFORD_DICT.length} Oxford kelimesi başarıyla belleğe yüklendi.`);
    }
} catch (err) {
    console.error('[dictionaryEngine] Oxford sözlüğü yüklenirken hata:', err);
}

// Başlangıçta varsayılan dizinden öğrenilen kelimeleri yükle
initLearnedVocabulary();

// Kapsamlı Çok Dilli Çevrimdışı Veritabanı (8 Dil: TR, EN, DE, FR, ES, RU, IT, AR)
let MULTILINGUAL_DB = { phrases: [], vocabulary: [] };
const MULTI_DICT = {};
const PHRASEBOOK = [];

try {
    const multiDbPath = path.join(__dirname, 'assets', 'dictionary', 'multilingual_offline_db.json');
    if (fs.existsSync(multiDbPath)) {
        MULTILINGUAL_DB = JSON.parse(fs.readFileSync(multiDbPath, 'utf8'));
        const supportedLangs = MULTILINGUAL_DB.languages || ['tr', 'en', 'de', 'fr', 'es', 'ru', 'it', 'ar'];

        for (const sL of supportedLangs) {
            for (const tL of supportedLangs) {
                if (sL === tL) continue;
                const pairKey = `${sL}_${tL}`;
                if (!MULTI_DICT[pairKey]) MULTI_DICT[pairKey] = [];

                // Cümleleri PHRASEBOOK'a ekle
                if (Array.isArray(MULTILINGUAL_DB.phrases)) {
                    MULTILINGUAL_DB.phrases.forEach(phrase => {
                        const src = phrase[sL];
                        const tgt = phrase[tL];
                        if (src && tgt) {
                            PHRASEBOOK.push({
                                src: src.toLowerCase().replace(/[.!?]/g, '').trim(),
                                tr: tgt,
                                lang: pairKey,
                                fullSrc: src,
                                fullTgt: tgt
                            });
                        }
                    });
                }

                // Kelimeleri MULTI_DICT'e ekle
                if (Array.isArray(MULTILINGUAL_DB.vocabulary)) {
                    MULTILINGUAL_DB.vocabulary.forEach(vocab => {
                        const src = vocab[sL];
                        const tgt = vocab[tL];
                        if (src && tgt) {
                            MULTI_DICT[pairKey].push({
                                word: src,
                                tr: tgt,
                                type: vocab.pos || 'kelime',
                                ipa: '',
                                ex: '',
                                ex_tr: '',
                                syn: []
                            });
                        }
                    });
                }
            }
        }
        console.log(`[dictionaryEngine] Çok dilli veri tabanı yüklendi: ${MULTILINGUAL_DB.phrases.length} cümle/deyim, ${MULTILINGUAL_DB.vocabulary.length} temel kelime.`);
    }
} catch (e) {
    console.error('[dictionaryEngine] multilingual_offline_db.json yüklenirken hata:', e.message);
}

/**
 * %100 Çevrimdışı Veritabanında Doğrudan Cümle veya Kelime Arama
 */
function findOfflineTranslation(text, sourceLang, targetLang) {
    if (!text) return null;
    const sLang = (sourceLang || 'en').toLowerCase().split(/[-_]/)[0];
    const tLang = (targetLang || 'tr').toLowerCase().split(/[-_]/)[0];
    const clean = normalize(text);
    if (!clean) return null;

    // 1. Cümle / Deyim Veritabanında Tam Eşleşme (Exact Phrase)
    if (Array.isArray(MULTILINGUAL_DB.phrases)) {
        for (const p of MULTILINGUAL_DB.phrases) {
            const sVal = p[sLang];
            const tVal = p[tLang];
            if (sVal && tVal) {
                if (normalize(sVal) === clean) {
                    return {
                        translatedText: tVal,
                        originalText: sVal,
                        isPhrase: true
                    };
                }
            }
        }
    }

    // 2. Temel Kelime Veritabanında Tam Eşleşme (Exact Word)
    if (Array.isArray(MULTILINGUAL_DB.vocabulary)) {
        for (const v of MULTILINGUAL_DB.vocabulary) {
            const sVal = v[sLang];
            const tVal = v[tLang];
            if (sVal && tVal) {
                if (normalize(sVal) === clean) {
                    return {
                        translatedText: tVal,
                        pos: v.pos || 'kelime',
                        isVocab: true
                    };
                }
            }
        }
    }

    return null;
}

// Online Çeviri Servisi (Tatoeba exact match + Vetted MyMemory Translation API)
async function fetchOnlineTranslation(text, sourceLang, targetLang) {
    const sCode = (sourceLang || 'en').toLowerCase().split(/[-_]/)[0];
    const tCode = (targetLang || 'tr').toLowerCase().split(/[-_]/)[0];
    const cleanText = (text || '').trim();
    if (!cleanText) return { success: false };

    // 1. Önce Tatoeba'da tam cümle çevirisi ara (100% doğal insan çevirisi)
    try {
        const fromLang = TATOEBA_LANG_MAP[sCode] || sCode;
        const toLang = TATOEBA_LANG_MAP[tCode] || tCode;
        const normSearch = normalize(cleanText);
        const url = `https://tatoeba.org/en/api_v0/search?from=${fromLang}&to=${toLang}&query=${encodeURIComponent(cleanText)}`;
        
        const tatoebaRes = await new Promise((resolve) => {
            const req = https.get(url, { headers: { 'User-Agent': 'MultiConverterApp/1.0' }, timeout: 2500 }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        for (const r of (json.results || [])) {
                            if (normalize(r.text) === normSearch) {
                                for (const grp of (r.translations || [])) {
                                    if (Array.isArray(grp)) {
                                        for (const tr of grp) {
                                            if (tr && tr.text && (tr.lang === toLang || tr.lang_tag === tCode)) {
                                                return resolve(tr.text.trim());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        resolve(null);
                    } catch(e) { resolve(null); }
                });
            });
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.on('error', () => resolve(null));
        });

        if (tatoebaRes) {
            return {
                success: true,
                translatedText: tatoebaRes,
                isTatoeba: true
            };
        }
    } catch (_) {}

    // 2. MyMemory Translation API (Ayıklanmış ve Vetted)
    return new Promise((resolve) => {
        const pair = `${sCode}|${tCode}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${pair}`;
        
        const req = https.get(url, { timeout: 3500 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.responseStatus === 200 && json.responseData && json.responseData.translatedText) {
                        let bestText = json.responseData.translatedText;
                        
                        if (Array.isArray(json.matches) && json.matches.length > 0) {
                            const normInput = cleanText.toLowerCase().replace(/[.!?]/g, '').trim();
                            
                            // YALNIZCA aranan metinle gerçekten eşleşen (match >= 0.75 veya segment eşleşen) girdileri dikkate al
                            const relevantMatches = json.matches.filter(m => {
                                if (!m.translation) return false;
                                const normSeg = (m.segment || '').toLowerCase().replace(/[.!?]/g, '').trim();
                                const matchScore = Number(m.match) || 0;
                                return normSeg === normInput || matchScore >= 0.75;
                            });

                            if (relevantMatches.length > 0) {
                                // "Public Web" kaynaklı denetimsiz girdileri sona at, kaliteye göre sırala
                                relevantMatches.sort((a, b) => {
                                    const isPubA = a['created-by'] === 'Public Web';
                                    const isPubB = b['created-by'] === 'Public Web';
                                    if (isPubA !== isPubB) return isPubA ? 1 : -1;
                                    return (Number(b.quality) || 0) - (Number(a.quality) || 0);
                                });

                                const wordCount = cleanText.split(/\s+/).length;
                                const candidate = relevantMatches.find(m => {
                                    const tWords = (m.translation || '').trim().split(/\s+/).length;
                                    if (wordCount >= 2 && tWords === 1 && m['created-by'] === 'Public Web') return false;
                                    return true;
                                });

                                if (candidate && candidate.translation) {
                                    bestText = candidate.translation.trim();
                                }
                            }
                        }

                        resolve({
                            success: true,
                            translatedText: bestText,
                            matches: json.matches || []
                        });
                    } else {
                        resolve({ success: false });
                    }
                } catch(e) {
                    resolve({ success: false });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, timeout: true });
        });

        req.on('error', () => {
            resolve({ success: false });
        });
    });
}

// Online İngilizce Sözlük Tanımı (Free Dictionary API)
function fetchOnlineDictionaryDetails(word) {
    return new Promise((resolve) => {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
        const req = https.get(url, { timeout: 3500 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const arr = JSON.parse(data);
                    if (Array.isArray(arr) && arr.length > 0) {
                        const item = arr[0];
                        const meanings = item.meanings || [];
                        const defs = [];
                        const syns = [];
                        const extraExamples = [];

                        // İnsan stüdyo seslendirmesi (Audio MP3)
                        let audioUrl = '';
                        if (Array.isArray(item.phonetics)) {
                            const foundAudio = item.phonetics.find(p => p.audio && p.audio.endsWith('.mp3'));
                            if (foundAudio) audioUrl = foundAudio.audio;
                        }

                        meanings.forEach(m => {
                            const pos = m.partOfSpeech || '';
                            if (m.definitions) {
                                m.definitions.forEach(d => {
                                    if (d.definition && defs.length < 5) {
                                        defs.push({
                                            pos: pos,
                                            def: d.definition,
                                            example: d.example || ''
                                        });
                                    }
                                    if (d.example && extraExamples.length < 3) {
                                        extraExamples.push({ en: d.example, tr: '' });
                                    }
                                    if (d.synonyms) syns.push(...d.synonyms);
                                });
                            }
                            if (m.synonyms) syns.push(...m.synonyms);
                        });

                        resolve({
                            success: true,
                            ipa: item.phonetic || (item.phonetics && item.phonetics[0]?.text) || '',
                            audioUrl: audioUrl,
                            partOfSpeech: meanings[0]?.partOfSpeech || '',
                            definitions: defs,
                            extraExamples: extraExamples,
                            synonyms: Array.from(new Set(syns)).slice(0, 8)
                        });
                    } else {
                        resolve({ success: false });
                    }
                } catch(e) {
                    resolve({ success: false });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false });
        });

        req.on('error', () => {
            resolve({ success: false });
        });
    });
}

const TATOEBA_LANG_MAP = {
    en: 'eng',
    tr: 'tur',
    ru: 'rus',
    de: 'deu',
    fr: 'fra',
    es: 'spa',
    it: 'ita',
    ar: 'ara',
    zh: 'cmn',
    ja: 'jpn',
    ko: 'kor',
    pt: 'por',
    nl: 'nld'
};

/**
 * Çevrimiçi Açık Kaynak Sözlük ve Doğal Cümle Veritabanı (Tatoeba)
 * Günlük hayattan gerçek insan çevirisi örnek cümleleri getirir
 */
function fetchOnlineExampleSentences(word, sourceLang = 'en', targetLang = 'tr', maxCount = 3) {
    return new Promise((resolve) => {
        const sCode = (sourceLang || 'en').toLowerCase().split(/[-_]/)[0];
        const tCode = (targetLang || 'tr').toLowerCase().split(/[-_]/)[0];
        const fromLang = TATOEBA_LANG_MAP[sCode] || sCode;
        const toLang = TATOEBA_LANG_MAP[tCode] || tCode;
        const cleanWord = (word || '').trim();
        if (!cleanWord) return resolve([]);

        const url = `https://tatoeba.org/en/api_v0/search?from=${fromLang}&to=${toLang}&query=${encodeURIComponent(cleanWord)}`;
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MultiConverterApp/1.0' },
            timeout: 3500
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    const json = JSON.parse(data);
                    if (!json || !Array.isArray(json.results) || json.results.length === 0) {
                        return resolve([]);
                    }

                    const pairs = [];
                    for (const item of json.results) {
                        const srcText = (item.text || '').trim();
                        if (!srcText) continue;

                        let tgtText = '';
                        if (item.translations && Array.isArray(item.translations)) {
                            for (const group of item.translations) {
                                if (Array.isArray(group)) {
                                    for (const tr of group) {
                                        if (tr && tr.text && (tr.lang === toLang || tr.lang_tag === tCode)) {
                                            tgtText = tr.text.trim();
                                            break;
                                        }
                                    }
                                }
                                if (tgtText) break;
                            }
                        }

                        if (tgtText) {
                            pairs.push({
                                src: srcText,
                                tgt: tgtText,
                                en: srcText,
                                tr: tgtText
                            });
                        } else if (pairs.length < 2) {
                            // Hedef dil çevirisi yoksa MyMemory üzerinden çevir
                            try {
                                const trRes = await fetchOnlineTranslation(srcText, sCode, tCode);
                                if (trRes && trRes.success && trRes.translatedText) {
                                    pairs.push({
                                        src: srcText,
                                        tgt: trRes.translatedText,
                                        en: srcText,
                                        tr: trRes.translatedText
                                    });
                                }
                            } catch (_) {}
                        }

                        if (pairs.length >= maxCount) break;
                    }

                    resolve(pairs);
                } catch (e) {
                    resolve([]);
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve([]);
        });

        req.on('error', () => {
            resolve([]);
        });
    });
}

/**
 * Kelime Arama (Word Lookup) - Zengin Detaylı Anlamlar, Örnek Cümleler ve Ses
 */
async function lookupWord(query, sourceLang = 'en', targetLang = 'tr') {
    if (!query || typeof query !== 'string') return null;
    const cleanQuery = normalize(query);
    const sLang = sourceLang.toLowerCase();
    const tLang = targetLang.toLowerCase();

    let foundResult = null;
    let suggestions = [];

    // 0. ÖNCELİK: KULLANICININ ÖĞRENİLMİŞ KELİME HAZNESİ KONTROLÜ
    const learnedKey = `${sLang}_${tLang}_${cleanQuery}`;
    if (LEARNED_MAP.has(learnedKey)) {
        const lEntry = LEARNED_MAP.get(learnedKey);
        foundResult = {
            word: lEntry.word,
            tr: lEntry.tr,
            meaningsList: lEntry.meaningsList || [lEntry.tr],
            type: lEntry.type || 'Öğrenilen Kelime',
            level: lEntry.level || 'Hazneye Kaydedildi',
            ipa: lEntry.ipa || '',
            audioUrl: lEntry.audioUrl || '',
            examples: lEntry.examples || [],
            definitions: lEntry.definitions || [],
            syn: lEntry.syn || [],
            isLearned: true
        };
    }

    // 0.5. ÖNCELİK: ÇOK DİLLİ ÇEVRİMDIŞI VERİTABANI KONTROLÜ (MULTILINGUAL_DB)
    if (!foundResult) {
        const multiOffline = findOfflineTranslation(cleanQuery, sLang, tLang);
        if (multiOffline && multiOffline.translatedText) {
            const examples = [];
            if (multiOffline.isPhrase) {
                examples.push({
                    src: query,
                    tgt: multiOffline.translatedText,
                    en: query,
                    tr: multiOffline.translatedText
                });
            }

            // Çevrimiçi ise Tatoeba'dan zengin günlük hayat örnekleri çek
            try {
                const onlineEx = await fetchOnlineExampleSentences(query, sLang, tLang);
                if (onlineEx && onlineEx.length > 0) {
                    onlineEx.forEach(oe => {
                        if (examples.length < 3 && !examples.some(e => (e.src || e.en || '').toLowerCase() === (oe.src || oe.en || '').toLowerCase())) {
                            examples.push(oe);
                        }
                    });
                }
            } catch (_) {}

            foundResult = {
                word: query,
                tr: multiOffline.translatedText,
                meaningsList: [multiOffline.translatedText],
                type: multiOffline.isPhrase ? 'Kalıp İfade' : (multiOffline.pos || 'sözcük'),
                level: multiOffline.isPhrase ? 'Günlük Deyim' : 'Temel Kelime',
                ipa: '',
                audioUrl: '',
                examples: examples,
                definitions: [],
                syn: []
            };
        }
    }
    if (!foundResult && sLang === 'en' && tLang === 'tr') {
        if (OXFORD_MAP.has(cleanQuery)) {
            const ox = OXFORD_MAP.get(cleanQuery);
            const mList = Array.isArray(ox.m) ? ox.m : (ox.m ? ox.m.split(',').map(s => s.trim()) : []);
            
            const examples = [];
            if (ox.ex && ox.ex.trim().length > 0) {
                let trans = ox.tr ? ox.tr.replace(/\*\*/g, '').trim() : '';
                if (!trans) {
                    const primary = mList[0] || ox.w;
                    trans = `${ox.ex.replace(/\*\*/g, '').trim()} [${primary}]`;
                }
                examples.push({
                    src: ox.ex.replace(/\*\*/g, '').trim(),
                    tgt: trans,
                    en: ox.ex.replace(/\*\*/g, '').trim(),
                    tr: trans
                });
            }

            // Çevrimiçi ise gerçek günlük hayat kullanım örneklerini (Tatoeba) getir
            try {
                const onlineEx = await fetchOnlineExampleSentences(ox.w, 'en', 'tr');
                if (onlineEx && onlineEx.length > 0) {
                    onlineEx.forEach(oe => {
                        if (examples.length < 3 && !examples.some(e => (e.src || e.en || '').toLowerCase() === (oe.src || oe.en || '').toLowerCase())) {
                            examples.push(oe);
                        }
                    });
                }
            } catch (_) {}

            foundResult = {
                word: ox.w,
                tr: mList.join(', '),
                meaningsList: mList,
                type: ox.pos || 'sözcük',
                level: ox.c ? `CEFR ${ox.c}` : '',
                ipa: ox.ph || '',
                audioUrl: '',
                examples: examples,
                definitions: [],
                syn: []
            };
        }

        // Öneriler (Autocomplete)
        suggestions = OXFORD_DICT
            .filter(item => item.w && (normalize(item.w).startsWith(cleanQuery) || normalize(item.w).includes(cleanQuery)))
            .slice(0, 8)
            .map(item => ({
                word: item.w,
                tr: Array.isArray(item.m) ? item.m.join(', ') : item.m,
                type: item.pos || item.c || ''
            }));
    }

    // 2. TÜRKÇE -> İNGİLİZCE (Ters Oxford Arama)
    else if (!foundResult && sLang === 'tr' && tLang === 'en') {
        if (REVERSE_OXFORD_MAP.has(cleanQuery)) {
            const matches = REVERSE_OXFORD_MAP.get(cleanQuery);
            const first = matches[0];
            const examples = [];
            matches.forEach(m => {
                if (m.tr && m.ex && examples.length < 3) {
                    examples.push({
                        src: m.tr.replace(/\*\*/g, '').trim(),
                        tgt: m.ex.replace(/\*\*/g, '').trim(),
                        en: m.ex.replace(/\*\*/g, '').trim(),
                        tr: m.tr.replace(/\*\*/g, '').trim()
                    });
                }
            });

            // Çevrimiçi ise gerçek günlük hayat kullanım örneklerini (Tatoeba) getir
            try {
                const onlineEx = await fetchOnlineExampleSentences(cleanQuery, 'tr', 'en');
                if (onlineEx && onlineEx.length > 0) {
                    onlineEx.forEach(oe => {
                        if (examples.length < 3 && !examples.some(e => (e.src || e.en || '').toLowerCase() === (oe.src || oe.en || '').toLowerCase())) {
                            examples.push(oe);
                        }
                    });
                }
            } catch (_) {}

            foundResult = {
                word: cleanQuery,
                tr: matches.map(m => m.w).join(', '),
                meaningsList: matches.map(m => m.w),
                type: first.pos || 'Türkçe kelime',
                ipa: first.ph || '',
                audioUrl: '',
                examples: examples,
                definitions: [],
                syn: matches.slice(1).map(m => m.w)
            };
        }

        // Öneriler
        for (const [key, items] of REVERSE_OXFORD_MAP.entries()) {
            if (key.startsWith(cleanQuery)) {
                suggestions.push({
                    word: key,
                    tr: items.slice(0, 3).map(i => i.w).join(', '),
                    type: 'Türkçe'
                });
                if (suggestions.length >= 8) break;
            }
        }
    }

    // 3. DİĞER DİLLER VEYA MULTI_DICT KONTROLÜ
    if (!foundResult) {
        const pairKey = `${sLang}_${tLang}`;
        const list = MULTI_DICT[pairKey] || [];
        const item = list.find(x => normalize(x.word) === cleanQuery || normalize(x.word).startsWith(cleanQuery));
        if (item) {
            const mList = item.tr ? item.tr.split(',').map(s => s.trim()) : [];
            const examples = [];
            if (item.ex) {
                examples.push({ src: item.ex, tgt: item.ex_tr || '', en: item.ex, tr: item.ex_tr || '' });
            }

            try {
                const onlineEx = await fetchOnlineExampleSentences(item.word, sLang, tLang);
                if (onlineEx && onlineEx.length > 0) {
                    onlineEx.forEach(oe => {
                        if (examples.length < 3 && !examples.some(e => (e.src || e.en || '').toLowerCase() === (oe.src || oe.en || '').toLowerCase())) {
                            examples.push(oe);
                        }
                    });
                }
            } catch (_) {}

            foundResult = {
                word: item.word,
                tr: item.tr,
                meaningsList: mList,
                type: item.type || 'sözcük',
                ipa: item.ipa || '',
                audioUrl: '',
                examples: examples,
                definitions: [],
                syn: item.syn || []
            };
        }
    }

    // 4. ÇEVRİMİÇİ ZENGİNLEŞTİRME VE KELİME HAZNESİNE EKLEME
    if (!foundResult) {
        const onlineRes = await fetchOnlineTranslation(query, sLang, tLang);
        if (onlineRes.success && onlineRes.translatedText) {
            let onlineIpa = '';
            let onlineAudio = '';
            let onlineSyns = [];
            let onlineDefs = [];
            let onlineExamples = [];

            if (sLang === 'en') {
                const dictDetails = await fetchOnlineDictionaryDetails(query);
                if (dictDetails.success) {
                    onlineIpa = dictDetails.ipa;
                    onlineAudio = dictDetails.audioUrl;
                    onlineSyns = dictDetails.synonyms || [];
                    onlineDefs = dictDetails.definitions || [];
                    if (dictDetails.extraExamples) {
                        onlineExamples.push(...dictDetails.extraExamples.map(e => ({
                            src: e.en,
                            tgt: e.tr,
                            en: e.en,
                            tr: e.tr
                        })));
                    }
                }
            }

            // Gerçek günlük hayat örnek cümlelerini Tatoeba'dan çek
            try {
                const onlineEx = await fetchOnlineExampleSentences(query, sLang, tLang);
                if (onlineEx && onlineEx.length > 0) {
                    onlineEx.forEach(oe => {
                        if (onlineExamples.length < 3 && !onlineExamples.some(e => (e.src || e.en || '').toLowerCase() === (oe.src || oe.en || '').toLowerCase())) {
                            onlineExamples.push(oe);
                        }
                    });
                }
            } catch (_) {}

            const mList = onlineRes.translatedText.split(',').map(s => s.trim());
            foundResult = {
                word: query,
                tr: onlineRes.translatedText,
                meaningsList: mList,
                type: 'Çevrimiçi Öğrenildi',
                level: 'Kelime Haznesine Eklendi',
                ipa: onlineIpa,
                audioUrl: onlineAudio,
                examples: onlineExamples,
                definitions: onlineDefs,
                syn: onlineSyns,
                isOnline: true,
                isLearned: true,
                wasLearnedNow: true
            };

            // Gelecekte internetsiz de aranabilmesi için kelime haznesine kaydet (Yalnızca kelimeler ve kısa deyimler)
            if (query.trim().split(/\s+/).length <= 3) {
                saveLearnedWord({
                    word: query,
                    tr: onlineRes.translatedText,
                    meaningsList: mList,
                    type: 'Öğrenilen Kelime',
                    level: 'Kelime Haznesine Eklendi',
                    ipa: onlineIpa,
                    audioUrl: onlineAudio,
                    examples: onlineExamples,
                    definitions: onlineDefs,
                    syn: onlineSyns,
                    sourceLang: sLang,
                    targetLang: tLang
                });
            }
        }
    } else {
        // Yerel sonuç varsa, online API ile ses ve zengin tanımları arka planda bağla
        if (sLang === 'en') {
            try {
                const details = await fetchOnlineDictionaryDetails(cleanQuery);
                if (details.success) {
                    if (!foundResult.ipa && details.ipa) foundResult.ipa = details.ipa;
                    if (details.audioUrl) foundResult.audioUrl = details.audioUrl;
                    if (details.synonyms && details.synonyms.length > 0 && (!foundResult.syn || foundResult.syn.length === 0)) {
                        foundResult.syn = details.synonyms;
                    }
                    if (details.definitions && details.definitions.length > 0) {
                        foundResult.definitions = details.definitions;
                    }
                    if (details.extraExamples && details.extraExamples.length > 0) {
                        details.extraExamples.forEach(ex => {
                            if (foundResult.examples.length < 3 && !foundResult.examples.some(e => (e.en || e.src) === ex.en)) {
                                foundResult.examples.push({
                                    src: ex.en,
                                    tgt: ex.tr || '',
                                    en: ex.en,
                                    tr: ex.tr || ''
                                });
                            }
                        });
                    }
                }
            } catch (e) {}
        }
    }

    return {
        found: !!foundResult,
        result: foundResult || null,
        suggestions: suggestions,
        query: query,
        sourceLang,
        targetLang
    };
}

/**
 * İnternetsiz ve Hibrit Metin / Cümle Çevirisi (Offline + Online Fallback Translator)
 */
async function translateTextOffline(text, sourceLang = 'en', targetLang = 'tr') {
    if (!text || typeof text !== 'string') return { originalText: '', translatedText: '' };
    
    const sLang = sourceLang.toLowerCase().split(/[-_]/)[0];
    const tLang = targetLang.toLowerCase().split(/[-_]/)[0];
    const key = `${sLang}_${tLang}`;
    const cleanText = text.trim();

    // 1. ÖNCELİK: %100 ÇEVRİMDIŞI DOĞAL CÜMLE & KELİME MOTORU (MULTILINGUAL_DB)
    const offlineMatch = findOfflineTranslation(cleanText, sLang, tLang);
    if (offlineMatch && offlineMatch.translatedText) {
        return {
            originalText: text,
            translatedText: offlineMatch.translatedText,
            sourceLang,
            targetLang,
            isOnline: false
        };
    }

    // 2. ÖNCELİK: EĞER İNGİLİZCE <-> TÜRKÇE TEK KELİME İSE OXFORD SÖZLÜĞÜ
    const singleWordNorm = normalize(cleanText);
    if (sLang === 'en' && tLang === 'tr') {
        if (OXFORD_MAP.has(singleWordNorm)) {
            const ox = OXFORD_MAP.get(singleWordNorm);
            const trMeaning = Array.isArray(ox.m) ? ox.m.join(', ') : ox.m;
            return {
                originalText: text,
                translatedText: trMeaning,
                sourceLang,
                targetLang,
                isOnline: false
            };
        }
    } else if (sLang === 'tr' && tLang === 'en') {
        if (REVERSE_OXFORD_MAP.has(singleWordNorm)) {
            const items = REVERSE_OXFORD_MAP.get(singleWordNorm);
            return {
                originalText: text,
                translatedText: items.map(i => i.w).join(', '),
                sourceLang,
                targetLang,
                isOnline: false
            };
        }
    }

    // 3. ÖNCELİK: ÇEVRİMİÇİ DOĞAL ÇEVİRİ (Tatoeba + Vetted MyMemory)
    try {
        const onlineRes = await fetchOnlineTranslation(cleanText, sLang, tLang);
        if (onlineRes && onlineRes.success && onlineRes.translatedText) {
            // Sadece tekil kelimeleri hazneye ekle, cümleleri sözlük haznesine kirletme
            if (cleanText.split(/\s+/).length === 1) {
                saveLearnedWord({
                    word: cleanText,
                    tr: onlineRes.translatedText,
                    meaningsList: [onlineRes.translatedText],
                    type: 'Çeviriden Öğrenilen',
                    level: 'Kelime Haznesine Eklendi',
                    ipa: '',
                    audioUrl: '',
                    examples: [
                        { src: cleanText, tgt: onlineRes.translatedText, en: cleanText, tr: onlineRes.translatedText }
                    ],
                    definitions: [],
                    syn: [],
                    sourceLang: sLang,
                    targetLang: tLang
                });
            }

            return {
                originalText: text,
                translatedText: onlineRes.translatedText,
                sourceLang,
                targetLang,
                isOnline: true
            };
        }
    } catch (e) {
        // Çevrimdışı fallback'e geç
    }

    // 4. ÖNCELİK: ÇEVRİMDIŞI TOKENİZER & KALIP DEYİMLER (Offline Phrasebook + Tokenizer)
    let translated = cleanText;

    const activePhrases = PHRASEBOOK.filter(p => p.lang === key).sort((a, b) => b.src.length - a.src.length);
    activePhrases.forEach(phrase => {
        const regex = new RegExp(`\\b${phrase.src}\\b`, 'gi');
        if (regex.test(translated)) {
            translated = translated.replace(regex, `[${phrase.tr}]`);
        }
    });

    const tokens = translated.split(/(\s+|[.,!?;:()\[\]"'])/);
    const resultTokens = tokens.map(token => {
        if (token.startsWith('[') && token.endsWith(']')) {
            return token.slice(1, -1);
        }
        const cleanTok = normalize(token);
        if (!cleanTok) return token;

        // Çok dilli temel kelime kontrolü
        const vocabMatch = findOfflineTranslation(cleanTok, sLang, tLang);
        if (vocabMatch && vocabMatch.translatedText) {
            const w = vocabMatch.translatedText;
            if (token[0] && token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) {
                return w.charAt(0).toUpperCase() + w.slice(1);
            }
            return w;
        }

        if (sLang === 'en' && tLang === 'tr' && OXFORD_MAP.has(cleanTok)) {
            const ox = OXFORD_MAP.get(cleanTok);
            const trWord = Array.isArray(ox.m) ? ox.m[0] : ox.m;
            if (token[0] && token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) {
                return trWord.charAt(0).toUpperCase() + trWord.slice(1);
            }
            return trWord;
        } else if (sLang === 'tr' && tLang === 'en' && REVERSE_OXFORD_MAP.has(cleanTok)) {
            const items = REVERSE_OXFORD_MAP.get(cleanTok);
            const enWord = items[0].w;
            if (token[0] && token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) {
                return enWord.charAt(0).toUpperCase() + enWord.slice(1);
            }
            return enWord;
        }
        return token;
    });

    const finalTranslation = resultTokens.join('').replace(/\[|\]/g, '');

    return {
        originalText: text,
        translatedText: finalTranslation,
        sourceLang,
        targetLang,
        isOnline: false
    };
}

/**
 * Evrensel Seslendirme (TTS) Motoru
 * 1. Disk önbelleğini kontrol eder (Varsa anında döndürür)
 * 2. İnternet varsa Google TTS üzerinden stüdyo kalitesinde MP3 çeker ve diske kaydeder
 * 3. İnternet yoksa gömülü ESpeak-NG (WebAssembly) ile çevrimdışı WAV üretir ve diske kaydeder
 */
async function synthesizeSpeech({ text, lang = 'en', userDataDir = null }) {
    if (!text || typeof text !== 'string') return { success: false, error: 'Metin boş' };

    const cacheDir = path.join(userDataDir || currentStorageDir, 'tts_cache');
    try {
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    } catch(e) {}

    const cleanText = text.replace(/\*\*/g, '').replace(/[<>]/g, '').trim();
    if (!cleanText) return { success: false, error: 'Metin boş' };

    const cleanLang = (lang || 'en').toLowerCase().split(/[-_]/)[0];
    const hash = crypto.createHash('md5').update(`${cleanLang}_${cleanText}`).digest('hex');
    const mp3Path = path.join(cacheDir, `${hash}.mp3`);
    const wavPath = path.join(cacheDir, `${hash}.wav`);

    // 1. Önbellek kontrolü (Daha önce dinlendiyse veya kaydedildiyse)
    if (fs.existsSync(mp3Path)) {
        try {
            const buf = fs.readFileSync(mp3Path);
            return {
                success: true,
                audioData: `data:audio/mpeg;base64,${buf.toString('base64')}`,
                format: 'mp3',
                isCached: true
            };
        } catch(e) {}
    }
    if (fs.existsSync(wavPath)) {
        try {
            const buf = fs.readFileSync(wavPath);
            return {
                success: true,
                audioData: `data:audio/wav;base64,${buf.toString('base64')}`,
                format: 'wav',
                isCached: true
            };
        } catch(e) {}
    }

    // 2. Çevrimiçi Doğal Bölgesel Ses Motoru (Google TW-OB ve Google GTX - Bölgeye Özel İnsan Seslendirmesi)
    const ttsEndpoints = [
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${cleanLang}&client=tw-ob`,
        `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${cleanLang}&q=${encodeURIComponent(cleanText)}`
    ];

    for (const url of ttsEndpoints) {
        try {
            const onlineBuffer = await fetchBufferWithRedirects(url, 3);
            if (onlineBuffer && onlineBuffer.length > 300) {
                fs.writeFile(mp3Path, onlineBuffer, () => {});
                return {
                    success: true,
                    audioData: `data:audio/mpeg;base64,${onlineBuffer.toString('base64')}`,
                    format: 'mp3',
                    isOnline: true
                };
            }
        } catch(err) {
            // Sonraki endpoint'e geç
        }
    }

    // 3. %100 Çevrimdışı ESpeak-NG Motoru (Rusça, Türkçe, İngilizce, Almanca, vb. tüm diller)
    try {
        const esLangMap = {
            tr: 'tr', ru: 'ru', en: 'en-us', de: 'de',
            fr: 'fr', es: 'es', it: 'it', ar: 'ar'
        };
        const ESpeakNg = await getESpeakNg();
        if (!ESpeakNg) {
            throw new Error('ESpeak-NG modülü yüklenemedi');
        }
        const targetVoice = esLangMap[cleanLang] || cleanLang;
        const tempWav = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.wav`;
        const espeak = await ESpeakNg({
            arguments: ['-w', tempWav, '-v', targetVoice, cleanText]
        });
        const wavData = Buffer.from(espeak.FS.readFile(tempWav));
        fs.writeFile(wavPath, wavData, () => {});
        return {
            success: true,
            audioData: `data:audio/wav;base64,${wavData.toString('base64')}`,
            format: 'wav',
            isOffline: true
        };
    } catch(e) {
        console.error('[dictionaryEngine] Offline ESpeak-NG hatası:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    lookupWord,
    translateTextOffline,
    initLearnedVocabulary,
    getLearnedStats,
    synthesizeSpeech,
    OXFORD_DICT
};
