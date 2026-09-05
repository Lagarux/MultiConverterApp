const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'assets', 'dictionary', 'multilingual_offline_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

function normalize(s) {
    return (s || '').toString().toLowerCase().trim()
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/é|è|ê|ë/g, 'e').replace(/à|â/g, 'a').replace(/î|ï/g, 'i').replace(/ô/g, 'o').replace(/ù|û/g, 'u')
        .replace(/[.,!?;:()\[\]"']/g, '').replace(/\s+/g, ' ');
}

function findOfflineTranslation(text, sLang, tLang) {
    const s = sLang.toLowerCase();
    const t = tLang.toLowerCase();
    const clean = normalize(text);
    if (!clean) return null;

    for (const p of db.phrases) {
        if (p[s] && p[t]) {
            if (normalize(p[s]) === clean) {
                return { translatedText: p[t], isPhrase: true };
            }
        }
    }
    for (const v of db.vocabulary) {
        if (v[s] && v[t]) {
            if (normalize(v[s]) === clean) {
                return { translatedText: v[t], isVocab: true };
            }
        }
    }
    return null;
}

console.log('tr -> de (Seni seviyorum):', findOfflineTranslation('Seni seviyorum', 'tr', 'de'));
console.log('tr -> en (Seni seviyorum):', findOfflineTranslation('Seni seviyorum', 'tr', 'en'));
console.log('tr -> ru (Seni seviyorum):', findOfflineTranslation('Seni seviyorum', 'tr', 'ru'));
console.log('de -> tr (Guten Morgen):', findOfflineTranslation('Guten Morgen', 'de', 'tr'));
console.log('tr -> de (kitap):', findOfflineTranslation('kitap', 'tr', 'de'));
console.log('de -> tr (Buch):', findOfflineTranslation('Buch', 'de', 'tr'));
console.log('fr -> tr (Je t\'aime):', findOfflineTranslation("Je t'aime", 'fr', 'tr'));
